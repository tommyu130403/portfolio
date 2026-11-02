-- Exact Portfolio object paths referenced by each saved work. The trigger
-- refreshes the index in the same transaction as every content change.

begin;

create table private.work_image_refs (
  work_id uuid not null references public.works(id) on delete cascade,
  object_path text not null,
  primary key (work_id, object_path)
);
create index work_image_refs_path_idx on private.work_image_refs (object_path);
alter table private.work_image_refs enable row level security;
revoke all on private.work_image_refs from public, anon, authenticated;

create function private.portfolio_path_from_url(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (pg_catalog.regexp_match(
    p_url,
    '^([Hh][Tt][Tt][Pp][Ss]?)://[^/]+/storage/v1/(object|render/image)/public/Portfolio/([^?#]+)([?#].*)?$'
  ))[3]
$$;

create function private.image_paths_in_markdown(p_markdown text)
returns setof text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line text;
  v_render_line text;
  v_match text[];
  v_path text;
  v_device text;
  v_src_count integer;
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
    v_match := pg_catalog.regexp_match(v_line, '^:::[ \t]*mockup[ \t]+(phone|laptop)([ \t]+[^ \t]+)*[ \t]*$');
    if v_match is not null then
      v_device := v_match[1];
      v_src_count := 0;
      for v_match in select pg_catalog.regexp_matches(v_line, '(^|[ \t])src=([^ \t]+)', 'g') loop
        if v_match[2] !~* '^https?://[^/[:space:]?#]+' and v_match[2] !~ '^/[^/\\]' then
          continue;
        end if;
        v_src_count := v_src_count + 1;
        if v_src_count > (case when v_device = 'phone' then 2 else 1 end) then exit; end if;
        v_path := private.portfolio_path_from_url(v_match[2]);
        if v_path is not null then return next v_path; end if;
      end loop;
      if v_src_count > 0 then continue; end if;
    end if;
    -- Inline code is displayed as text, not as an image by WorkMarkdown.
    v_render_line := pg_catalog.regexp_replace(v_line, '`[^`]+`', '', 'g');
    for v_match in select pg_catalog.regexp_matches(v_render_line, '!\[[^]]*\]\(([^)[:space:]]+)\)', 'g') loop
      v_path := private.portfolio_path_from_url(v_match[1]);
      if v_path is not null then return next v_path; end if;
    end loop;
  end loop;
end;
$$;

create function private.image_paths_in_work(p_work public.works)
returns setof text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_path text;
  v_value jsonb;
  v_section jsonb;
  v_block jsonb;
  v_layout text;
  v_limit integer;
begin
  v_path := private.portfolio_path_from_url(p_work.thumbnail_url);
  if v_path is not null then return next v_path; end if;

  if pg_catalog.jsonb_typeof(p_work.thumbnail) = 'object' then
    v_layout := p_work.thumbnail->>'layout';
    if v_layout in ('a1', 'a2', 'a3', 'd') then
      v_path := private.portfolio_path_from_url(p_work.thumbnail->>'logo_url');
      if v_path is not null then return next v_path; end if;
      if v_layout in ('a1', 'a2') then
        v_path := private.portfolio_path_from_url(p_work.thumbnail->>'desktop_url');
        if v_path is not null then return next v_path; end if;
      end if;
      if v_layout in ('a1', 'a3') and pg_catalog.jsonb_typeof(p_work.thumbnail->'mobile_urls') = 'array' then
        v_limit := case when v_layout = 'a1' then 1 else 2 end;
        for v_value in
          select value from pg_catalog.jsonb_array_elements(p_work.thumbnail->'mobile_urls')
          limit v_limit
        loop
          v_path := private.portfolio_path_from_url(v_value #>> '{}');
          if v_path is not null then return next v_path; end if;
        end loop;
      end if;
      if v_layout = 'd' and pg_catalog.jsonb_typeof(p_work.thumbnail->'capture_urls') = 'array' then
        for v_value in
          select value from pg_catalog.jsonb_array_elements(p_work.thumbnail->'capture_urls')
          limit 2
        loop
          v_path := private.portfolio_path_from_url(v_value #>> '{}');
          if v_path is not null then return next v_path; end if;
        end loop;
      end if;
    end if;
  end if;

  if pg_catalog.jsonb_typeof(p_work.hero_screenshots) = 'array' then
    for v_value in select value from pg_catalog.jsonb_array_elements(p_work.hero_screenshots) loop
      v_path := private.portfolio_path_from_url(v_value #>> '{}');
      if v_path is not null then return next v_path; end if;
    end loop;
  end if;

  if pg_catalog.jsonb_typeof(p_work.sections) = 'array' then
    for v_section in select value from pg_catalog.jsonb_array_elements(p_work.sections) loop
      if pg_catalog.jsonb_typeof(v_section->'blocks') = 'array' then
        for v_block in select value from pg_catalog.jsonb_array_elements(v_section->'blocks') loop
          if v_block->>'type' = 'image' then
            v_path := private.portfolio_path_from_url(v_block->>'url');
            if v_path is not null then return next v_path; end if;
          else
            return query select path from private.image_paths_in_markdown(
              coalesce(v_block->>'md', v_block->>'body', '')
            ) as paths(path);
          end if;
        end loop;
      else
        return query select path from private.image_paths_in_markdown(
          coalesce(v_section->>'body', '')
        ) as paths(path);
      end if;
    end loop;
  end if;
end;
$$;

create function private.refresh_work_image_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.work_image_refs where work_id = new.id;
  insert into private.work_image_refs (work_id, object_path)
    select distinct new.id, paths.path
    from private.image_paths_in_work(new) as paths(path)
    where paths.path <> ''
    on conflict do nothing;
  return new;
end;
$$;

create trigger refresh_work_image_refs
  after insert or update of thumbnail_url, thumbnail, hero_screenshots, sections
  on public.works
  for each row execute function private.refresh_work_image_refs();

insert into private.work_image_refs (work_id, object_path)
  select distinct w.id, paths.path
  from public.works w
  cross join lateral private.image_paths_in_work(w) as paths(path)
  where paths.path <> ''
  on conflict do nothing;

revoke execute on function private.portfolio_path_from_url(text) from public, anon, authenticated;
revoke execute on function private.image_paths_in_markdown(text) from public, anon, authenticated;
revoke execute on function private.image_paths_in_work(public.works) from public, anon, authenticated;
revoke execute on function private.refresh_work_image_refs() from public, anon, authenticated;

commit;
