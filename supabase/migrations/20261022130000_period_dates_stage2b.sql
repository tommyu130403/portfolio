-- Stage 2-B: 期間を日付型でも持つ（career_items / works）。
--
-- 何をするか:
--   1. 両表に start_date / end_date（date。月単位で、日は常に 1 日）と is_current（現在も続いている）を足す。
--   2. 期間の文字 period は公開サイトのために残す。日付が入っている行は、DB が日付から文字を作り直す
--      （トリガー private.sync_period_text。形式は app/admin/period.ts の formatPeriod と同じ
--       「YYYY年M月 - YYYY年M月」「YYYY年M月 - 現在」「YYYY年M月 - 」）。
--      日付が空の行（旧形式）は、送られた文字をそのまま保存する。
--      ※ 日付が入っている行の period を SQL で直接書き換えても、トリガーが日付から作り直す。
--        文字を自由に書きたいときは start_date / end_date を null、is_current を false にする。
--   3. 今の文字から日付を読み取る（バックフィル）。読み取れた行は、文字が上の形式に揃う。
--      読み取れない行（「以降」「（6ヶ月）」が付くなど）は日付を空のまま、文字も変えない。
--      書き換え前の文字は private.period_text_backup_20261022 に全行控える。
--   4. 作品の保存関数 save_work_with_relations に 3 列を足す（引数の形は 2-A と同じ。旧版の削除は無い）。
--
-- 公開サイトのコード（components/）は変えない。公開サイトは今までどおり period の文字を読む。
--   経歴: CareerGanttChart の formatPeriod が「2022.04」「2022年4月」をどちらも「2022.4」と出すので見た目は変わらない。
--   作品: WorkDetailHeader は文字をそのまま出すので、書き換えた行は区切りなどの表示が変わる。
--
-- 適用順序（dev → 本番）:
--   1. supabase/data/20261022_period_dates_stage2b_preview.sql を流し、書き換わる行・旧形式のまま残る行を控える。
--   2. 本ファイル全体を SQL Editor に貼って Run。最後の結果表（件数）を控える。
--   3. supabase/data/20261022_period_dates_stage2b_verify.sql を番号ごとに別の Run で流す（1 の pass = true）。
--   4. 本番: 管理画面のデプロイ（マージ）直前に 1〜3 → すぐデプロイ。
--      ※ 適用からデプロイ完了までの間は、管理画面で「期間」を編集しない
--        （旧画面では、経歴の期間の編集が日付から作り直されて元に戻る。作品は日付が空に戻り旧形式になる）。
--        期間以外の編集は可能。適用時に管理画面を開いていたら、再読み込みしてから操作する。公開サイトは影響なし。
--
-- 再実行: 何度流しても同じ結果になる（日付が入った行は読み直さない。控えは最初の値を残す）。
--
-- ロールバック（先にフロントを本ファイル前の版へ戻してから、以下をコメント解除して流す）:
--   begin;
--   drop trigger if exists career_items_sync_period on public.career_items;
--   drop trigger if exists works_sync_period on public.works;
--   -- 適用直後で管理画面から期間を保存していない場合に限り、文字を元に戻す（以後の編集も控えの値で上書きされるため）
--   -- update public.career_items c set period = b.period from private.period_text_backup_20261022 b
--   --   where b.tbl = 'career_items' and b.id = c.id and c.period is distinct from b.period;
--   -- update public.works w set period = b.period from private.period_text_backup_20261022 b
--   --   where b.tbl = 'works' and b.id = w.id and w.period is distinct from b.period;
--   alter table public.career_items drop column if exists start_date, drop column if exists end_date, drop column if exists is_current;
--   alter table public.works drop column if exists start_date, drop column if exists end_date, drop column if exists is_current;
--   drop function if exists private.sync_period_text();
--   drop function if exists private.parse_period_text(text);
--   drop function if exists private.format_period(date, date, boolean);
--   commit;
--   -- そのあと 20261022120000_masters_stage2a.sql の §6（create or replace function public.save_work_with_relations
--   -- から grant execute まで）だけを流して、2-A の本体に戻す（列を消しても関数は残り、実行時に失敗するため必須）。
--   -- 控えの表 private.period_text_backup_20261022 は残す（不要になったら別途 drop）。

begin;

-- 0. 前提（想定どおりでなければここで止まり、何も変わらない）
do $$
begin
  if to_regprocedure('private.is_owner()') is null then
    raise exception '前提の関数 private.is_owner がありません';
  end if;
  if to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null
     or to_regclass('public.roles') is null then
    raise exception 'Stage 2-A（20261022120000_masters_stage2a.sql）を先に適用してください';
  end if;
end $$;

-- 1. 列（既存行は 日付 null / is_current false = 旧形式として始まる）
alter table public.career_items
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists is_current boolean not null default false;
alter table public.works
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists is_current boolean not null default false;

-- 2. 関数（private スキーマ。API には出ない）
-- 2-1. 日付 → 文字（app/admin/period.ts の formatPeriod と同じ出力。開始が無ければ null）
create or replace function private.format_period(p_start date, p_end date, p_is_current boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start is null then null
    else extract(year from p_start)::integer::text || '年'
         || extract(month from p_start)::integer::text || '月 - '
         || case
              when p_is_current then '現在'
              when p_end is not null then extract(year from p_end)::integer::text || '年'
                                          || extract(month from p_end)::integer::text || '月'
              else ''
            end
  end
$$;

-- 2-2. 文字 → 日付（読めなければ 0 行を返す）
--   開始・終了: YYYY年M月 / YYYY.MM、区切り: - – − ~ 〜 ～、終了: 現在 / 年月 / なし。前後の空白は除き、全角数字は半角にする。
--   後ろに語が付くもの（以降 など）・範囲外・終了が開始より前 は読まない。
create or replace function private.parse_period_text(p_text text)
returns table (start_date date, end_date date, is_current boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_m text[];
  v_sy integer;
  v_sm integer;
  v_ey integer;
  v_em integer;
begin
  v_m := regexp_match(
    regexp_replace(translate(coalesce(p_text, ''), '０１２３４５６７８９', '0123456789'), '^[\s　]+|[\s　]+$', '', 'g'),
    '^([0-9]{4})(?:年([0-9]{1,2})月|\.([0-9]{1,2}))\s*[-–−~〜～]\s*(?:(現在)|([0-9]{4})(?:年([0-9]{1,2})月|\.([0-9]{1,2})))?$'
  );
  if v_m is null then
    return;
  end if;
  v_sy := v_m[1]::integer;
  v_sm := coalesce(v_m[2], v_m[3])::integer;
  v_ey := v_m[5]::integer;
  v_em := coalesce(v_m[6], v_m[7])::integer;
  if v_sy not between 1900 and 2100 or v_sm not between 1 and 12 then
    return;
  end if;
  if v_ey is not null then
    if v_ey not between 1900 and 2100 or v_em not between 1 and 12 or v_ey * 12 + v_em < v_sy * 12 + v_sm then
      return;
    end if;
  end if;
  start_date := pg_catalog.make_date(v_sy, v_sm, 1);
  end_date := case when v_ey is null then null else pg_catalog.make_date(v_ey, v_em, 1) end;
  is_current := v_m[4] is not null;
  return next;
end;
$$;

-- 2-3. トリガー本体（日付がある行は文字を作り直す。日付が空なら送られた文字のまま）
create or replace function private.sync_period_text()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.start_date is not null then
    new.period := private.format_period(new.start_date, new.end_date, new.is_current);
  end if;
  return new;
end;
$$;

revoke all on function private.format_period(date, date, boolean) from public, anon;
grant execute on function private.format_period(date, date, boolean) to authenticated;
revoke all on function private.parse_period_text(text) from public, anon;
grant execute on function private.parse_period_text(text) to authenticated;
revoke all on function private.sync_period_text() from public, anon;
grant execute on function private.sync_period_text() to authenticated;

-- 3. 動作確認（想定どおりでなければここで止まり、何も変わらない）
do $$
declare
  v_bad text;
begin
  -- 3-1. 日付 → 文字（formatPeriod と同じ。管理画面の PERIOD_RE でも読めること）
  if private.format_period(date '2022-04-01', null, true) is distinct from '2022年4月 - 現在'
     or private.format_period(date '2020-04-01', date '2022-03-01', false) is distinct from '2020年4月 - 2022年3月'
     or private.format_period(date '2022-04-01', null, false) is distinct from '2022年4月 - '
     or private.format_period(null, null, false) is not null
     or private.format_period(date '2022-04-01', null, false) !~ '^([0-9]{4})年([0-9]{1,2})月\s*-\s*(現在|([0-9]{4})年([0-9]{1,2})月)?$' then
    raise exception '期間の文字の作り方が想定どおり動きません';
  end if;
  -- 3-2. 文字 → 日付
  select string_agg(t.input, ' / ') into v_bad
  from (values
    ('2022.04 - 現在', '2022-04-01||C'),
    ('2020.04 - 2022.03', '2020-04-01|2022-03-01|-'),
    ('2019年10月〜2020年5月', '2019-10-01|2020-05-01|-'),
    ('2023年12月 - 現在', '2023-12-01||C'),
    ('2022年4月 - ', '2022-04-01||-'),
    ('２０２２年４月～２０２３年３月', '2022-04-01|2023-03-01|-'),
    ('2021年4月〜2022年2月以降', null),
    ('2023年4月 - 2023年9月（6ヶ月）', null),
    ('2022年13月 - 現在', null),
    ('2022年4月 - 2021年1月', null),
    ('2022年4月', null),
    ('', null)
  ) as t(input, expected)
  left join lateral (
    select to_char(p.start_date, 'YYYY-MM-DD') || '|' || coalesce(to_char(p.end_date, 'YYYY-MM-DD'), '') || '|'
           || case when p.is_current then 'C' else '-' end as got
    from private.parse_period_text(t.input) p
  ) g on true
  where g.got is distinct from t.expected;
  if v_bad is not null then
    raise exception '期間の読み取り規則が想定どおり動きません: %', v_bad;
  end if;
end $$;

-- 4. 制約（両表とも 5 本。名前は <表>_period_*_chk）
do $$
declare
  t text;
begin
  foreach t in array array['career_items', 'works'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_period_first_of_month_chk');
    execute format('alter table public.%I add constraint %I check ((start_date is null or extract(day from start_date) = 1) and (end_date is null or extract(day from end_date) = 1))', t, t || '_period_first_of_month_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_period_year_range_chk');
    execute format($f$alter table public.%I add constraint %I check ((start_date is null or start_date between date '1900-01-01' and date '2100-12-01') and (end_date is null or end_date between date '1900-01-01' and date '2100-12-01'))$f$, t, t || '_period_year_range_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_period_needs_start_chk');
    execute format('alter table public.%I add constraint %I check (start_date is not null or (end_date is null and not is_current))', t, t || '_period_needs_start_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_period_current_no_end_chk');
    execute format('alter table public.%I add constraint %I check (not (is_current and end_date is not null))', t, t || '_period_current_no_end_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_period_order_chk');
    execute format('alter table public.%I add constraint %I check (end_date is null or end_date >= start_date)', t, t || '_period_order_chk');
  end loop;
end $$;

-- 5. 書き換え前の文字を控える（全行。再実行では最初の値を残す）
create table if not exists private.period_text_backup_20261022 (
  tbl text not null check (tbl in ('career_items', 'works')),
  id uuid not null,
  period text,
  saved_at timestamptz not null default now(),
  primary key (tbl, id)
);
alter table private.period_text_backup_20261022 enable row level security;
revoke all on private.period_text_backup_20261022 from public, anon, authenticated;
insert into private.period_text_backup_20261022 (tbl, id, period)
select 'career_items', id, period from public.career_items
union all
select 'works', id, period from public.works
on conflict (tbl, id) do nothing;

-- 6. トリガー（期間に関わる列が書かれたときだけ動く）
drop trigger if exists career_items_sync_period on public.career_items;
create trigger career_items_sync_period
  before insert or update of period, start_date, end_date, is_current on public.career_items
  for each row execute function private.sync_period_text();
drop trigger if exists works_sync_period on public.works;
create trigger works_sync_period
  before insert or update of period, start_date, end_date, is_current on public.works
  for each row execute function private.sync_period_text();

-- 7. バックフィル（日付がまだ空で、文字が読める行だけ。文字はトリガーが作り直す）
-- 7-1. 経歴
update public.career_items t
   set start_date = p.start_date, end_date = p.end_date, is_current = p.is_current
  from (
    select s.id, x.start_date, x.end_date, x.is_current
    from public.career_items s
    cross join lateral private.parse_period_text(s.period) x
    where s.start_date is null
  ) p
 where t.id = p.id;
-- 7-2. 作品
--   案B（作品の公開表示を一切変えない）を選んだ場合だけ、下の「-- 案B:」の行のコメントを外す。
update public.works t
   set start_date = p.start_date, end_date = p.end_date, is_current = p.is_current
  from (
    select s.id, x.start_date, x.end_date, x.is_current
    from public.works s
    cross join lateral private.parse_period_text(s.period) x
    where s.start_date is null
    -- 案B: and private.format_period(x.start_date, x.end_date, x.is_current) = s.period
  ) p
 where t.id = p.id;

-- 8. 作品の保存関数に 3 列を足す（引数の形は 2-A と同じ。period は日付があればトリガーが作り直す）
create or replace function public.save_work_with_relations(
  p_work jsonb,
  p_skill_labels text[],
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
  v_skill_id uuid;
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

  -- 保存と改名を直列にする（並び順・語彙・文字の列の作り直しが混ざらないように）
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select coalesce(max(sort_order), -1) + 1 into v_order from public.works;

  -- role / stakeholder_breakdown はいったん受け取った値で入れ、最後に紐付けから作り直す
  -- period は、start_date があればトリガー works_sync_period が日付から作り直す（無ければ受け取った文字のまま）
  insert into public.works (
    id, title, category, thumbnail_url, role, period, start_date, end_date, is_current, timeline,
    stakeholders, hero_brand, hero_screenshots, hero_bg_color, sections,
    stakeholder_breakdown, sort_order, career_item_id, is_published
  ) values (
    v_work_id,
    p_work->>'title',
    p_work->>'category',
    p_work->>'thumbnail_url',
    p_work->>'role',
    p_work->>'period',
    nullif(p_work->>'start_date', '')::date,
    nullif(p_work->>'end_date', '')::date,
    coalesce((p_work->>'is_current')::boolean, false),
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
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = excluded.is_current,
    timeline = excluded.timeline,
    stakeholders = excluded.stakeholders,
    hero_brand = excluded.hero_brand,
    hero_screenshots = excluded.hero_screenshots,
    hero_bg_color = excluded.hero_bg_color,
    sections = excluded.sections,
    stakeholder_breakdown = excluded.stakeholder_breakdown,
    career_item_id = excluded.career_item_id,
    is_published = excluded.is_published;

  -- スキル（20261020130500 と同じ）
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
    insert into public.work_skills(work_id, skill_id, sort_order) values (v_work_id, v_skill_id, v_order);
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
end;
$$;

revoke all on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) from public, anon;
grant execute on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

-- 9. 結果（この表を控えて報告する）
select
  (select count(*) from public.career_items where start_date is not null) as career_typed,
  (select count(*) from public.career_items
     where start_date is null and regexp_replace(period, '^[\s　]+|[\s　]+$', '', 'g') <> '') as career_legacy,
  (select count(*) from public.career_items c join private.period_text_backup_20261022 b
     on b.tbl = 'career_items' and b.id = c.id where c.period is distinct from b.period) as career_rewritten,
  (select count(*) from public.works where start_date is not null) as works_typed,
  (select count(*) from public.works
     where start_date is null and regexp_replace(coalesce(period, ''), '^[\s　]+|[\s　]+$', '', 'g') <> '') as works_legacy,
  (select count(*) from public.works w join private.period_text_backup_20261022 b
     on b.tbl = 'works' and b.id = w.id where w.period is distinct from b.period) as works_rewritten,
  (select string_agg(w.title || '「' || w.period || '」', ' / ' order by w.sort_order) from public.works w
     where w.start_date is null and regexp_replace(coalesce(w.period, ''), '^[\s　]+|[\s　]+$', '', 'g') <> '') as works_legacy_list;

-- 試運転（書き込みを含むが最後に rollback するので何も残らない。適用後に 1 ブロックずつ別の Run で流す）
-- -- T1. トリガー（オーナーとして。期待: period = '2001年2月 - 現在'）
-- begin;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', (select user_id from private.owners limit 1), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- update public.career_items set start_date = date '2001-02-01', end_date = null, is_current = true, period = 'ダミー'
--   where id = (select id from public.career_items order by sort_order limit 1);
-- select id, period, start_date, end_date, is_current from public.career_items
--   where id = (select id from public.career_items order by sort_order limit 1);
-- rollback;
--
-- -- T2. 制約（期待: career_items_period_current_no_end_chk 違反のエラー）
-- begin;
-- update public.career_items set start_date = date '2001-02-01', end_date = date '2002-01-01', is_current = true
--   where id = (select id from public.career_items order by sort_order limit 1);
-- rollback;
--
-- -- T3. 保存関数（日付あり。期待: period = '2001年2月 - 2003年4月'。送った 'ダミー' ではない）
-- begin;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', (select user_id from private.owners limit 1), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.save_work_with_relations(
--   to_jsonb(w) || jsonb_build_object('start_date', '2001-02-01', 'end_date', '2003-04-01', 'is_current', false, 'period', 'ダミー'),
--   array(select s.label from public.work_skills ws join public.skills_vocab s on s.id = ws.skill_id where ws.work_id = w.id order by ws.sort_order),
--   array(select t.name from public.work_tools wt join public.tools_vocab t on t.id = wt.tool_id where wt.work_id = w.id order by wt.sort_order),
--   array(select role_id from public.work_roles where work_id = w.id order by sort_order),
--   case
--     when exists (select 1 from public.work_stakeholder_counts where work_id = w.id)
--       then (select jsonb_agg(jsonb_build_object('role_id', role_id, 'headcount', headcount) order by sort_order)
--               from public.work_stakeholder_counts where work_id = w.id)
--     when nullif(btrim(coalesce(w.stakeholder_breakdown, '')), '') is not null then null
--     else '[]'::jsonb
--   end
-- )
-- from public.works w where w.id = (select id from public.works order by sort_order limit 1);
-- select id, period, start_date, end_date, is_current from public.works where id = (select id from public.works order by sort_order limit 1);
-- rollback;
--
-- -- T4. 保存関数（旧形式。T3 の jsonb_build_object を
-- --     jsonb_build_object('start_date', null, 'end_date', null, 'is_current', false, 'period', '2021年4月〜2022年2月以降')
-- --     に替えて流す。期待: period = '2021年4月〜2022年2月以降'、日付 3 列は null / null / false）
