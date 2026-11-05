-- 体制内訳の「組織」を、役割の行の下にぶら下がる「チーム」へ置き換える。
--
-- 何をするか:
--   1. work_stakeholder_counts に teams（jsonb 配列 [{ name, headcount }]）を足す。org 列は消さない（破壊的なので残す）。
--   2. 既存の org を 1 チーム { name: org, headcount: 行の人数 } へ移し、org を null にする。
--   3. private.compute_work_stakeholders を、組織カードを作らず、全行を役割カード（teams 付き）にする版に置き換える。
--      20261105120000（層に icon を足す変更）も含む。
--   4. save_work_with_relations を、体制内訳の行の teams を受け取って保存する版に置き換える（引数は変えない）。
--      org は読まない（送られてきても無視）。チームが 1 つ以上ある行の人数はチームの合計になる。
--   5. 全作品の図を作り直す。
--   理由: 「エンジニア 5名 ┗ チームA 2名 ┗ チームB 3名」のように、役割の中身をチームで分けて見せるため。
--         あわせて、マスタでグループに設定したアイコンが図に入っていなかった（20261105120000 が未適用）のを直す。
--         20261105120000 は流さなくてよい（本ファイルが同じ内容を含む）。
--
-- 図の規則（lib/stakeholders.ts の buildStakeholders と同じ。片方を変えたら両方直す）:
--   - 体制内訳の行（並び順どおり）→ 体制内訳に無い担当役割を 1 名（チームなし）として後ろに足す
--   - 役割のグループごとに層を作る（グループの sort_order → 名前の順）。グループ未設定の役割は
--     名前もメモも無い層 1 つにまとめて最後に置く
--   - 全ての行が役割カード: { kind: "role", name, note, me, teams }。teams は常に含める（無ければ []）
--     note = coalesce(メモ, 人数 || '名')。人数はチームがあればその合計
--   - 担当役割（work_roles）に入っている役割は me = true
--   - kind = "org" のカードはもう作らない（古いデータ・手書きの図を読む側は残す）
--
-- 適用順序（dev → 本番）:
--   0. 20261101150000 を先に適用済みであること（org 列が無ければ前提確認で止まる）。
--   1. 本ファイル全体を Run。最後の結果表で org_rows が 0、teams_rows が移行した行数であること。
--   2. 本番: SQL を先に適用してから、フロントをデプロイする（新フロントは teams 列を select するため、
--      先にデプロイすると管理画面がエラーになる）。
--      SQL を適用してからフロントをデプロイするまでの間は、旧エディタで作品を保存しないこと
--      （旧エディタは teams を送らないため、保存すると既存のチームが消える）。
--   3. 20261105120000 は本ファイルに含まれる。本ファイルより「後」に 20261105120000 を流すと、
--      図から teams が消える。流してしまったら本ファイルを最後にもう一度 Run する（再実行は安全）。
--
-- 再実行: 安全（列は add column if not exists、制約は無ければ付ける、org の移行は teams が空の行だけ、
--   関数は create or replace、図は毎回作り直す）。
--
-- ロールバック（フロントも本ファイル前の版へ戻してから流す）:
--   -- (1) 20261101150000 の「2. 図の計算」と「3. 作品の保存関数」の関数定義を、この順にそのまま流す。
--   --     （icon を載せたいときは 20261105120000 を最後に流す）
--   -- (2) update public.works set stakeholders = private.compute_work_stakeholders(id);
--   -- teams 列の削除は入力済みのチームが消える破壊的操作なので、実行前に要承認。
--   -- 移行で org = null にした行は、控え表から戻す（行が残っている分だけ）:
--   --   update public.work_stakeholder_counts c set org = b.org, teams = '[]'::jsonb
--   --   from private.work_stakeholder_counts_org_backup_20261105 b
--   --   where c.work_id = b.work_id and c.role_id = b.role_id;

begin;

-- 0. 前提確認（想定どおりでなければここで止まり、何も変わらない）
do $$
begin
  if to_regprocedure('private.compute_work_stakeholders(uuid)') is null
     or to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'stakeholder_groups' and column_name = 'icon')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'work_stakeholder_counts' and column_name = 'org') then
    raise exception '20261101120000（icon 列）と 20261101150000（org 列・各関数）を先に適用してください';
  end if;
end $$;

-- 1. teams 列を足す（[{ name, headcount }]。無ければ空配列）
alter table public.work_stakeholder_counts
  add column if not exists teams jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_stakeholder_counts_teams_check'
                 and conrelid = 'public.work_stakeholder_counts'::regclass) then
    alter table public.work_stakeholder_counts
      add constraint work_stakeholder_counts_teams_check
      check (jsonb_typeof(teams) = 'array');
  end if;
end $$;

-- 2. 既存の org を 1 チームへ移す（人数は行の人数のまま）
--    移す前の org を private の控え表に残す（移行後にチームを編集しても、元の組織名へ戻せるように）
create table if not exists private.work_stakeholder_counts_org_backup_20261105 (
  work_id uuid not null,
  role_id uuid not null,
  org text not null,
  primary key (work_id, role_id)
);
insert into private.work_stakeholder_counts_org_backup_20261105 (work_id, role_id, org)
select work_id, role_id, org
from public.work_stakeholder_counts
where org is not null
on conflict (work_id, role_id) do nothing;

update public.work_stakeholder_counts
set teams = jsonb_build_array(jsonb_build_object('name', org, 'headcount', headcount)),
    org = null
where org is not null and teams = '[]'::jsonb;

-- 3. 図の計算（{ v: 2, layers: [{ name, note, icon, cards }] }。org カードは作らない）
create or replace function private.compute_work_stakeholders(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with role_rows as (
    -- 体制内訳の行（並び順どおり。headcount は保存時にチームの合計へ揃えてある）
    select c.role_id, c.headcount, c.note, c.teams, 0 as src, c.sort_order as ord
    from public.work_stakeholder_counts c
    where c.work_id = p_work_id
    union all
    -- 担当役割のうち体制内訳に無いもの（1 名として後ろに足す）
    select wr.role_id, 1, null, '[]'::jsonb, 1, wr.sort_order
    from public.work_roles wr
    where wr.work_id = p_work_id
      and not exists (
        select 1 from public.work_stakeholder_counts c2
        where c2.work_id = p_work_id and c2.role_id = wr.role_id
      )
  ),
  entries as (
    select r.group_id, rr.role_id, r.name, rr.headcount, rr.note, rr.teams, m.is_me,
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
             'me', e.is_me,
             'teams', coalesce(e.teams, '[]'::jsonb)
           ) as card
    from entries e
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
               'icon', g.icon,
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

-- 4. 作品の保存関数（20261101150000 と同じ。体制内訳の行に teams を受け取って保存する点だけ違う）
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

-- 5. 全作品の図を作り直す
update public.works set stakeholders = private.compute_work_stakeholders(id);

notify pgrst, 'reload schema';

commit;

-- 6. 結果（この表を控えて報告する）: org_rows は 0 であること
select
  (select count(*) from public.works) as works,
  (select count(*) from public.works where stakeholders is not null) as derived,
  (select count(*) from public.work_stakeholder_counts where org is not null) as org_rows,
  (select count(*) from public.work_stakeholder_counts where teams <> '[]'::jsonb) as teams_rows,
  -- 層のアイコン: with_icon_key = derived、groups_with_icon がマスタで設定したグループ数と一致すること
  (select count(*) from public.works w
     where exists (select 1 from jsonb_array_elements(w.stakeholders->'layers') l where l ? 'icon')) as with_icon_key,
  (select count(*) from public.stakeholder_groups where icon is not null) as groups_with_icon;
