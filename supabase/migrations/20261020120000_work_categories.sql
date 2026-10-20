-- works.category を「自由入力」から「管理できる語彙 (work_categories)」へ移す。
--
-- 理由: カテゴリの表記ゆれ (空白違いなど) を防ぎ、管理画面で一覧から選ぶ・追加・名前変更・削除ができるようにするため。
--       works.category は TEXT のまま「カテゴリ名」を保存する (名前ベース)。公開サイト側のコードは変更しない。
--       名前変更は rename_work_category() が work_categories と works.category を同一トランザクションで更新する。
--
-- 適用順序:
--   1. 本マイグレーションを dev に適用 → 検証 SQL を流す → 本番に適用 → 検証 SQL を流す。
--      (テーブル追加と works.category の前後空白の正規化のみ。列の追加・削除はしない)
--   2. フロント (WorkCategoryField を使う管理画面) をデプロイする。
--      先にデプロイすると、管理画面のカテゴリ欄が「テーブルが無い」エラーになる。
--
-- ※ 20261013130000 の対象テーブル一覧には含まれない新規テーブルなので、ポリシーは本ファイルで作る。
--
-- ロールバック (以下をコメント解除して流す):
--   -- works.category の値はそのまま残るので、公開サイトにも作品データにも影響しない。
--   -- 先にフロントを work_categories を参照しない版へ戻すこと。
--   drop function if exists public.rename_work_category(uuid, text);
--   drop table if exists public.work_categories;
--   notify pgrst, 'reload schema';
--
-- 検証 SQL (適用後に本体とは別の Run で流す):
--   select column_name, data_type, is_nullable, column_default from information_schema.columns
--   where table_schema='public' and table_name='work_categories' order by ordinal_position;
--     -- 期待: id uuid NO gen_random_uuid() / name text NO / sort_order integer NO 0 / created_at timestamptz NO now()
--   select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='work_categories' order by policyname;
--     -- 期待: 4 本。delete_owner {authenticated} / insert_owner {authenticated} / select_public {anon,authenticated} / update_owner {authenticated}
--   select (select count(*) from public.work_categories) as categories,
--          (select count(distinct category) from public.works where category is not null) as distinct_works;
--     -- 期待: 2 つの値が一致 (本番の想定は 6)
--   begin; set local role anon; insert into public.work_categories (name) values ('検証用'); rollback;
--     -- 期待: エラー (row-level security policy 違反)。anon は書き込めない
--   select has_function_privilege('anon', 'public.rename_work_category(uuid, text)', 'execute') as anon_exec,
--          has_function_privilege('authenticated', 'public.rename_work_category(uuid, text)', 'execute') as auth_exec;
--     -- 期待: anon_exec = false / auth_exec = true

create table if not exists public.work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and name = btrim(name)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.work_categories enable row level security;

drop policy if exists select_public on public.work_categories;
create policy select_public on public.work_categories
  for select to anon, authenticated
  using (true);

drop policy if exists insert_owner on public.work_categories;
create policy insert_owner on public.work_categories
  for insert to authenticated
  with check ((select private.is_owner()));

drop policy if exists update_owner on public.work_categories;
create policy update_owner on public.work_categories
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

drop policy if exists delete_owner on public.work_categories;
create policy delete_owner on public.work_categories
  for delete to authenticated
  using ((select private.is_owner()));

-- 既存値の前後空白を取り除く (空文字は NULL にする)
update public.works
  set category = nullif(btrim(category), '')
  where category is distinct from nullif(btrim(category), '');

-- 既存の works.category から語彙を作る
insert into public.work_categories (name, sort_order)
select name, (row_number() over (order by name))::integer
from (
  select distinct btrim(category) as name
  from public.works
  where category is not null and btrim(category) <> ''
) s
on conflict (name) do nothing;

-- カテゴリ名の変更: 語彙と works.category を同一トランザクションで更新する
create or replace function public.rename_work_category(p_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new text := btrim(coalesce(p_name, ''));
  v_old text;
  v_rows integer;
begin
  if v_new = '' then
    raise exception 'カテゴリ名を入力してください';
  end if;

  select name into v_old from public.work_categories where id = p_id;
  if v_old is null then
    raise exception '権限がないか、カテゴリが見つかりません';
  end if;

  if v_old = v_new then
    return;
  end if;

  update public.work_categories set name = v_new where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、カテゴリが見つかりません';
  end if;

  update public.works set category = v_new where category = v_old;
end;
$$;

revoke all on function public.rename_work_category(uuid, text) from public, anon;
grant execute on function public.rename_work_category(uuid, text) to authenticated;

notify pgrst, 'reload schema';
