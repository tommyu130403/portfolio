-- 本番 Supabase の書き込みをオーナー本人だけに絞る仕上げ (2/2)。anon の書き込み権限とポリシーを閉じる。
--
-- 理由: 20261013130000_owner_write_policies.sql で作ったオーナー用ポリシーが有効になったので、
--       公開 anon キーで誰でも書き込める旧ポリシー ("anon full access <t>" など) と
--       anon への insert / update / delete / truncate 権限を取り除く。
--
-- 適用順序: 必ず 20261013130000 の適用後。さらに、
--   - private.owners に確認済み (email_confirmed_at あり) の auth ユーザーを登録済みであること
--     (未登録なら下の安全装置が例外で止める)
--   - SupabaseSessionGate 入りの管理画面をデプロイし、オーナーでログインして書き込める確認が済んでいること
--     (先に適用すると、旧管理画面の anon 書き込みが全部失敗する)
--
-- ※ 破壊的変更 (anon の書き込み手段を失う)。
--
-- ロールバック (2026-10-13 に観測した本番の適用前状態を再作成する。以下をコメント解除して流す):
--   -- 本番の適用前ポリシー (pg_policies, 2026-10-13 観測) をそのまま再作成する。
--   -- dev は本番と構成が異なる可能性があるので、dev には流さないこと。
--   -- 本番適用直前に supabase/backups/20261013_policies_pre_owner_lock.json へ適用前のポリシーを保存する
--   -- (保存はメインセッションが行う)。差異があればそちらを正とする。
--   -- 2本目で足した新ポリシー (select_public 等 4 本 x 11) は 1 本目のロールバックで消えるので、ここでは触らない。
--   -- この後に 1 本目のロールバックを流す場合は、必ず本ロールバックを先に流すこと。
--   -- 1 本目を先に流すと anon の SELECT ポリシーが消え、公開サイトの読み取りがエラーなしで 0 行になる。
--   grant insert, update, delete, truncate on
--     public.profile, public.career_items, public.works, public.skills_vocab, public.tools_vocab,
--     public.skill_cards, public.work_skills, public.work_tools, public.skill_experience,
--     public.skill_experience_tools, public.flowcharts
--     to anon;
--   create policy "anon full access career_items" on public.career_items for all to anon using (true) with check (true);
--   create policy "anon_all" on public.career_items for all to public using (true) with check (true);
--   create policy "anon full access flowcharts" on public.flowcharts for all to anon using (true) with check (true);
--   create policy "auth write flowcharts" on public.flowcharts for all to authenticated using (true) with check (true);
--   create policy "public read flowcharts" on public.flowcharts for select to public using (true);
--   create policy "anon can upsert profile" on public.profile for update to anon using (true) with check (true);
--   create policy "anon_all" on public.profile for all to public using (true) with check (true);
--   create policy "anon full access skill_cards" on public.skill_cards for all to anon using (true) with check (true);
--   create policy "auth write skill_cards" on public.skill_cards for all to public using (auth.role() = 'authenticated');
--   create policy "public read skill_cards" on public.skill_cards for select to public using (true);
--   create policy "anon full access skill_experience" on public.skill_experience for all to anon using (true) with check (true);
--   create policy "auth write skill_bars" on public.skill_experience for all to public using (auth.role() = 'authenticated');
--   create policy "public read skill_bars" on public.skill_experience for select to public using (true);
--   create policy "anon full access skill_experience_tools" on public.skill_experience_tools for all to anon using (true);
--   create policy "auth write skill_experience_tools" on public.skill_experience_tools for all to public using (auth.role() = 'authenticated');
--   create policy "public read skill_experience_tools" on public.skill_experience_tools for select to public using (true);
--   create policy "anon full access skills_vocab" on public.skills_vocab for all to anon using (true) with check (true);
--   create policy "auth write skills_vocab" on public.skills_vocab for all to authenticated using (true) with check (true);
--   create policy "public read skills_vocab" on public.skills_vocab for select to public using (true);
--   create policy "anon full access tools_vocab" on public.tools_vocab for all to anon using (true) with check (true);
--   create policy "auth write tools_vocab" on public.tools_vocab for all to authenticated using (true) with check (true);
--   create policy "public read tools_vocab" on public.tools_vocab for select to public using (true);
--   create policy "anon full access work_skills" on public.work_skills for all to anon using (true) with check (true);
--   create policy "auth write work_skills" on public.work_skills for all to authenticated using (true) with check (true);
--   create policy "public read work_skills" on public.work_skills for select to public using (true);
--   create policy "anon full access work_tools" on public.work_tools for all to anon using (true) with check (true);
--   create policy "auth write work_tools" on public.work_tools for all to authenticated using (true) with check (true);
--   create policy "public read work_tools" on public.work_tools for select to public using (true);
--   create policy "anon full access works" on public.works for all to anon using (true) with check (true);
--   create policy "works public read" on public.works for select to public using (true);
--   create policy "anon can read Portfolio storage" on storage.objects for select to anon using (bucket_id = 'Portfolio');
--   create policy "anon can upload to Portfolio storage" on storage.objects for insert to anon with check (bucket_id = 'Portfolio');

do $$
begin
  if not exists (
    select 1
    from private.owners o
    join auth.users u on u.id = o.user_id
    where u.email_confirmed_at is not null
  ) then
    raise exception 'owner 未登録（確認済みの auth ユーザーと結び付いた行が無い）';
  end if;
end $$;

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profile', 'career_items', 'works', 'skills_vocab', 'tools_vocab', 'skill_cards',
        'work_skills', 'work_tools', 'skill_experience', 'skill_experience_tools', 'flowcharts'
      ])
      and policyname not in ('select_public', 'insert_owner', 'update_owner', 'delete_owner')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

revoke insert, update, delete, truncate on
  public.profile, public.career_items, public.works, public.skills_vocab, public.tools_vocab,
  public.skill_cards, public.work_skills, public.work_tools, public.skill_experience,
  public.skill_experience_tools, public.flowcharts
  from anon;

drop policy if exists "anon can upload to Portfolio storage" on storage.objects;
drop policy if exists "anon can read Portfolio storage" on storage.objects;
