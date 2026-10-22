-- Apply after the signed-image client is live, private.readers is populated,
-- and the reader and owner image views have been checked. Public object URLs
-- stop working as soon as the bucket becomes private.
--
-- If image delivery fails, keep the bucket private while repairing the
-- signed-image client or reader policy. Reopening public access would expose
-- every stored image and requires a separate explicit decision.

begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'Portfolio') then
    raise exception 'Portfolio Storage bucket does not exist';
  end if;
  if to_regclass('private.readers') is null or not exists (select 1 from private.readers) then
    raise exception 'Allowlist a guest Auth user before protecting images';
  end if;
  if to_regprocedure('private.can_read_portfolio()') is null then
    raise exception 'Reader access migration must be applied first';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Portfolio read' and cmd = 'SELECT'
  ) then
    raise exception 'Expected Portfolio read policy is missing';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('SELECT', 'ALL') and policyname <> 'Portfolio read'
  ) then
    raise exception 'Review other Storage read policies before protecting Portfolio';
  end if;
end $$;

update storage.buckets set public = false where id = 'Portfolio';

drop policy "Portfolio read" on storage.objects;
create policy "Portfolio authorized read" on storage.objects
  for select to authenticated
  using (bucket_id = 'Portfolio' and (select private.can_read_portfolio()));

commit;
