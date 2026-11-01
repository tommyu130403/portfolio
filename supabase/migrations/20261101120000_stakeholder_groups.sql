--
-- 何をするか:
--   1. マスタ stakeholder_groups を作り、Figma Master 848:2948 の 4 グループをアイコン付きで登録する。
--   2. roles に group_id（関係者グループ）と is_titled（役職フラグ）を足す。
--   3. works.stakeholders_legacy を足し、今の手描きの図を退避する（列を作った回だけ）。
--   4. 図を計算する private.compute_work_stakeholders と、作り直す private.refresh_* を作る。
--   5. save_work_with_relations / rename_role / delete_role を、図も作り直す版に置き換える。
--      保存関数は p_work->'stakeholders' を受け取っても使わない（図は常に紐付けから作る）。
--   6. グループ・役職を変える関数 5 本を作る（変えた役割を使う作品の図を同じトランザクションで作り直す）。
--   7. 全作品の図を作り直す。
--
-- 図の規則（lib/stakeholders.ts の buildStakeholders と同じ。片方を変えたら両方直す）:
--   - 体制内訳の行（並び順どおり）→ 体制内訳に無い担当役割を 1 名として後ろに足す
--   - 役割のグループごとにタイルを作る（グループの sort_order → 名前の順）。グループ未設定の役割は
--     名前もアイコンも無いタイル 1 つにまとめて最後に置く
--   - 役職の役割: 人数分のピルすべてに役割名。担当役割なら全部に「担当」
--   - 役職でない役割: 人数分の無名ピル。担当役割なら先頭の 1 つだけ「担当」
--
-- 適用順序（dev → 本番）:
--   0. 適用前に別の Run で次を流し、値を控える:
--        select count(*) as works_with_stakeholders from public.works where stakeholders is not null;
--   1. 本ファイル全体を Run。最後の結果表の legacy_saved が 0 の値と一致すること。
--   2. supabase/data/20261101_stakeholder_groups_verify.sql を番号ごとに Run。
--   3. 本番: フロントのデプロイ直前に適用 → 検証 → すぐデプロイ → マスタ管理でグループ・役職を設定する。
--      - 適用からデプロイまでの間、旧管理画面の Stakeholders 欄の編集は保存されない（保存関数が無視する）。
--      - 適用直後は全役割が「グループ未設定・役職なし」なので、公開ページの図は「名前なしタイル 1 つ + 無名ピル」になる。
--      - フロントを先にデプロイすると、管理画面が stakeholder_groups / roles.group_id を読めずエラーになる。
--
-- 再実行: 安全（表・列は if not exists、退避は列を作った回だけ、関数は create or replace、種は表が空のときだけ）。
--
-- ロールバック（先にフロントを本ファイル前の版へ戻してから、以下を順に流す）:
--   -- (1) 次の範囲を、この順にそのまま流す（いずれも create or replace）
--   --     20261028090000_work_thumbnail.sql の 30-232 行（save_work_with_relations）
--   --     20261022120000_masters_stage2a.sql の 506-562 行と 620-621 行（rename_role）
--   --     20261025120000_delete_role_cascade.sql の 13-68 行（delete_role）
--   -- (2) 図を手描きの版に戻し、新しい関数を消す
--   begin;
--   update public.works set stakeholders = stakeholders_legacy;
--   drop function if exists public.set_role_stakeholder_group(uuid, uuid);
--   drop function if exists public.set_role_titled(uuid, boolean);
--   drop function if exists public.rename_stakeholder_group(uuid, text);
--   drop function if exists public.set_stakeholder_group_icon(uuid, text);
--   drop function if exists public.delete_stakeholder_group(uuid);
--   drop function if exists private.refresh_role_works(uuid[]);
--   drop function if exists private.refresh_work_stakeholders(uuid[]);
--   drop function if exists private.compute_work_stakeholders(uuid);
--   notify pgrst, 'reload schema';
--   commit;
--   -- 列・表の削除（roles.group_id / roles.is_titled / public.stakeholder_groups / works.stakeholders_legacy）は
--   -- 設定済みのグループ・役職が消える破壊的操作なので、実行前に要承認。
--   -- ロールバック後に本ファイルを再適用する前に、退避列を要承認で消す（退避は列を作った回だけ行われるため）:
--   --   alter table public.works drop column stakeholders_legacy;

begin;

-- 0. 前提確認（想定どおりでなければここで止まり、何も変わらない）
do $$
begin
  if to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null then
    raise exception 'save_work_with_relations(jsonb,text[],text[],uuid[],jsonb) がありません。20261027120000 / 20261028090000 を先に適用してください';
  end if;
  if to_regprocedure('public.delete_role(uuid)') is null then
    raise exception 'delete_role(uuid) がありません。20261025120000 を先に適用してください';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'works' and column_name = 'thumbnail'
  ) then
    raise exception 'works.thumbnail がありません。20261028090000 を先に適用してください';
  end if;
end $$;

-- 1. 関係者グループのマスタ（名前は前後空白なし・空でない・重複なし。アイコンは "Set/name" か null）
create table if not exists public.stakeholder_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and name = btrim(name)),
  icon text check (icon is null or icon ~ '^[A-Za-z]+/[^/[:space:]]+$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. 権限（20261022120000 のマスタと同じ形。anon は読み書きとも不可）
alter table public.stakeholder_groups enable row level security;
revoke all on public.stakeholder_groups from anon, authenticated;
grant select, insert, update, delete on public.stakeholder_groups to authenticated;
drop policy if exists select_reader on public.stakeholder_groups;
drop policy if exists insert_owner on public.stakeholder_groups;
drop policy if exists update_owner on public.stakeholder_groups;
drop policy if exists delete_owner on public.stakeholder_groups;
create policy select_reader on public.stakeholder_groups for select to authenticated
  using ((select private.can_read_portfolio()));
create policy insert_owner on public.stakeholder_groups for insert to authenticated
  with check ((select private.is_owner()));
create policy update_owner on public.stakeholder_groups for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy delete_owner on public.stakeholder_groups for delete to authenticated
  using ((select private.is_owner()));

-- 3. 役割 → グループ / 役職フラグ（グループを消すと役割は「グループ未設定」に戻る）
alter table public.roles
  add column if not exists group_id uuid references public.stakeholder_groups(id) on delete set null,
  add column if not exists is_titled boolean not null default false;
create index if not exists roles_group_id_idx on public.roles(group_id);

-- 4. 手描きの図を退避する（列を作った回だけ。再実行で計算済みの値を上書きしない）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'works' and column_name = 'stakeholders_legacy'
  ) then
    alter table public.works add column stakeholders_legacy jsonb;
    update public.works set stakeholders_legacy = stakeholders where stakeholders is not null;
  end if;
end $$;

-- 5. 種（Figma Master 848:2948 の順）
do $$
begin
  if not exists (select 1 from public.stakeholder_groups) then
    insert into public.stakeholder_groups (name, icon, sort_order) values
      ('Product', 'Abstract/application-one', 1),
      ('Project', 'Components/tree-list', 2),
      ('Designer', 'Components/platte', 3),
      ('Engineer', 'Edit/code', 4);
  end if;
end $$;

-- 6. 図の計算と作り直し
create or replace function private.compute_work_stakeholders(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with role_rows as (
    -- 体制内訳の行（並び順どおり）
    select c.role_id, c.headcount, 0 as src, c.sort_order as ord
    from public.work_stakeholder_counts c
    where c.work_id = p_work_id
    union all
    -- 担当役割のうち体制内訳に無いもの（1 名として後ろに足す）
    select wr.role_id, 1, 1, wr.sort_order
    from public.work_roles wr
    where wr.work_id = p_work_id
      and not exists (
        select 1 from public.work_stakeholder_counts c2
        where c2.work_id = p_work_id and c2.role_id = wr.role_id
      )
  ),
  pills as (
    select r.group_id, rr.src, rr.ord, rr.role_id, s.i,
           jsonb_build_object(
             'label', case when r.is_titled then r.name else '' end,
             'me', case when r.is_titled then m.is_me else (m.is_me and s.i = 1) end
           ) as member
    from role_rows rr
    join public.roles r on r.id = rr.role_id
    cross join lateral (
      select exists (
        select 1 from public.work_roles x
        where x.work_id = p_work_id and x.role_id = rr.role_id
      ) as is_me
    ) m
    cross join lateral generate_series(1, rr.headcount) as s(i)
  ),
  grouped as (
    select p.group_id,
           jsonb_agg(p.member order by p.src, p.ord, p.role_id, p.i) as members
    from pills p
    group by p.group_id
  ),
  agg as (
    select jsonb_agg(
             jsonb_build_object(
               'label', coalesce(g.name, ''),
               'icon', g.icon,
               'members', gr.members
             )
             order by (gr.group_id is null), g.sort_order, g.name collate "C"
           ) as groups
    from grouped gr
    left join public.stakeholder_groups g on g.id = gr.group_id
  )
  select case when agg.groups is null then null else jsonb_build_object('groups', agg.groups) end
  from agg;
$$;

create or replace function private.refresh_work_stakeholders(p_work_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_work_ids is null or cardinality(p_work_ids) = 0 then
    return;
  end if;
  update public.works w
    set stakeholders = private.compute_work_stakeholders(w.id)
    where w.id = any(p_work_ids);
end;
$$;

-- 指定した役割を体制内訳・担当役割に使っている作品の図を作り直す
create or replace function private.refresh_role_works(p_role_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_role_ids is null or cardinality(p_role_ids) = 0 then
    return;
  end if;
  perform private.refresh_work_stakeholders(array(
    select c.work_id from public.work_stakeholder_counts c where c.role_id = any(p_role_ids)
    union
    select wr.work_id from public.work_roles wr where wr.role_id = any(p_role_ids)
  ));
end;
$$;

revoke all on function private.compute_work_stakeholders(uuid) from public, anon;
grant execute on function private.compute_work_stakeholders(uuid) to authenticated;
revoke all on function private.refresh_work_stakeholders(uuid[]) from public, anon;
grant execute on function private.refresh_work_stakeholders(uuid[]) to authenticated;
revoke all on function private.refresh_role_works(uuid[]) from public, anon;
grant execute on function private.refresh_role_works(uuid[]) to authenticated;

-- 7. 作品の保存関数（引数は変えない。stakeholders は受け取っても使わず、紐付けから作り直す）
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
  -- 体制内訳: null = 旧形式の文字をそのまま保存 / 配列 [{role_id, headcount}] = id と人数から作り直す
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
    hero_brand, hero_screenshots, hero_bg_color, sections,
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
      if coalesce(v_item->>'headcount', '') !~ '^[0-9]{1,3}$' then
        raise exception '体制内訳の人数は 1〜999 の整数で入力してください';
      end if;
      v_headcount := (v_item->>'headcount')::integer;
      if v_headcount < 1 then
        raise exception '体制内訳の人数は 1〜999 の整数で入力してください';
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
      insert into public.work_stakeholder_counts(work_id, role_id, headcount, sort_order)
        values (v_work_id, v_role_id, v_headcount, v_order);
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

-- 8. 役割の名前変更（20261022120000 と同じ + 関係者図の作り直し）
create or replace function public.rename_role(p_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new text := btrim(coalesce(p_name, ''));
  v_old text;
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can rename a role';
  end if;
  if v_new = '' then
    raise exception '役割名を入力してください';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select name into v_old from public.roles where id = p_id;
  if v_old is null then
    raise exception '役割が見つかりません';
  end if;
  if v_old = v_new then
    return;
  end if;
  if exists (select 1 from public.roles where name = v_new and id <> p_id) then
    raise exception '同じ名前の役割がすでにあります';
  end if;
  if v_new ~ '[・、,]' and (
    exists (select 1 from public.work_roles where role_id = p_id) or
    exists (select 1 from public.work_stakeholder_counts where role_id = p_id)
  ) then
    raise exception '作品で使われている役割の名前に「・」「、」「,」は使えません';
  end if;
  if v_new ~ '[0-9]' and exists (select 1 from public.work_stakeholder_counts where role_id = p_id) then
    raise exception '体制内訳で使われている役割の名前に半角数字は使えません';
  end if;
  update public.roles set name = v_new where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、役割が見つかりません';
  end if;
  update public.career_items set role = v_new where role_id = p_id;
  update public.works w set role = (
      select string_agg(r.name, '・' order by wr.sort_order)
      from public.work_roles wr join public.roles r on r.id = wr.role_id
      where wr.work_id = w.id
    )
    where exists (select 1 from public.work_roles x where x.work_id = w.id and x.role_id = p_id);
  update public.works w set stakeholder_breakdown = (
      select string_agg(r.name || c.headcount::text, '・' order by c.sort_order)
      from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
      where c.work_id = w.id
    )
    where exists (select 1 from public.work_stakeholder_counts x where x.work_id = w.id and x.role_id = p_id);
  -- 関係者図（役職の役割はピルに名前が出る）
  perform private.refresh_role_works(array[p_id]);
end;
$$;

revoke all on function public.rename_role(uuid, text) from public, anon;
grant execute on function public.rename_role(uuid, text) to authenticated;

-- 9. 役割の削除（20261025120000 と同じ + 関係者図の作り直し）
create or replace function public.delete_role(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exists boolean;
  v_rows integer;
  v_role_works uuid[];
  v_breakdown_works uuid[];
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can delete a role';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select exists (select 1 from public.roles where id = p_id) into v_exists;
  if not v_exists then
    raise exception '役割が見つかりません';
  end if;

  select array_agg(distinct work_id) into v_role_works
    from public.work_roles where role_id = p_id;
  select array_agg(distinct work_id) into v_breakdown_works
    from public.work_stakeholder_counts where role_id = p_id;

  update public.career_items set role_id = null where role_id = p_id;
  delete from public.work_roles where role_id = p_id;
  delete from public.work_stakeholder_counts where role_id = p_id;
  delete from public.roles where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、役割が見つかりません';
  end if;

  if v_role_works is not null then
    update public.works w set role = (
        select string_agg(r.name, '・' order by wr.sort_order)
        from public.work_roles wr join public.roles r on r.id = wr.role_id
        where wr.work_id = w.id
      )
      where w.id = any(v_role_works);
  end if;
  if v_breakdown_works is not null then
    update public.works w set stakeholder_breakdown = (
        select string_agg(r.name || c.headcount::text, '・' order by c.sort_order)
        from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
        where c.work_id = w.id
      )
      where w.id = any(v_breakdown_works);
  end if;
  -- 関係者図（紐付けはもう消えているので、控えておいた作品を作り直す）
  perform private.refresh_work_stakeholders(
    coalesce(v_role_works, array[]::uuid[]) || coalesce(v_breakdown_works, array[]::uuid[])
  );
end;
$$;

revoke all on function public.delete_role(uuid) from public, anon;
grant execute on function public.delete_role(uuid) to authenticated;

-- 10. 役割のグループ・役職を変える
create or replace function public.set_role_stakeholder_group(p_role_id uuid, p_group_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_found boolean;
  v_current uuid;
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can change a role group';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select true, group_id into v_found, v_current from public.roles where id = p_role_id;
  if v_found is null then
    raise exception '役割が見つかりません';
  end if;
  if p_group_id is not null and not exists (select 1 from public.stakeholder_groups where id = p_group_id) then
    raise exception '関係者グループが見つかりません';
  end if;
  if v_current is not distinct from p_group_id then
    return;
  end if;
  update public.roles set group_id = p_group_id where id = p_role_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、役割が見つかりません';
  end if;
  perform private.refresh_role_works(array[p_role_id]);
end;
$$;

create or replace function public.set_role_titled(p_role_id uuid, p_is_titled boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_found boolean;
  v_current boolean;
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can change a role';
  end if;
  if p_is_titled is null then
    raise exception '役職の指定がありません';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select true, is_titled into v_found, v_current from public.roles where id = p_role_id;
  if v_found is null then
    raise exception '役割が見つかりません';
  end if;
  if v_current = p_is_titled then
    return;
  end if;
  update public.roles set is_titled = p_is_titled where id = p_role_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、役割が見つかりません';
  end if;
  perform private.refresh_role_works(array[p_role_id]);
end;
$$;

-- 11. 関係者グループの名前変更・アイコン変更・削除
create or replace function public.rename_stakeholder_group(p_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new text := btrim(coalesce(p_name, ''));
  v_old text;
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can rename a stakeholder group';
  end if;
  if v_new = '' then
    raise exception 'グループ名を入力してください';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select name into v_old from public.stakeholder_groups where id = p_id;
  if v_old is null then
    raise exception '関係者グループが見つかりません';
  end if;
  if v_old = v_new then
    return;
  end if;
  if exists (select 1 from public.stakeholder_groups where name = v_new and id <> p_id) then
    raise exception '同じ名前の関係者グループがすでにあります';
  end if;
  update public.stakeholder_groups set name = v_new where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、関係者グループが見つかりません';
  end if;
  perform private.refresh_role_works(array(select r.id from public.roles r where r.group_id = p_id));
end;
$$;

create or replace function public.set_stakeholder_group_icon(p_id uuid, p_icon text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_icon text := nullif(btrim(coalesce(p_icon, '')), '');
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can change a stakeholder group';
  end if;
  if v_icon is not null and v_icon !~ '^[A-Za-z]+/[^/[:space:]]+$' then
    raise exception 'アイコンは「セット名/アイコン名」の形で指定してください';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  update public.stakeholder_groups set icon = v_icon where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、関係者グループが見つかりません';
  end if;
  perform private.refresh_role_works(array(select r.id from public.roles r where r.group_id = p_id));
end;
$$;

create or replace function public.delete_stakeholder_group(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_roles uuid[];
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can delete a stakeholder group';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  v_roles := array(select r.id from public.roles r where r.group_id = p_id);
  delete from public.stakeholder_groups where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、関係者グループが見つかりません';
  end if;
  -- roles.group_id は外部キー（on delete set null）で空になっている
  perform private.refresh_role_works(v_roles);
end;
$$;

revoke all on function public.set_role_stakeholder_group(uuid, uuid) from public, anon;
grant execute on function public.set_role_stakeholder_group(uuid, uuid) to authenticated;
revoke all on function public.set_role_titled(uuid, boolean) from public, anon;
grant execute on function public.set_role_titled(uuid, boolean) to authenticated;
revoke all on function public.rename_stakeholder_group(uuid, text) from public, anon;
grant execute on function public.rename_stakeholder_group(uuid, text) to authenticated;
revoke all on function public.set_stakeholder_group_icon(uuid, text) from public, anon;
grant execute on function public.set_stakeholder_group_icon(uuid, text) to authenticated;
revoke all on function public.delete_stakeholder_group(uuid) from public, anon;
grant execute on function public.delete_stakeholder_group(uuid) to authenticated;

-- 事前割当（任意）: supabase/data/20261101_stakeholder_groups_preassign.sql をここで流す運用。本体には含めない。

-- 12. 全作品の図を作り直す
update public.works set stakeholders = private.compute_work_stakeholders(id);

notify pgrst, 'reload schema';

commit;

-- 13. 結果（この表を控えて報告する）
select
  (select count(*) from public.stakeholder_groups) as groups,
  (select string_agg(name || '=' || coalesce(icon, '-'), ' / ' order by sort_order) from public.stakeholder_groups) as group_list,
  (select count(*) from public.works) as works,
  (select count(*) from public.works where stakeholders_legacy is not null) as legacy_saved,
  (select count(*) from public.works where stakeholders is not null) as derived,
  (select count(*) from public.works where stakeholders_legacy is not null and stakeholders is null) as diagram_removed,
  (select string_agg(title, ' / ' order by sort_order) from public.works
     where stakeholders_legacy is not null and stakeholders is null) as diagram_removed_titles,
  (select count(*) from public.works where stakeholders_legacy is null and stakeholders is not null) as diagram_added;
