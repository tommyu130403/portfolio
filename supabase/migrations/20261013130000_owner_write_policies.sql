-- 本番 Supabase の書き込みを「private.owners に登録したオーナー本人 (Supabase Auth ログイン)」だけに絞る
-- 準備 (1/2)。新しい RLS ポリシーと判定関数を「足すだけ」で、既存の anon 用ポリシーには触れない。
--
-- 理由: 現状は全テーブルが anon フルアクセスで、公開 anon キーさえあれば誰でも読み書き削除できる。
--       読み取りは anon に残し、書き込み (insert / update / delete) はオーナーだけにする。
--
-- 適用順序:
--   1. 本マイグレーションを適用する (非破壊。anon の既存ポリシーは残るので公開サイトは壊れない)。
--   2. Supabase Auth でオーナーのユーザーを作成し、メール確認を済ませる。
--   3. private.owners にそのユーザーの user_id を 1 行 insert する。
--        insert into private.owners (user_id) values ('<auth.users.id>');
--   4. 管理画面 (SupabaseSessionGate 入りのフロント) をデプロイし、ログインして書き込めることを確認する。
--   5. 20261013130100_drop_anon_write_policies.sql を適用する (anon の書き込みを閉じる)。
--
-- 対象 11 テーブル: profile, career_items, works, skills_vocab, tools_vocab, skill_cards,
--   work_skills, work_tools, skill_experience, skill_experience_tools, flowcharts
-- storage.objects (bucket 'Portfolio') も対象。
--
-- ※ 非破壊 (追加のみ)。本ファイル内の drop policy if exists は、本ファイルが作る同名ポリシーの作り直し用。
--
-- ロールバック (ポリシー数: 11 テーブル x 4 = 44 本 + storage 2 本):
--   do $$
--   declare t text;
--   begin
--     foreach t in array array['profile','career_items','works','skills_vocab','tools_vocab',
--       'skill_cards','work_skills','work_tools','skill_experience','skill_experience_tools','flowcharts']
--     loop
--       execute format('drop policy if exists select_public on public.%I', t);
--       execute format('drop policy if exists insert_owner on public.%I', t);
--       execute format('drop policy if exists update_owner on public.%I', t);
--       execute format('drop policy if exists delete_owner on public.%I', t);
--     end loop;
--   end $$;
--   drop policy if exists "Portfolio read" on storage.objects;
--   drop policy if exists "Portfolio owner insert" on storage.objects;
--   drop function if exists private.is_owner();
--   drop table if exists private.owners;
--   drop schema if exists private;

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists private.owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.owners enable row level security;
revoke all on private.owners from public, anon, authenticated;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.owners where user_id = (select auth.uid())
  )
$$;

revoke execute on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'career_items', 'works', 'skills_vocab', 'tools_vocab', 'skill_cards',
    'work_skills', 'work_tools', 'skill_experience', 'skill_experience_tools', 'flowcharts'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise exception 'テーブル public.% が存在しない', t;
    end if;

    execute format('drop policy if exists select_public on public.%I', t);
    execute format(
      'create policy select_public on public.%I for select to anon, authenticated using (true)', t);

    execute format('drop policy if exists insert_owner on public.%I', t);
    execute format(
      'create policy insert_owner on public.%I for insert to authenticated with check ((select private.is_owner()))', t);

    execute format('drop policy if exists update_owner on public.%I', t);
    execute format(
      'create policy update_owner on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))', t);

    execute format('drop policy if exists delete_owner on public.%I', t);
    execute format(
      'create policy delete_owner on public.%I for delete to authenticated using ((select private.is_owner()))', t);
  end loop;
end $$;

drop policy if exists "Portfolio read" on storage.objects;
create policy "Portfolio read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'Portfolio');

drop policy if exists "Portfolio owner insert" on storage.objects;
create policy "Portfolio owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'Portfolio' and (select private.is_owner()));
