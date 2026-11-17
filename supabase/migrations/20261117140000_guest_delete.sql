-- Delete an expired guest ID completely (auth account, allowlist row, memo).
--
-- IRREVERSIBLE: the auth.users row is removed; private.readers (and its note) goes with it
-- through ON DELETE CASCADE, and auth.identities / sessions cascade inside the auth schema.
-- There is no undo, so the function is guarded:
--   1. owner only ('forbidden' / 42501).
--   2. never an owner account ('cannot_delete_owner').
--   3. only an EXPIRED guest-ID account: email ends with @guest.invalid and expires_at is
--      set and already past. Unknown ids, still-valid guests and no-expiry (email-type)
--      readers are refused with 'not_deletable'. A valid guest must be stopped first.

create or replace function public.owner_delete_guest(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from private.owners o where o.user_id = p_user_id) then
    raise exception 'cannot_delete_owner';
  end if;

  if not exists (
    select 1
    from private.readers r
    join auth.users u on u.id = r.user_id
    where r.user_id = p_user_id
      and u.email like '%@guest.invalid'
      and r.expires_at is not null
      and r.expires_at <= now()
  ) then
    raise exception 'not_deletable';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.owner_delete_guest(uuid) from public, anon;
grant execute on function public.owner_delete_guest(uuid) to authenticated;

notify pgrst, 'reload schema';
