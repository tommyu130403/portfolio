create table if not exists public.flowcharts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  data jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.flowcharts enable row level security;

drop policy if exists "public read flowcharts" on public.flowcharts;
create policy "public read flowcharts"
  on public.flowcharts
  as permissive
  for select
  to public
  using (true);

drop policy if exists "auth write flowcharts" on public.flowcharts;
create policy "auth write flowcharts"
  on public.flowcharts
  as permissive
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "anon full access flowcharts" on public.flowcharts;
create policy "anon full access flowcharts"
  on public.flowcharts
  as permissive
  for all
  to anon
  using (true)
  with check (true);
