--
-- 何をするか:
--   1. 問い合わせフォーム(サイドメニューとログイン画面の Contact)の送信内容を貯める表 public.contact_messages を作る。
--   2. 権限:
--      - 送れるのは anon(ログイン前の人)と authenticated(ログイン済みの人)。送れる列は name / email / message だけ
--        (id・user_id・created_at・ip_hash は表とトリガーが決める。日時を書き換えて上限を逃れることはできない)。
--      - ログイン済みの人は自分名義の行だけ。ログイン前の人は名義なし(user_id が null)の行だけ。
--      - 読む・消すのはオーナーだけ。更新は誰もできない(送った内容は変えさせない)。
--   3. いたずら対策(24 時間あたり。上回るとエラー 'contact_rate_limited'):
--      - ログイン済み: 1 人 5 件まで
--      - ログイン前: 接続元(IP アドレス)ごとに 3 件まで、かつログイン前の全体で 30 件まで
--      接続元は md5 にしてから保存する(IP アドレスそのものは残さない)。
--      同時に送られても上限を超えないよう、数える前に名義ごとのロックを取る。
--   4. 文字数の上限(名前 100・メール 254・本文 4000)は空白も含めて数える。空白・改行だけの値は通さない。
--
-- 適用順序(dev → 本番):
--   1. 本ファイル全体を Run。
--   2. supabase/data/20261109_contact_messages_verify.sql で確かめる(手順は docs/contact-form-runbook.md)。
--   3. 本番: フロントのデプロイ前に適用してよい(表を作るだけで、既存の画面は何も読まない)。
--      フロントを先にデプロイすると、送信ボタンが「送信できませんでした」になる(表が無いため)。
--
-- 再実行: 安全。表と索引は既にあれば作らない。権限・ポリシー・関数・トリガーは毎回作り直す(中身は同じ)。
--
-- 戻すとき:
--   drop table if exists public.contact_messages;
--   drop function if exists private.guard_contact_messages();
--

-- 1. 表
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- ゲストの Auth ユーザーを片付けても、問い合わせは残す
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  ip_hash text,
  name text not null check (
    char_length(name) <= 100 and btrim(name, E' \t\r\n　') <> ''
  ),
  email text not null check (
    char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  message text not null check (
    char_length(message) <= 4000 and btrim(message, E' \t\r\n　') <> ''
  ),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_user_created_idx
  on public.contact_messages (user_id, created_at desc);
create index if not exists contact_messages_ip_created_idx
  on public.contact_messages (ip_hash, created_at desc);
create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

-- 2. 権限
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant insert (name, email, message) on public.contact_messages to anon, authenticated;
grant select, delete on public.contact_messages to authenticated;

drop policy if exists insert_reader on public.contact_messages;
drop policy if exists insert_signed_in on public.contact_messages;
drop policy if exists insert_public on public.contact_messages;
drop policy if exists select_owner on public.contact_messages;
drop policy if exists delete_owner on public.contact_messages;
-- ログイン済み: 自分名義の行だけ(閲覧権限の期限が切れたゲストも、問い合わせはできる)
create policy insert_signed_in on public.contact_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
-- ログイン前: 名義なしの行だけ
create policy insert_public on public.contact_messages for insert to anon
  with check (user_id is null);
create policy select_owner on public.contact_messages for select to authenticated
  using ((select private.is_owner()));
create policy delete_owner on public.contact_messages for delete to authenticated
  using ((select private.is_owner()));

-- 3. 送信前の処理(閲覧者は他人の行を読めないため、数えるのは security definer の関数で行う)
drop trigger if exists limit_contact_messages on public.contact_messages;
drop function if exists private.limit_contact_messages();

create or replace function private.guard_contact_messages()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  headers json;
  ip text;
begin
  -- 列の権限で止めているが、念のため表が決める値で上書きする
  new.id := gen_random_uuid();
  new.created_at := now();

  -- 接続元: 中継元(Cloudflare)が付ける cf-connecting-ip を優先する。x-forwarded-for の先頭は送信者が偽れるため控え。
  -- どちらも取れなければ 'unknown' を 1 つの接続元として数える
  headers := nullif(current_setting('request.headers', true), '')::json;
  ip := coalesce(
    nullif(btrim(headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1)), '')
  );
  new.ip_hash := md5(coalesce(ip, 'unknown'));

  if new.user_id is not null then
    perform pg_advisory_xact_lock(hashtext('contact:user:' || new.user_id::text));
    if (
      select count(*) from public.contact_messages
      where user_id = new.user_id and created_at > now() - interval '24 hours'
    ) >= 5 then
      raise exception 'contact_rate_limited' using errcode = 'P0001',
        hint = '24 時間あたりの送信上限(1 人 5 件)に達しました';
    end if;
  else
    -- ログイン前は全体の上限も見るため、ログイン前の送信を 1 本の列に並べる
    perform pg_advisory_xact_lock(hashtext('contact:public'));
    if (
      select count(*) from public.contact_messages
      where user_id is null and ip_hash = new.ip_hash and created_at > now() - interval '24 hours'
    ) >= 3 then
      raise exception 'contact_rate_limited' using errcode = 'P0001',
        hint = '24 時間あたりの送信上限(接続元ごとに 3 件)に達しました';
    end if;
    if (
      select count(*) from public.contact_messages
      where user_id is null and created_at > now() - interval '24 hours'
    ) >= 30 then
      raise exception 'contact_rate_limited' using errcode = 'P0001',
        hint = '24 時間あたりの送信上限(ログイン前の全体で 30 件)に達しました';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_contact_messages() from public, anon, authenticated;

drop trigger if exists guard_contact_messages on public.contact_messages;
create trigger guard_contact_messages
  before insert on public.contact_messages
  for each row execute function private.guard_contact_messages();
