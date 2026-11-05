-- 作品に「ヒーローの構成」(works.hero_layout text) を追加し、保存関数がその列を保存するようにする。
--
-- 目的: 作品詳細ページ最上部のヒーロー画像を、管理画面で構成の種類を選んで出すため。
--       値は none（出さない）/ sp2（スマホ 2 台）/ pcsp（PC + スマホ）/ pc（PC のみ）/ images（画像 1〜3 枚・枠なし）。
--       画像の URL は既存の hero_screenshots（配列）に位置どおりで入れる（空き枠は ""）。
--       NULL は旧形式（画像の縦横で枠を自動判定）。既存の行は変えない。
--       保存関数 save_work_with_relations は 20261105130000_stakeholder_teams.sql と同じで、
--       引数の形も変えず、hero_layout の保存だけを足す (create or replace)。
--
-- 適用順序:
--   1. dev に適用 → 検証 SQL (supabase/data/20261105_work_hero_layout_verify.sql) を流す。
--   2. 本番へ適用する。フロントは先にデプロイしても壊れない（作品の取得は select("*") で、列が無ければ旧形式として描く）。
--      ただし適用前は管理画面で選んだ構成が保存されない（保存関数が hero_layout を無視する）。
--   - 再実行しても安全 (列は if not exists、制約は drop してから add、関数は create or replace)。
--
-- ロールバック:
--   - 保存関数は 20261105130000_stakeholder_teams.sql の 164-413 行をそのまま流し直すと元に戻る。
--   - 列の drop (alter table public.works drop column hero_layout) は選んだ構成が消える破壊的操作なので、実行前に要承認。
--     先に制約を外す: alter table public.works drop constraint if exists works_hero_layout_check;

begin;

-- 前提確認: 20261105130000_stakeholder_teams.sql が適用済みであること (保存関数・関係者図の計算関数がある)
do $$
begin
  if to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null
     or to_regprocedure('private.compute_work_stakeholders(uuid)') is null then
    raise exception 'save_work_with_relations / compute_work_stakeholders がありません。先に 20261105130000_stakeholder_teams.sql を適用してください';
  end if;
end $$;

alter table public.works add column if not exists hero_layout text;

alter table public.works drop constraint if exists works_hero_layout_check;
alter table public.works
  add constraint works_hero_layout_check
  check (hero_layout is null or hero_layout in ('none', 'sp2', 'pcsp', 'pc', 'images'));

create or replace function public.save_work_with_relations(
  p_work jsonb,
  p_content_labels text[],
  p_tool_names text[],
  p_role_ids uuid[],
  p_stakeholder_counts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_content_id uuid;
  v_tool_id uuid;
  v_role_id uuid;
  v_label text;
  v_name text;
  v_item jsonb;
  v_headcount integer;
  v_note text;
  v_teams jsonb;
  v_team jsonb;
  v_team_name text;
  v_team_headcount integer;
  v_teams_norm jsonb;
  v_order integer;
  v_legacy_breakdown boolean;
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
  -- 体制内訳: null = 旧形式の文字をそのまま保存 / 配列 [{role_id, headcount, note?, teams?}] = id と人数から作り直す
  v_legacy_breakdown := p_stakeholder_counts is null or jsonb_typeof(p_stakeholder_counts) = 'null';
  if not v_legacy_breakdown and jsonb_typeof(p_stakeholder_counts) <> 'array' then
    raise exception '体制内訳の形式が正しくありません';
  end if;

  -- 保存と改名を直列にする（並び順・語彙・文字の列・関係者図の作り直しが混ざらないように）
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select coalesce(max(sort_order), -1) + 1 into v_order from public.works;

  -- role / stakeholder_breakdown はいったん受け取った値で入れ、最後に紐付けから作り直す
  -- stakeholders（関係者図）は受け取らない。最後に紐付けとマスタから作り直す
  -- period は、start_date があればトリガー works_sync_period が日付から作り直す（無ければ受け取った文字のまま）
  insert into public.works (
    id, title, category, thumbnail_url, thumbnail, role, period, start_date, end_date, is_current, timeline,
    hero_brand, hero_screenshots, hero_layout, hero_bg_color, sections,
    stakeholder_breakdown, sort_order, career_item_id, is_published
  ) values (
    v_work_id,
    p_work->>'title',
    p_work->>'category',
    p_work->>'thumbnail_url',
    case when jsonb_typeof(p_work->'thumbnail') = 'object' then p_work->'thumbnail' else null end,
    p_work->>'role',
    p_work->>'period',
    nullif(p_work->>'start_date', '')::date,
    nullif(p_work->>'end_date', '')::date,
    coalesce((p_work->>'is_current')::boolean, false),
    p_work->'timeline',
    p_work->>'hero_brand',
    coalesce(p_work->'hero_screenshots', '[]'::jsonb),
    case when p_work->>'hero_layout' in ('none', 'sp2', 'pcsp', 'pc', 'images') then p_work->>'hero_layout' else null end,
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
    thumbnail = excluded.thumbnail,
    role = excluded.role,
    period = excluded.period,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = excluded.is_current,
    timeline = excluded.timeline,
    hero_brand = excluded.hero_brand,
    hero_screenshots = excluded.hero_screenshots,
    hero_layout = excluded.hero_layout,
    hero_bg_color = excluded.hero_bg_color,
    sections = excluded.sections,
    stakeholder_breakdown = excluded.stakeholder_breakdown,
    career_item_id = excluded.career_item_id,
    is_published = excluded.is_published;

  -- 制作内容（旧スキルと同じ手順。保存先は work_contents と contents_vocab）
  delete from public.work_contents where work_id = v_work_id;
  v_order := 0;
  foreach v_label in array coalesce(p_content_labels, array[]::text[]) loop
    v_label := btrim(v_label);
    if v_label is null or v_label = '' then continue; end if;
    select id into v_content_id from public.contents_vocab
      where lower(label) = lower(v_label) order by id limit 1;
    if v_content_id is null then
      insert into public.contents_vocab(label) values (v_label) returning id into v_content_id;
    end if;
    if exists (select 1 from public.work_contents where work_id = v_work_id and content_id = v_content_id) then
      continue;
    end if;
    insert into public.work_contents(work_id, content_id, sort_order) values (v_work_id, v_content_id, v_order);
    v_order := v_order + 1;
  end loop;

  -- ツール（20261020130500 と同じ）
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
    insert into public.work_tools(work_id, tool_id, sort_order) values (v_work_id, v_tool_id, v_order);
    v_order := v_order + 1;
  end loop;

  -- 担当役割（選んだ順。同じ役割は 1 回だけ）
  delete from public.work_roles where work_id = v_work_id;
  v_order := 0;
  foreach v_role_id in array coalesce(p_role_ids, array[]::uuid[]) loop
    if v_role_id is null then continue; end if;
    select name into v_name from public.roles where id = v_role_id;
    if v_name is null then
      raise exception '選んだ役割が見つかりません（マスタから削除された可能性があります）';
    end if;
    if v_name ~ '[・、,]' then
      raise exception '役割「%」は「・」「、」「,」を含むため、作品の担当役割には使えません', v_name;
    end if;
    if exists (select 1 from public.work_roles where work_id = v_work_id and role_id = v_role_id) then
      continue;
    end if;
    insert into public.work_roles(work_id, role_id, sort_order) values (v_work_id, v_role_id, v_order);
    v_order := v_order + 1;
  end loop;

  -- 体制内訳
  delete from public.work_stakeholder_counts where work_id = v_work_id;
  if not v_legacy_breakdown then
    v_order := 0;
    for v_item in
      select e.value
      from jsonb_array_elements(p_stakeholder_counts) with ordinality as e(value, ord)
      order by e.ord
    loop
      if jsonb_typeof(v_item) <> 'object' or nullif(v_item->>'role_id', '') is null then
        raise exception '体制内訳に役割が選ばれていない行があります';
      end if;
      if jsonb_typeof(v_item->'note') not in ('string', 'null') then
        raise exception '体制内訳のメモの形式が正しくありません';
      end if;
      v_note := nullif(btrim(coalesce(v_item->>'note', '')), '');
      -- チーム: 配列（または無し・null）。1 つ以上あれば人数はチームの合計にする（org は読まない）
      v_teams := v_item->'teams';
      v_teams_norm := '[]'::jsonb;
      if v_teams is not null and jsonb_typeof(v_teams) <> 'null' then
        if jsonb_typeof(v_teams) <> 'array' then
          raise exception '体制内訳のチームの形式が正しくありません';
        end if;
        for v_team in select e.value from jsonb_array_elements(v_teams) with ordinality as e(value, ord) order by e.ord loop
          if jsonb_typeof(v_team) <> 'object' or jsonb_typeof(v_team->'name') is distinct from 'string' then
            raise exception '体制内訳のチームの形式が正しくありません';
          end if;
          v_team_name := btrim(v_team->>'name');
          if v_team_name = '' then
            raise exception 'チーム名を入力してください';
          end if;
          if jsonb_typeof(v_team->'headcount') is distinct from 'number'
             or coalesce(v_team->>'headcount', '') !~ '^[0-9]{1,3}$' then
            raise exception 'チームの人数は 1〜999 の整数で入力してください';
          end if;
          v_team_headcount := (v_team->>'headcount')::integer;
          if v_team_headcount < 1 then
            raise exception 'チームの人数は 1〜999 の整数で入力してください';
          end if;
          v_teams_norm := v_teams_norm || jsonb_build_array(
            jsonb_build_object('name', v_team_name, 'headcount', v_team_headcount)
          );
        end loop;
      end if;
      if jsonb_array_length(v_teams_norm) > 0 then
        select sum((t->>'headcount')::integer) into v_headcount from jsonb_array_elements(v_teams_norm) t;
        if v_headcount > 999 then
          raise exception '体制内訳の人数（チームの合計）は 999 以下にしてください';
        end if;
      else
        if coalesce(v_item->>'headcount', '') !~ '^[0-9]{1,3}$' then
          raise exception '体制内訳の人数は 1〜999 の整数で入力してください';
        end if;
        v_headcount := (v_item->>'headcount')::integer;
        if v_headcount < 1 then
          raise exception '体制内訳の人数は 1〜999 の整数で入力してください';
        end if;
      end if;
      v_role_id := (v_item->>'role_id')::uuid;
      select name into v_name from public.roles where id = v_role_id;
      if v_name is null then
        raise exception '体制内訳で選んだ役割が見つかりません（マスタから削除された可能性があります）';
      end if;
      if v_name ~ '[0-9・、,]' then
        raise exception '役割「%」は半角数字や「・」「、」「,」を含むため、体制内訳には使えません', v_name;
      end if;
      if exists (select 1 from public.work_stakeholder_counts where work_id = v_work_id and role_id = v_role_id) then
        raise exception '体制内訳に同じ役割「%」が複数あります', v_name;
      end if;
      insert into public.work_stakeholder_counts(work_id, role_id, headcount, sort_order, note, org, teams)
        values (v_work_id, v_role_id, v_headcount, v_order, v_note, null, v_teams_norm);
      v_order := v_order + 1;
    end loop;
  end if;

  -- 公開サイトが読む文字の列を紐付けから作り直す（WorkDetailHeader.tsx の分解規則で元に戻る形）
  update public.works w set
    role = (
      select string_agg(r.name, '・' order by wr.sort_order)
      from public.work_roles wr join public.roles r on r.id = wr.role_id
      where wr.work_id = w.id
    ),
    stakeholder_breakdown = case
      when v_legacy_breakdown then nullif(p_work->>'stakeholder_breakdown', '')
      else (
        select string_agg(r.name || c.headcount::text, '・' order by c.sort_order)
        from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
        where c.work_id = w.id
      )
    end
  where w.id = v_work_id;

  -- 関係者図を紐付けとマスタから作り直す
  perform private.refresh_work_stakeholders(array[v_work_id]);
end;
$$;

revoke all on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) from public, anon;
grant execute on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
