-- 関係者図を「層ごとにカードを並べる」形（F1）へ変える。
--
-- 何をするか:
--   1. stakeholder_groups に note（層のメモ）、work_stakeholder_counts に note / org（行のメモ・組織）を足す。
--   2. private.compute_work_stakeholders を、{ v: 2, layers: [...] } を返す版に置き換える。
--   3. save_work_with_relations を、体制内訳の行の note / org も保存する版に置き換える（引数は変えない）。
--   4. 層のメモを変える public.set_stakeholder_group_note を作る（使う作品の図を同じトランザクションで作り直す）。
--   5. 全作品の図を作り直す。
--   理由: 図を「意思決定・マネジメント・設計・開発」の層に分け、組織ごとにカードをまとめて見せるため。
--   roles.is_titled は残すが、図の計算では読まない。
--
-- 図の規則（lib/stakeholders.ts の buildStakeholders と同じ。片方を変えたら両方直す）:
--   - 体制内訳の行（並び順どおり）→ 体制内訳に無い担当役割を 1 名（メモ・組織なし）として後ろに足す
--   - 役割のグループごとに層を作る（グループの sort_order → 名前の順）。グループ未設定の役割は
--     名前もメモも無い層 1 つにまとめて最後に置く
--   - 組織が空の行: 役割カード（メモが無ければ「{人数}名」）
--   - 組織がある行: 同じ層・同じ組織の行を 1 枚の組織カードにまとめ、最初に出た位置に置く
--     行の文字 = 役割名 + （メモ）+ 人数が 2 以上なら「 ×人数」
--   - 担当役割（work_roles）に入っている役割は me = true
--
-- 適用順序（dev → 本番）:
--   0. 20261101120000 を先に適用済みであること（無ければ本ファイルは前提確認で止まる）。
--   1. 本ファイル全体を Run。最後の結果表の derived が、適用前の「図がある作品数」と一致すること。
--   2. supabase/data/20261101_stakeholder_layers_verify.sql を番号ごとに Run。
--   3. 本番: PR をマージする直前に適用 → 検証 1〜4 → マージ（デプロイ）。
--      - 適用からデプロイまでの間、旧フロントの parseStakeholders は新しい形を読めず null を返す。
--        図のボタンが隠れるだけで、画面は壊れない。
--      - フロントを先にデプロイすると、管理画面が新しい列（note / org）を select してエラーになる。禁止。
--
-- 再実行: 安全（列は add column if not exists、制約は無ければ付ける、関数は create or replace、図は毎回作り直す）。
--
-- ロールバック（SQL だけ戻すと新フロントの層メモ保存が失敗し、プレビューと公開ページの形もずれる。フロントも本ファイル前の版へ戻してから流す）:
--   -- (1) 20261101120000_stakeholder_groups.sql の次の範囲を、この順にそのまま流す（いずれも create or replace）
--   --     130-188 行（compute_work_stakeholders）
--   --     233-437 行（save_work_with_relations）
--   -- (2) 新しい関数を消し、全作品の図を作り直す
--   begin;
--   drop function if exists public.set_stakeholder_group_note(uuid, text);
--   update public.works set stakeholders = private.compute_work_stakeholders(id);
--   notify pgrst, 'reload schema';
--   commit;
--   -- 列（stakeholder_groups.note / work_stakeholder_counts.note / work_stakeholder_counts.org）の削除は
--   -- 入力済みのメモ・組織が消える破壊的操作なので、実行前に要承認。
--   -- 注意: 旧 save_work_with_relations は note / org を無視して行を作り直すため、旧版のまま保存するとメモ・組織が消える。

begin;

-- 0. 前提確認（想定どおりでなければここで止まり、何も変わらない）
do $$
begin
  if to_regprocedure('private.compute_work_stakeholders(uuid)') is null
     or to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null
     or to_regprocedure('public.rename_stakeholder_group(uuid,text)') is null
     or to_regclass('public.stakeholder_groups') is null then
    raise exception '20261101120000 を先に適用してください';
  end if;
end $$;

-- 1. 列を足す（空文字・前後空白は持たない。無ければ null）
alter table public.stakeholder_groups
  add column if not exists note text;
alter table public.work_stakeholder_counts
  add column if not exists note text,
  add column if not exists org text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stakeholder_groups_note_check'
                 and conrelid = 'public.stakeholder_groups'::regclass) then
    alter table public.stakeholder_groups
      add constraint stakeholder_groups_note_check
      check (note is null or (note <> '' and note = btrim(note)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'work_stakeholder_counts_note_check'
                 and conrelid = 'public.work_stakeholder_counts'::regclass) then
    alter table public.work_stakeholder_counts
      add constraint work_stakeholder_counts_note_check
      check (note is null or (note <> '' and note = btrim(note)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'work_stakeholder_counts_org_check'
                 and conrelid = 'public.work_stakeholder_counts'::regclass) then
    alter table public.work_stakeholder_counts
      add constraint work_stakeholder_counts_org_check
      check (org is null or (org <> '' and org = btrim(org)));
  end if;
end $$;

-- 2. 図の計算（{ v: 2, layers: [{ name, note, cards }] }）
create or replace function private.compute_work_stakeholders(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with role_rows as (
    -- 体制内訳の行（並び順どおり）
    select c.role_id, c.headcount, c.note, c.org, 0 as src, c.sort_order as ord
    from public.work_stakeholder_counts c
    where c.work_id = p_work_id
    union all
    -- 担当役割のうち体制内訳に無いもの（1 名として後ろに足す）
    select wr.role_id, 1, null, null, 1, wr.sort_order
    from public.work_roles wr
    where wr.work_id = p_work_id
      and not exists (
        select 1 from public.work_stakeholder_counts c2
        where c2.work_id = p_work_id and c2.role_id = wr.role_id
      )
  ),
  entries as (
    select r.group_id, rr.role_id, r.name, rr.headcount, rr.note, rr.org, m.is_me,
           row_number() over (partition by r.group_id order by rr.src, rr.ord, rr.role_id) as pos
    from role_rows rr
    join public.roles r on r.id = rr.role_id
    cross join lateral (
      select exists (
        select 1 from public.work_roles x
        where x.work_id = p_work_id and x.role_id = rr.role_id
      ) as is_me
    ) m
  ),
  cards as (
    select e.group_id, e.pos as card_pos,
           jsonb_build_object(
             'kind', 'role',
             'name', e.name,
             'note', coalesce(e.note, e.headcount::text || '名'),
             'me', e.is_me
           ) as card
    from entries e
    where e.org is null
    union all
    select e.group_id, min(e.pos) as card_pos,
           jsonb_build_object(
             'kind', 'org',
             'title', e.org,
             'rows', jsonb_agg(
               jsonb_build_object(
                 'text', e.name
                         || coalesce('（' || e.note || '）', '')
                         || case when e.headcount > 1 then ' ×' || e.headcount::text else '' end,
                 'me', e.is_me
               ) order by e.pos
             )
           ) as card
    from entries e
    where e.org is not null
    group by e.group_id, e.org
  ),
  layers as (
    select c.group_id, jsonb_agg(c.card order by c.card_pos) as cards
    from cards c
    group by c.group_id
  ),
  agg as (
    select jsonb_agg(
             jsonb_build_object(
               'name', coalesce(g.name, ''),
               'note', g.note,
               'cards', l.cards
             )
             order by (l.group_id is null), g.sort_order, g.name collate "C"
           ) as layers
    from layers l
    left join public.stakeholder_groups g on g.id = l.group_id
  )
  select case when agg.layers is null then null else jsonb_build_object('v', 2, 'layers', agg.layers) end
  from agg;
$$;


-- 3. 作品の保存関数（20261101120000 と同じ。体制内訳の行に note / org を受け取って保存する点だけ違う）
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
  v_org text;
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
  -- 体制内訳: null = 旧形式の文字をそのまま保存 / 配列 [{role_id, headcount, note?, org?}] = id と人数から作り直す
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
      if jsonb_typeof(v_item->'note') not in ('string', 'null')
         or jsonb_typeof(v_item->'org') not in ('string', 'null') then
        raise exception '体制内訳のメモ・組織の形式が正しくありません';
      end if;
      v_note := nullif(btrim(coalesce(v_item->>'note', '')), '');
      v_org := nullif(btrim(coalesce(v_item->>'org', '')), '');
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
      insert into public.work_stakeholder_counts(work_id, role_id, headcount, sort_order, note, org)
        values (v_work_id, v_role_id, v_headcount, v_order, v_note, v_org);
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

-- 4. 層のメモを変える（変えたグループの役割を使う作品の図を同じトランザクションで作り直す）
create or replace function public.set_stakeholder_group_note(p_id uuid, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_rows integer;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can change a stakeholder group';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  update public.stakeholder_groups set note = v_note where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、関係者グループが見つかりません';
  end if;
  perform private.refresh_role_works(array(select r.id from public.roles r where r.group_id = p_id));
end;
$$;

revoke all on function public.set_stakeholder_group_note(uuid, text) from public, anon;
grant execute on function public.set_stakeholder_group_note(uuid, text) to authenticated;

-- 5. 全作品の図を作り直す
update public.works set stakeholders = private.compute_work_stakeholders(id);

notify pgrst, 'reload schema';

commit;

-- 6. 結果（この表を控えて報告する）
select
  (select count(*) from public.works) as works,
  (select count(*) from public.works where stakeholders is not null) as derived,
  (select count(*) from public.works where stakeholders->>'v' = '2') as v2,
  (select count(*) from public.stakeholder_groups where note is not null) as groups_with_note;
