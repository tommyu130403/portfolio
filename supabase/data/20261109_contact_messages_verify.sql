-- 20261109130000_contact_messages.sql の適用後の検証。手順は docs/contact-form-runbook.md。
-- 使い方:
--   1〜3 は 1 ブロックずつ選んで Run し、コメントの期待値と見比べる(まとめて流すと最後の結果しか見えない)。
--   4 は「begin;」から最後の「rollback;」までをまとめて選んで Run する。
--     途中で止まらなければ通過。期待と違うときは '4x 不一致' のエラーで止まる。
--     最後に rollback するので、表に行は残らない。
--   4 の前提: その環境に、期限内のゲストが 1 人以上いること(いなければ '4-0' で止まる)。

-- 1. 列(期待: id uuid NO gen_random_uuid() / user_id uuid YES auth.uid() / ip_hash text YES /
--    name text NO / email text NO / message text NO / created_at timestamptz NO now())
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'contact_messages'
order by ordinal_position;

-- 2. RLS(期待: rls = true、delete_owner:DELETE:{authenticated}, insert_public:INSERT:{anon},
--    insert_signed_in:INSERT:{authenticated}, select_owner:SELECT:{authenticated}。UPDATE のポリシーは無い)
select c.relrowsecurity as rls,
       (select string_agg(p.policyname || ':' || p.cmd || ':' || p.roles::text, ', ' order by p.policyname)
          from pg_policies p where p.schemaname = 'public' and p.tablename = 'contact_messages') as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'contact_messages';

-- 3. 列ごとの書き込み権限(期待: anon と authenticated それぞれに email / message / name の INSERT の 3 行ずつ。
--    authenticated には表全体の DELETE, SELECT もある(下の 2 つ目の結果))
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'contact_messages'
  and grantee in ('anon', 'authenticated') and privilege_type = 'INSERT'
order by grantee, column_name;
select grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'contact_messages' and grantee in ('anon', 'authenticated')
group by 1 order by 1;

-- 4. ふるまい(ゲスト 1 人とログイン前の人になりすまして確かめ、最後に取り消す)
begin;

-- 接続元を固定する(ログイン前の上限を数えるため)
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.10"}', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select user_id from private.readers
          where expires_at is null or expires_at > now()
          order by created_at limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  n integer;
begin
  -- 4-0. なりすます相手(期限内のゲスト)がいないと 4a が原因の読めないエラーで止まるため、先に確かめる
  if (select auth.uid()) is null then
    raise exception '4-0 期限内のゲストがいません。private.readers にゲストを 1 人用意してから流してください';
  end if;

  -- 4a. ゲストは 1 件送れる
  insert into public.contact_messages (name, email, message)
  values ('検証', 'verify@example.com', '検証用の本文');

  -- 4b. ゲストは自分の送った行も読めない(読めるのはオーナーだけ)
  select count(*) into n from public.contact_messages;
  if n <> 0 then raise exception '4b 不一致: ゲストが % 行読めた', n; end if;

  -- 4c. メールアドレスの形が違うと弾かれる
  begin
    insert into public.contact_messages (name, email, message) values ('検証', 'not-an-email', '本文');
    raise exception '4c 不一致: 不正なメールアドレスが通った';
  exception when check_violation then null;
  end;

  -- 4d. 改行・空白だけの本文は弾かれる
  begin
    insert into public.contact_messages (name, email, message) values ('検証', 'verify@example.com', E' \n　');
    raise exception '4d 不一致: 空白だけの本文が通った';
  exception when check_violation then null;
  end;

  -- 4e. 名義・日時は指定できない(列の権限が無い)
  begin
    insert into public.contact_messages (name, email, message, created_at)
    values ('検証', 'verify@example.com', '本文', '2000-01-01');
    raise exception '4e 不一致: 日時を指定できた';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.contact_messages (user_id, name, email, message)
    values (gen_random_uuid(), '検証', 'verify@example.com', '本文');
    raise exception '4e 不一致: 他人名義を指定できた';
  exception when insufficient_privilege then null;
  end;

  -- 4f. 24 時間で 5 件まで(4a と合わせて 5 件目までは通り、6 件目で止まる)
  for i in 2..5 loop
    insert into public.contact_messages (name, email, message)
    values ('検証', 'verify@example.com', '本文 ' || i);
  end loop;
  begin
    insert into public.contact_messages (name, email, message) values ('検証', 'verify@example.com', '本文 6');
    raise exception '4f 不一致: 6 件目が通った';
  exception when raise_exception then
    if sqlerrm <> 'contact_rate_limited' then raise; end if;
  end;

  -- 4g. 更新はできない(update の権限が無い)
  begin
    update public.contact_messages set name = '書き換え';
    raise exception '4g 不一致: 更新が通った';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- 4h. ログイン前の人: 接続元ごとに 3 件まで送れ、4 件目で止まる。読むことはできない
-- (ゲストの名義を外す。残すと auth.uid() がゲストを返し、名義なしの決まりに弾かれる)
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$
declare
  n integer;
begin
  for i in 1..3 loop
    insert into public.contact_messages (name, email, message)
    values ('検証', 'verify@example.com', 'ログイン前 ' || i);
  end loop;
  begin
    insert into public.contact_messages (name, email, message) values ('検証', 'verify@example.com', 'ログイン前 4');
    raise exception '4h 不一致: 同じ接続元の 4 件目が通った';
  exception when raise_exception then
    if sqlerrm <> 'contact_rate_limited' then raise; end if;
  end;
  begin
    select count(*) into n from public.contact_messages;
    raise exception '4h 不一致: ログイン前の人が % 行読めた', n;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4i. 保存された行(オーナー権限の SQL Editor から見る): ゲスト 5 行に user_id、ログイン前 3 行は user_id が null で
--     ip_hash が同じ値。どの行も created_at は今の時刻
do $$
begin
  if (select count(*) from public.contact_messages where user_id is null and created_at > now() - interval '1 minute') <> 3
  then raise exception '4i 不一致: ログイン前の行が 3 行ではない'; end if;
  if (select count(distinct ip_hash) from public.contact_messages where user_id is null and created_at > now() - interval '1 minute') <> 1
  then raise exception '4i 不一致: 接続元の記録が揃っていない'; end if;
end $$;

rollback;
