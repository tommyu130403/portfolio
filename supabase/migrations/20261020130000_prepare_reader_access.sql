-- Prepare the reader allowlist without changing existing read policies.
-- After this migration, create a dedicated Supabase Auth guest user and insert
-- its user_id into private.readers. Do not put its password in SQL or Git.

create table if not exists private.readers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.readers enable row level security;
revoke all on private.readers from public, anon, authenticated;

create or replace function private.is_reader()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.readers where user_id = (select auth.uid())
  )
$$;
revoke execute on function private.is_reader() from public, anon;
grant execute on function private.is_reader() to authenticated;

create or replace function private.can_read_portfolio()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select private.is_owner()) or (select private.is_reader())
$$;
revoke execute on function private.can_read_portfolio() from public, anon;
grant execute on function private.can_read_portfolio() to authenticated;

-- The client uses this only to choose the right screen. RLS remains the data gate.
create or replace function public.portfolio_access_role()
returns text
language sql stable security invoker
set search_path = ''
as $$
  select case
    when (select private.is_owner()) then 'owner'
    when (select private.is_reader()) then 'reader'
    else 'denied'
  end
$$;
revoke all on function public.portfolio_access_role() from public, anon;
grant execute on function public.portfolio_access_role() to authenticated;
notify pgrst, 'reload schema';
