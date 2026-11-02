-- Reader access is limited to images used by a published work or by the
-- public home page (profile image). Keep the
-- bucket private. Existing signed URLs remain valid until they expire.

begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Portfolio authorized read' and cmd = 'SELECT'
  ) then
    raise exception 'Expected Portfolio authorized read policy is missing';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('SELECT', 'ALL') and policyname <> 'Portfolio authorized read'
  ) then
    raise exception 'Review other Storage read policies before narrowing Portfolio access';
  end if;
  if to_regclass('private.work_image_refs') is null then
    raise exception 'Apply the work image index migration first';
  end if;
end $$;

create function private.is_public_portfolio_image(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.work_image_refs r
    join public.works w on w.id = r.work_id
    where r.object_path = p_object_path and w.is_published
  ) or exists (
    select 1 from public.profile p
    where p.id = 1
      and private.portfolio_path_from_url(p.hero_image_url) = p_object_path
  ) or exists (
    select 1 from public.tools_vocab t
    where private.portfolio_path_from_url(t.icon_url) = p_object_path
      and exists (
        select 1 from public.work_tools wt
        join public.works w on w.id = wt.work_id
        where wt.tool_id = t.id and w.is_published
      )
  )
$$;

revoke execute on function private.is_public_portfolio_image(text) from public, anon;
grant execute on function private.is_public_portfolio_image(text) to authenticated;

drop policy "Portfolio authorized read" on storage.objects;
create policy "Portfolio authorized read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'Portfolio' and (
      (select private.is_owner()) or
      ((select private.is_reader()) and private.is_public_portfolio_image(name))
    )
  );

commit;
