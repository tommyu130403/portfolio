-- Guest ID login with a 30-day expiry.
--
-- What this migration does:
--   1. private.readers.expires_at (NULL = no expiry, so the existing Gmail guest keeps working).
--   2. private.is_reader() now ignores expired rows; private.is_expired_reader() detects them.
--   3. public.portfolio_access_role() additionally returns 'expired'.
--   4. Owner-only RPCs: owner_register_guest / owner_list_guests / owner_stop_guest.
--      Guest accounts are created by the Edge Function guest-admin with the reserved
--      domain @guest.invalid (RFC 2606, can never receive mail). Expiry is computed here, not by the client.
--   5. public.guest_access_token_hook: refuses to issue tokens (login and refresh) to expired guests.
--
-- MANUAL STEP after applying: enable the hook in the Supabase Dashboard ->
--   Authentication -> Hooks -> Custom Access Token -> Postgres -> public.guest_access_token_hook

alter table private.readers add column if not exists expires_at timestamptz;

create or replace function private.is_reader()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.readers
    where user_id = (select auth.uid())
      and (expires_at is null or expires_at > now())
  )
$$;
revoke execute on function private.is_reader() from public, anon;
grant execute on function private.is_reader() to authenticated;

create or replace function private.is_expired_reader()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.readers
    where user_id = (select auth.uid())
      and expires_at is not null
      and expires_at <= now()
  )
$$;
revoke execute on function private.is_expired_reader() from public, anon;
grant execute on function private.is_expired_reader() to authenticated;

create or replace function public.portfolio_access_role()
returns text
language sql stable security invoker
set search_path = ''
as $$
  select case
    when (select private.is_owner()) then 'owner'
    when (select private.is_reader()) then 'reader'
    when (select private.is_expired_reader()) then 'expired'
    else 'denied'
  end
$$;
revoke all on function public.portfolio_access_role() from public, anon;
grant execute on function public.portfolio_access_role() to authenticated;

-- Owner-only: link a freshly created guest auth user to the allowlist with a 30-day expiry.
create or replace function public.owner_register_guest(p_user_id uuid)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  if not (select private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email like '%@guest.invalid'
  ) then
    raise exception 'not_a_guest_account';
  end if;

  insert into private.readers (user_id, expires_at)
  values (p_user_id, now() + interval '30 days')
  returning private.readers.expires_at into v_expires;

  return v_expires;
end;
$$;
revoke all on function public.owner_register_guest(uuid) from public, anon;
grant execute on function public.owner_register_guest(uuid) to authenticated;

-- Owner-only: every reader, expired ones included (kept as records).
create or replace function public.owner_list_guests()
returns table (
  user_id uuid,
  login_id text,
  created_at timestamptz,
  expires_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    r.user_id,
    case
      when u.email like '%@guest.invalid' then split_part(u.email, '@', 1)
      else u.email
    end::text,
    r.created_at,
    r.expires_at,
    u.last_sign_in_at
  from private.readers r
  join auth.users u on u.id = r.user_id
  order by r.created_at desc;
end;
$$;
revoke all on function public.owner_list_guests() from public, anon;
grant execute on function public.owner_list_guests() to authenticated;

-- Owner-only: expire a guest right now (already-expired rows are left untouched).
create or replace function public.owner_stop_guest(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update private.readers r
  set expires_at = now()
  where r.user_id = p_user_id
    and (r.expires_at is null or r.expires_at > now())
    and not exists (select 1 from private.owners o where o.user_id = r.user_id);
end;
$$;
revoke all on function public.owner_stop_guest(uuid) from public, anon;
grant execute on function public.owner_stop_guest(uuid) to authenticated;

-- Custom Access Token hook. Runs as supabase_auth_admin without a user JWT, so it must not
-- call is_reader()/auth.uid(); it looks the user up directly.
-- Fail-open on purpose: if this hook ever errors, it returns the event unchanged so a hook bug
-- can never lock out the owner. Data stays protected by RLS (is_reader ignores expired rows).
create or replace function public.guest_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  begin
    if exists (
      select 1 from private.readers r
      where r.user_id = (event->>'user_id')::uuid
        and r.expires_at is not null
        and r.expires_at <= now()
        and not exists (select 1 from private.owners o where o.user_id = r.user_id)
    ) then
      return jsonb_build_object(
        'error', jsonb_build_object('http_code', 403, 'message', 'guest_access_expired')
      );
    end if;
    return event;
  exception when others then
    return event;
  end;
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.guest_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.guest_access_token_hook(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
