-- Save one work, its skill links, and its tool links in one database transaction.
-- The function uses the caller's RLS permissions and additionally requires the
-- owner identity. Do not deploy the new editor before this migration is applied.

create or replace function public.save_work_with_relations(
  p_work jsonb,
  p_skill_labels text[],
  p_tool_names text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_skill_id uuid;
  v_tool_id uuid;
  v_label text;
  v_name text;
  v_order integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can save a work';
  end if;
  if p_work is null or jsonb_typeof(p_work) <> 'object' then
    raise exception 'Invalid work payload';
  end if;
  v_work_id := (p_work->>'id')::uuid;
  if v_work_id is null or btrim(coalesce(p_work->>'title', '')) = '' then
    raise exception 'Work id and title are required';
  end if;

  -- Serialize saves from this editor, including new sort order and vocabulary.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select coalesce(max(sort_order), -1) + 1 into v_order from public.works;

  insert into public.works (
    id, title, category, thumbnail_url, role, period, timeline,
    stakeholders, hero_brand, hero_screenshots, hero_bg_color, sections,
    stakeholder_breakdown, sort_order, career_item_id, is_published
  ) values (
    v_work_id,
    p_work->>'title',
    p_work->>'category',
    p_work->>'thumbnail_url',
    p_work->>'role',
    p_work->>'period',
    p_work->'timeline',
    p_work->'stakeholders',
    p_work->>'hero_brand',
    coalesce(p_work->'hero_screenshots', '[]'::jsonb),
    p_work->>'hero_bg_color',
    p_work->'sections',
    p_work->>'stakeholder_breakdown',
    v_order,
    nullif(p_work->>'career_item_id', '')::uuid,
    coalesce((p_work->>'is_published')::boolean, true)
  ) on conflict (id) do update set
    title = excluded.title,
    category = excluded.category,
    thumbnail_url = excluded.thumbnail_url,
    role = excluded.role,
    period = excluded.period,
    timeline = excluded.timeline,
    stakeholders = excluded.stakeholders,
    hero_brand = excluded.hero_brand,
    hero_screenshots = excluded.hero_screenshots,
    hero_bg_color = excluded.hero_bg_color,
    sections = excluded.sections,
    stakeholder_breakdown = excluded.stakeholder_breakdown,
    career_item_id = excluded.career_item_id,
    is_published = excluded.is_published;

  delete from public.work_skills where work_id = v_work_id;
  v_order := 0;
  foreach v_label in array coalesce(p_skill_labels, array[]::text[]) loop
    v_label := btrim(v_label);
    if v_label is null or v_label = '' then continue; end if;
    select id into v_skill_id from public.skills_vocab
      where lower(label) = lower(v_label) order by id limit 1;
    if v_skill_id is null then
      insert into public.skills_vocab(label) values (v_label) returning id into v_skill_id;
    end if;
    if exists (select 1 from public.work_skills where work_id = v_work_id and skill_id = v_skill_id) then
      continue;
    end if;
    insert into public.work_skills(work_id, skill_id, sort_order)
      values (v_work_id, v_skill_id, v_order);
    v_order := v_order + 1;
  end loop;

  delete from public.work_tools where work_id = v_work_id;
  v_order := 0;
  foreach v_name in array coalesce(p_tool_names, array[]::text[]) loop
    v_name := btrim(v_name);
    if v_name is null or v_name = '' then continue; end if;
    select id into v_tool_id from public.tools_vocab
      where lower(name) = lower(v_name) order by id limit 1;
    if v_tool_id is null then
      insert into public.tools_vocab(name) values (v_name) returning id into v_tool_id;
    end if;
    if exists (select 1 from public.work_tools where work_id = v_work_id and tool_id = v_tool_id) then
      continue;
    end if;
    insert into public.work_tools(work_id, tool_id, sort_order)
      values (v_work_id, v_tool_id, v_order);
    v_order := v_order + 1;
  end loop;
end;
$$;

revoke all on function public.save_work_with_relations(jsonb, text[], text[]) from public, anon;
grant execute on function public.save_work_with_relations(jsonb, text[], text[]) to authenticated;
notify pgrst, 'reload schema';
