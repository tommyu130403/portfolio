-- Guest ID memo: record who each issued guest ID was given to (e.g. "company / person").
--
-- What this migration does:
--   1. private.readers.note (nullable text, max 200 chars enforced in the RPC).
--   2. public.owner_set_guest_note(p_user_id, p_note): owner-only. Trims, stores empty as NULL,
--      rejects > 200 chars ('note_too_long') and unknown guests ('guest_not_found').
--   3. public.owner_list_guests() now also returns note. The return type changes, so the function
--      is dropped and recreated (grants re-applied).
--
-- The Edge Function guest-admin is unchanged: it only reads login_id / expires_at / user_id.

alter table private.readers add column if not exists note text;

create or replace function public.owner_set_guest_note(p_user_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_note text;
begin
  if not (select private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Strip ASCII and full-width (U+3000) spaces, tabs and newlines.
  v_note := nullif(btrim(coalesce(p_note, ''), E' \t\r\n\u3000'), '');

  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'note_too_long';
  end if;

  update private.readers r
  set note = v_note
  where r.user_id = p_user_id;

  if not found then
    raise exception 'guest_not_found';
  end if;
end;
$$;
revoke all on function public.owner_set_guest_note(uuid, text) from public, anon;
grant execute on function public.owner_set_guest_note(uuid, text) to authenticated;

drop function if exists public.owner_list_guests();

-- Owner-only: every reader, expired ones included (kept as records).
create or replace function public.owner_list_guests()
returns table (
  user_id uuid,
  login_id text,
  created_at timestamptz,
  expires_at timestamptz,
  last_sign_in_at timestamptz,
  note text
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
    u.last_sign_in_at,
    r.note
  from private.readers r
  join auth.users u on u.id = r.user_id
  order by r.created_at desc;
end;
$$;
revoke all on function public.owner_list_guests() from public, anon;
grant execute on function public.owner_list_guests() to authenticated;

notify pgrst, 'reload schema';
