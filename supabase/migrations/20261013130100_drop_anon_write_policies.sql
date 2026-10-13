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
-- ロールバック (厳密な復元は supabase/backups/ の適用前控えを正とする。以下は概略):
--   grant insert, update, delete, truncate on
--     public.profile, public.career_items, public.works, public.skills_vocab, public.tools_vocab,
--     public.skill_cards, public.work_skills, public.work_tools, public.skill_experience,
--     public.skill_experience_tools, public.flowcharts
--     to anon;
--   do $$
--   declare t text;
--   begin
--     foreach t in array array['profile','career_items','works','skills_vocab','tools_vocab',
--       'skill_cards','work_skills','work_tools','skill_experience','skill_experience_tools','flowcharts']
--     loop
--       execute format('drop policy if exists %I on public.%I', 'anon full access ' || t, t);
--       execute format('create policy %I on public.%I for all to anon using (true) with check (true)',
--         'anon full access ' || t, t);
--     end loop;
--   end $$;
--   create policy "anon can upload to Portfolio storage" on storage.objects
--     for insert to anon with check (bucket_id = 'Portfolio');
--   create policy "anon can read Portfolio storage" on storage.objects
--     for select to anon using (bucket_id = 'Portfolio');

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
