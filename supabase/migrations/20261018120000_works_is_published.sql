-- works に公開フラグ is_published を足し、非公開の行を anon から読めなくする。
--
-- 理由: 管理画面で作品を「非公開」にでき、公開サイト (anon) からは DB レベルで見えなくするため。
--       オーナー本人 (private.is_owner()) は管理画面で全件を読める。
--
-- 適用順序:
--   1. 本マイグレーションを dev に適用 → 検証 SQL を流す → 本番に適用 → 検証 SQL を流す。
--      (列追加は default true なので非破壊。既存行はすべて公開のまま)
--   2. フロント (is_published を読む / 保存する版) をデプロイする。
--      先にデプロイすると、公開サイトの .eq("is_published", true) と管理画面の保存が「列が無い」エラーになる。
--
-- ポリシー:
--   select_public (anon, authenticated): using (is_published)   ← 名前は据え置き。20261013130100 の残す一覧に入っているため
--   select_owner  (authenticated)      : using ((select private.is_owner()))
--   is_owner() は anon に実行権が無いので、anon が評価するポリシーには入れない (2 本に分ける理由)。
--
-- ※ 20261013130000 を流し直すと select_public が using (true) に戻り、非公開が誰にでも見えるようになる。
-- ※ 20261013130100 を流し直すと select_owner が消え、管理画面で非公開の作品が開けなくなる。
--
-- ロールバック (以下をコメント解除して流す):
--   -- 必ず先にフロントを is_published を参照しない版へ戻すこと。逆順だと公開サイトが「列が無い」エラーになる。
--   -- 20261013130000 のロールバックも流す場合は、本ロールバックを先に流すこと (select_owner はあちらでは消えない)。
--   drop policy if exists select_owner on public.works;
--   drop policy if exists select_public on public.works;
--   create policy select_public on public.works for select to anon, authenticated using (true);
--   alter table public.works drop column if exists is_published;
--
-- 検証 SQL (適用後に本体とは別の Run で流す):
--   select column_name, data_type, is_nullable, column_default from information_schema.columns
--   where table_schema='public' and table_name='works' and column_name='is_published';
--     -- 期待: is_published | boolean | NO | true
--   select policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename='works' order by policyname;
--     -- 期待: 5 本。select_owner {authenticated} qual=( SELECT private.is_owner() ...) / select_public {anon,authenticated} qual=is_published
--   begin; set local role anon; select count(*) from public.works; rollback;
--     -- 期待: is_published = true の行数と一致 (0 なら公開サイトが空になっている)

-- 事前チェック: RLS が有効で、select_public 以外に works を読ませる SELECT / ALL ポリシーが無いこと
-- (残っていると OR で効いてしまい、非公開が anon に見える)
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.works'::regclass) then
    raise exception 'public.works の RLS が無効';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'works'
      and cmd in ('SELECT', 'ALL')
      and policyname not in ('select_public', 'select_owner')
  ) then
    raise exception 'public.works に select_public 以外の SELECT/ALL ポリシーが残っている';
  end if;
end $$;

alter table public.works
  add column if not exists is_published boolean not null default true;

drop policy if exists select_public on public.works;
create policy select_public on public.works
  for select to anon, authenticated
  using (is_published);

drop policy if exists select_owner on public.works;
create policy select_owner on public.works
  for select to authenticated
  using ((select private.is_owner()));

notify pgrst, 'reload schema';
