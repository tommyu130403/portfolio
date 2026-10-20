-- Guest access is an authenticated Supabase account listed in private.readers.
-- This migration protects database rows; the existing public Storage bucket and
-- URLs are still public. Apply only after the work_categories migration is merged,
-- the prepare_reader_access migration has been applied, a guest Auth user exists,
-- its user_id has been inserted into private.readers,
-- and the email/password client is ready to deploy. Do not apply this file alone
-- to the currently deployed client: anonymous visitors would see empty data.
--
-- After applying, verify with separate read-only requests using anon, reader,
-- and owner tokens: anon sees zero rows in every table below; reader sees only
-- published works and their links; owner sees drafts and can still edit.

do $$
declare
  t text;
begin
  if to_regclass('public.work_categories') is null then
    raise exception 'work_categories migration must be applied before reader policies';
  end if;
  if to_regclass('private.readers') is null or not exists (select 1 from private.readers) then
    raise exception 'Create and allowlist a guest Auth user before closing anonymous reads';
  end if;
  foreach t in array array[
    'profile', 'career_items', 'works', 'skills_vocab', 'tools_vocab',
    'skill_cards', 'work_skills', 'work_tools', 'skill_experience',
    'skill_experience_tools', 'flowcharts', 'work_categories'
  ] loop
    if not (select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass) then
      raise exception 'RLS is disabled on public.%', t;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and cmd in ('SELECT', 'ALL')
        and policyname not in ('select_public', 'select_owner')
    ) then
      raise exception 'Unexpected read policy on public.%', t;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and (
          cmd = 'ALL' or
          (policyname = 'select_owner' and (t <> 'works' or roles <> array['authenticated']::name[]))
        )
    ) then
      raise exception 'Unexpected owner or ALL policy on public.%', t;
    end if;
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'career_items', 'skills_vocab', 'tools_vocab',
    'skill_cards', 'skill_experience', 'skill_experience_tools',
    'flowcharts', 'work_categories'
  ] loop
    execute format('drop policy if exists select_public on public.%I', t);
    execute format('create policy select_reader on public.%I for select to authenticated using ((select private.can_read_portfolio()))', t);
  end loop;
end $$;

drop policy if exists select_public on public.works;
drop policy if exists select_owner on public.works;
create policy select_reader on public.works
  for select to authenticated
  using ((select private.is_owner()) or (is_published and (select private.is_reader())));

drop policy if exists select_public on public.work_skills;
create policy select_reader on public.work_skills
  for select to authenticated
  using (
    (select private.is_owner()) or
    ((select private.is_reader()) and exists (
      select 1 from public.works w where w.id = work_id and w.is_published
    ))
  );

drop policy if exists select_public on public.work_tools;
create policy select_reader on public.work_tools
  for select to authenticated
  using (
    (select private.is_owner()) or
    ((select private.is_reader()) and exists (
      select 1 from public.works w where w.id = work_id and w.is_published
    ))
  );

notify pgrst, 'reload schema';
