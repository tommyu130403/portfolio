-- Reader access to a flowchart requires an embed in a currently published work.
-- References are read from the saved work at query time, so changing a work's
-- published status immediately changes access without a separate index update.

begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flowcharts'
      and policyname = 'select_reader' and cmd = 'SELECT'
  ) then
    raise exception 'Expected flowcharts reader policy is missing';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flowcharts'
      and cmd in ('SELECT', 'ALL') and policyname <> 'select_reader'
  ) then
    raise exception 'Review other flowcharts read policies before narrowing reader access';
  end if;
end $$;

create function private.flowchart_ids_in_markdown(p_markdown text)
returns setof uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line text;
  v_match text[];
  v_in_fence boolean := false;
  v_in_html boolean := false;
begin
  foreach v_line in array pg_catalog.regexp_split_to_array(coalesce(p_markdown, ''), E'\r?\n') loop
    if v_in_html then
      if v_line ~ '^:::[ \t]*$' then v_in_html := false; end if;
      continue;
    end if;
    if v_in_fence then
      if v_line ~ '^```[ \t]*$' then v_in_fence := false; end if;
      continue;
    end if;
    if v_line ~ '^```[^`]*$' then
      v_in_fence := true;
      continue;
    end if;
    if v_line ~ '^:::[ \t]*html[ \t]*$' then
      v_in_html := true;
      continue;
    end if;
    v_match := pg_catalog.regexp_match(
      v_line,
      '^:::[ \t]*flowchart[ \t]+id[ \t]*=[ \t]*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})[ \t]*$'
    );
    if v_match is not null then return next v_match[1]::uuid; end if;
  end loop;
end;
$$;

create function private.flowchart_ids_in_sections(p_sections jsonb)
returns setof uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_section jsonb;
  v_block jsonb;
begin
  if pg_catalog.jsonb_typeof(p_sections) <> 'array' then return; end if;
  for v_section in select value from pg_catalog.jsonb_array_elements(p_sections) loop
    if pg_catalog.jsonb_typeof(v_section->'blocks') = 'array' then
      for v_block in select value from pg_catalog.jsonb_array_elements(v_section->'blocks') loop
        return query select refs.id from private.flowchart_ids_in_markdown(
          coalesce(v_block->>'md', v_block->>'body', '')
        ) as refs(id);
      end loop;
    else
      return query select refs.id from private.flowchart_ids_in_markdown(
        coalesce(v_section->>'body', '')
      ) as refs(id);
    end if;
  end loop;
end;
$$;

create function private.is_published_flowchart(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.works w
    where w.is_published
      and exists (
        select 1 from private.flowchart_ids_in_sections(w.sections) as refs(id)
        where refs.id = p_id
      )
  )
$$;

revoke execute on function private.flowchart_ids_in_markdown(text) from public, anon, authenticated;
revoke execute on function private.flowchart_ids_in_sections(jsonb) from public, anon, authenticated;
revoke execute on function private.is_published_flowchart(uuid) from public, anon;
grant execute on function private.is_published_flowchart(uuid) to authenticated;

drop policy select_reader on public.flowcharts;
create policy select_reader on public.flowcharts
  for select to authenticated
  using (
    (select private.is_owner()) or
    ((select private.is_reader()) and private.is_published_flowchart(id))
  );

commit;
