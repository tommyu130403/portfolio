-- Stage 2-A: 会社 / 役割 / 工程名 をマスタ化する（companies / roles / phase_names）。
--
-- 何をするか:
--   1. マスタ 3 表と、作品ごとの紐付け 2 表（work_roles / work_stakeholder_counts）を作る。
--   2. career_items に company_id / role_id（空でもよい）を足す。
--   3. 今ある文字の値からマスタと紐付けを作る（バックフィル）。文字の列は消さない・書き換えない。
--      例外: career_items.company / role の前後空白だけ取り除く（表示は変わらない）。
--   4. 作品保存の DB 関数 save_work_with_relations を 5 引数版に置き換える（旧 3 引数版は削除）。
--      works.role / works.stakeholder_breakdown は、関数が役割 id から作り直す（唯一の正は紐付け表）。
--      体制内訳を null で渡したときだけ、旧形式の文字をそのまま保存する。
--   5. 名前変更の DB 関数 rename_company / rename_role / rename_phase_name を作る。
--      マスタ名と、それを写した文字の列を同じトランザクションで書き換える。
--
-- 公開サイトは今までどおり文字の列（career_items.company/role, works.role,
-- works.stakeholder_breakdown, works.timeline の label）を読む。公開サイトのコードは変えない。
--
-- 適用順序（dev → 本番）:
--   1. dev の SQL Editor に本ファイル全体を貼って Run。最後の結果表（件数）を控える。
--   2. 末尾の「検証 SQL」を本体とは別の Run で流す。
--   3. 管理画面を実装・確認する。
--   4. 本番: 管理画面のデプロイ直前に本ファイルを Run → 検証 SQL → すぐデプロイ。
--      ※ 旧 3 引数の保存関数を消すため、適用からデプロイまでの間は旧管理画面で作品を保存できない。
--        この間は管理画面で作品・経歴を保存しないこと（公開サイトは影響なし）。
--
-- 再実行: 何度流しても同じ結果になる（既にあるマスタ行・紐付けは作り直さない）。
--
-- ロールバック（先にフロントを本ファイル前の版へ戻してから、以下をコメント解除して流す）:
--   begin;
--   drop function if exists public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb);
--   drop function if exists public.rename_company(uuid, text);
--   drop function if exists public.rename_role(uuid, text);
--   drop function if exists public.rename_phase_name(uuid, text);
--   drop table if exists public.work_stakeholder_counts;
--   drop table if exists public.work_roles;
--   alter table public.career_items drop column if exists company_id, drop column if exists role_id;
--   drop table if exists public.phase_names;
--   drop table if exists public.roles;
--   drop table if exists public.companies;
--   commit;
--   -- そのあと 20261020130500_atomic_work_save.sql をそのまま流して旧 3 引数版を戻す。
--   -- 文字の列は残っているので公開サイトのデータは失われない（改名した分は新しい名前のまま）。

begin;

-- 0. 前提と、正規表現の動作確認（想定どおりでなければここで止まり、何も変わらない）
do $$
begin
  if to_regprocedure('private.is_owner()') is null
     or to_regprocedure('private.is_reader()') is null
     or to_regprocedure('private.can_read_portfolio()') is null then
    raise exception '前提の関数 private.is_owner / is_reader / can_read_portfolio がありません。20261020130000 までを先に適用してください';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'works' and column_name = 'is_published'
  ) then
    raise exception 'works.is_published がありません。20261018120000 を先に適用してください';
  end if;
  -- 前後空白の除去（全角スペースを含む）
  if regexp_replace(chr(12288) || ' デザイナー ' || chr(12288), '^[\s　]+|[\s　]+$', '', 'g') <> 'デザイナー' then
    raise exception '前後空白の除去が想定どおり動きません';
  end if;
  -- 体制内訳 1 区切りの形式（components/WorkDetailHeader.tsx の parseStakeholderBreakdown と同じ判定）
  if regexp_match('エンジニア 3名', '^([^0-9]+)([0-9]+)名?$') is null
     or regexp_match('インターン5名', '^([^0-9]+)([0-9]+)名?$') is null
     or regexp_match('14名', '^([^0-9]+)([0-9]+)名?$') is not null
     or regexp_match('エンジニア1〜2', '^([^0-9]+)([0-9]+)名?$') is not null
     or regexp_match('職能横断', '^([^0-9]+)([0-9]+)名?$') is not null then
    raise exception '体制内訳の読み取り規則が想定どおり動きません';
  end if;
end $$;

-- 1. マスタ 3 表（名前は前後空白なし・空でない・重複なし）
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and name = btrim(name)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and name = btrim(name)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.phase_names (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and name = btrim(name)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. 経歴 → マスタの紐付け（マスタ行が消えたら空に戻る。文字の列は残る）
alter table public.career_items
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists role_id uuid references public.roles(id) on delete set null;
create index if not exists career_items_company_id_idx on public.career_items(company_id);
create index if not exists career_items_role_id_idx on public.career_items(role_id);

-- 3. 作品 → 担当役割 / 体制内訳（作品を消すと一緒に消える。使われている役割は消せない）
create table if not exists public.work_roles (
  work_id uuid not null references public.works(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (work_id, role_id)
);
create index if not exists work_roles_role_id_idx on public.work_roles(role_id);

create table if not exists public.work_stakeholder_counts (
  work_id uuid not null references public.works(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  headcount integer not null check (headcount > 0),
  sort_order integer not null default 0,
  primary key (work_id, role_id)
);
create index if not exists work_stakeholder_counts_role_id_idx on public.work_stakeholder_counts(role_id);

-- 4. 権限（20261020131000 適用後と同じ形。anon は読み書きとも不可）
do $$
declare
  t text;
begin
  foreach t in array array['companies', 'roles', 'phase_names', 'work_roles', 'work_stakeholder_counts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists select_reader on public.%I', t);
    execute format('drop policy if exists insert_owner on public.%I', t);
    execute format('drop policy if exists update_owner on public.%I', t);
    execute format('drop policy if exists delete_owner on public.%I', t);
    execute format('create policy insert_owner on public.%I for insert to authenticated with check ((select private.is_owner()))', t);
    execute format('create policy update_owner on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))', t);
    execute format('create policy delete_owner on public.%I for delete to authenticated using ((select private.is_owner()))', t);
  end loop;
  -- マスタ: オーナーとゲストが読める
  foreach t in array array['companies', 'roles', 'phase_names'] loop
    execute format('create policy select_reader on public.%I for select to authenticated using ((select private.can_read_portfolio()))', t);
  end loop;
  -- 作品ごとの表: オーナーは全件、ゲストは公開中の作品の分だけ
  foreach t in array array['work_roles', 'work_stakeholder_counts'] loop
    execute format($f$create policy select_reader on public.%I for select to authenticated using (
      (select private.is_owner()) or
      ((select private.is_reader()) and exists (
        select 1 from public.works w where w.id = work_id and w.is_published
      ))
    )$f$, t);
  end loop;
end $$;

-- 5. バックフィル
-- 5-1. 経歴の会社名・役職の前後空白を取り除く（マスタ名と完全一致させるため）
update public.career_items
  set company = regexp_replace(company, '^[\s　]+|[\s　]+$', '', 'g')
  where company <> regexp_replace(company, '^[\s　]+|[\s　]+$', '', 'g');
update public.career_items
  set role = regexp_replace(role, '^[\s　]+|[\s　]+$', '', 'g')
  where role <> regexp_replace(role, '^[\s　]+|[\s　]+$', '', 'g');

-- 5-2. 会社マスタ（経歴の並び順で追加）と経歴の紐付け
insert into public.companies (name, sort_order)
select s.name,
       (row_number() over (order by s.first_sort, s.name))::integer
         + coalesce((select max(sort_order) from public.companies), 0)
from (
  select company as name, min(sort_order) as first_sort
  from public.career_items
  where company <> ''
  group by company
) s
on conflict (name) do nothing;

update public.career_items ci
  set company_id = c.id
  from public.companies c
  where ci.company_id is null and ci.company <> '' and c.name = ci.company;

-- 5-3. 作品の担当役割を区切りで分ける（WorkDetailHeader.tsx:114 と同じ「・」「、」「,」）
create temp table _ms_work_roles on commit drop as
select w.id as work_id, s.ord,
       regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g') as name
from public.works w
cross join lateral regexp_split_to_table(w.role, '[・、,]') with ordinality as s(seg, ord)
where w.role is not null;

-- 5-4. 体制内訳を 1 区切りずつ読む
create temp table _ms_breakdown on commit drop as
select p.work_id, p.ord, p.m is not null as ok,
       regexp_replace(p.m[1], '^[\s　]+|[\s　]+$', '', 'g') as name,
       p.m[2] as digits
from (
  select w.id as work_id, s.ord,
         regexp_match(
           regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g'),
           '^([^0-9]+)([0-9]+)名?$'
         ) as m
  from public.works w
  cross join lateral regexp_split_to_table(w.stakeholder_breakdown, '[・、,]') with ordinality as s(seg, ord)
  where regexp_replace(coalesce(w.stakeholder_breakdown, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
) p;
-- すべての区切りが読めて、人数が 1〜999（保存関数の上限と同じ）、同じ役割が重複しない作品だけを対象にする
create temp table _ms_breakdown_ok on commit drop as
select work_id
from _ms_breakdown
group by work_id
having bool_and(case when ok and length(digits) <= 3 then digits::integer > 0 else false end)
   and count(distinct name) = count(*);

-- 5-5. 役割マスタ（経歴の役職 → 作品の担当役割 → 体制内訳 の順で追加）と経歴の紐付け
insert into public.roles (name, sort_order)
select s.name,
       (row_number() over (order by s.src, s.first_sort, s.name))::integer
         + coalesce((select max(sort_order) from public.roles), 0)
from (
  select name, min(src) as src, min(first_sort) as first_sort
  from (
    select role as name, 1 as src, sort_order as first_sort from public.career_items where role <> ''
    union all
    select name, 2, 0 from _ms_work_roles where name <> ''
    union all
    select b.name, 3, 0 from _ms_breakdown b join _ms_breakdown_ok o using (work_id)
  ) a
  group by name
) s
on conflict (name) do nothing;

update public.career_items ci
  set role_id = r.id
  from public.roles r
  where ci.role_id is null and ci.role <> '' and r.name = ci.role;

-- 5-6. 作品の担当役割（紐付けがまだ 1 件も無い作品だけ。同じ役割は最初の位置を残す）
insert into public.work_roles (work_id, role_id, sort_order)
select s.work_id, r.id,
       (row_number() over (partition by s.work_id order by s.first_ord) - 1)::integer
from (
  select work_id, name, min(ord) as first_ord
  from _ms_work_roles
  where name <> ''
  group by work_id, name
) s
join public.roles r on r.name = s.name
where not exists (select 1 from public.work_roles x where x.work_id = s.work_id)
on conflict do nothing;

-- 5-7. 体制内訳（読めた作品のうち、紐付けがまだ 1 件も無い作品だけ）
insert into public.work_stakeholder_counts (work_id, role_id, headcount, sort_order)
select b.work_id, r.id, b.digits::integer,
       (row_number() over (partition by b.work_id order by b.ord) - 1)::integer
from _ms_breakdown b
join _ms_breakdown_ok o using (work_id)
join public.roles r on r.name = b.name
where not exists (select 1 from public.work_stakeholder_counts x where x.work_id = b.work_id)
on conflict do nothing;

-- 5-8. 工程名マスタ（works.timeline の phases[].label から。空は除く。timeline は書き換えない）
insert into public.phase_names (name, sort_order)
select s.name,
       (row_number() over (order by s.name))::integer
         + coalesce((select max(sort_order) from public.phase_names), 0)
from (
  select distinct regexp_replace(e.ph->>'label', '^[\s　]+|[\s　]+$', '', 'g') as name
  from public.works w
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(w.timeline->'phases') = 'array' then w.timeline->'phases' else '[]'::jsonb end
  ) as e(ph)
  where jsonb_typeof(e.ph) = 'object' and jsonb_typeof(e.ph->'label') = 'string'
) s
where s.name <> ''
on conflict (name) do nothing;

-- 6. 作品の保存関数を 5 引数版に置き換える
drop function if exists public.save_work_with_relations(jsonb, text[], text[]);

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

-- 7. 名前変更（マスタ名と、それを写した文字の列を同時に更新する）
create or replace function public.rename_company(p_id uuid, p_name text)
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
    raise exception 'Only the owner can rename a company';
  end if;
  if v_new = '' then
    raise exception '会社名を入力してください';
  end if;
  select name into v_old from public.companies where id = p_id;
  if v_old is null then
    raise exception '会社が見つかりません';
  end if;
  if v_old = v_new then
    return;
  end if;
  if exists (select 1 from public.companies where name = v_new and id <> p_id) then
    raise exception '同じ名前の会社がすでにあります';
  end if;
  update public.companies set name = v_new where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、会社が見つかりません';
  end if;
  update public.career_items set company = v_new where company_id = p_id;
end;
$$;

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
end;
$$;

create or replace function public.rename_phase_name(p_id uuid, p_name text)
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
    raise exception 'Only the owner can rename a phase name';
  end if;
  if v_new = '' then
    raise exception '工程名を入力してください';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select name into v_old from public.phase_names where id = p_id;
  if v_old is null then
    raise exception '工程名が見つかりません';
  end if;
  if v_old = v_new then
    return;
  end if;
  if exists (select 1 from public.phase_names where name = v_new and id <> p_id) then
    raise exception '同じ工程名がすでにあります';
  end if;
  update public.phase_names set name = v_new where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、工程名が見つかりません';
  end if;
  -- 作品のタイムラインで、名前が完全一致する工程の label を書き換える（並び順は保つ）
  update public.works w
    set timeline = jsonb_set(w.timeline, '{phases}', (
      select jsonb_agg(
               case when jsonb_typeof(e.ph) = 'object' and e.ph->>'label' = v_old
                    then jsonb_set(e.ph, '{label}', to_jsonb(v_new))
                    else e.ph end
               order by e.ord)
      from jsonb_array_elements(w.timeline->'phases') with ordinality as e(ph, ord)
    ))
    where jsonb_typeof(w.timeline->'phases') = 'array'
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(w.timeline->'phases') = 'array' then w.timeline->'phases' else '[]'::jsonb end
        ) as x(ph)
        where jsonb_typeof(x.ph) = 'object' and x.ph->>'label' = v_old
      );
end;
$$;

revoke all on function public.rename_company(uuid, text) from public, anon;
grant execute on function public.rename_company(uuid, text) to authenticated;
revoke all on function public.rename_role(uuid, text) from public, anon;
grant execute on function public.rename_role(uuid, text) to authenticated;
revoke all on function public.rename_phase_name(uuid, text) from public, anon;
grant execute on function public.rename_phase_name(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- 8. 結果（この表を控えて報告する）
select
  (select count(*) from public.companies) as companies,
  (select count(*) from public.roles) as roles,
  (select count(*) from public.phase_names) as phase_names,
  (select count(*) from public.career_items where company_id is not null) as career_company_linked,
  (select count(*) from public.career_items where role_id is not null) as career_role_linked,
  (select count(*) from public.career_items
     where (company <> '' and company_id is null) or (role <> '' and role_id is null)) as career_unlinked,
  (select count(*) from public.work_roles) as work_roles_rows,
  (select count(distinct work_id) from public.work_roles) as works_with_roles,
  (select count(*) from public.work_stakeholder_counts) as stakeholder_rows,
  (select count(distinct work_id) from public.work_stakeholder_counts) as works_with_breakdown,
  (select count(*) from public.works w
     where regexp_replace(coalesce(w.stakeholder_breakdown, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
       and not exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id)) as breakdown_unparsed,
  (select string_agg(w.title, ' / ' order by w.sort_order) from public.works w
     where regexp_replace(coalesce(w.stakeholder_breakdown, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
       and not exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id)) as breakdown_unparsed_titles;

-- 検証 SQL（適用後に本体とは別の Run で流す。番号ごとに 1 回ずつ Run）
-- 内容は supabase/data/20261022_masters_stage2a_verify.sql と同じ（11 は書き込みを含むため、こちらのコメントにだけ残す）。
-- -- 1. 列（期待: companies/roles/phase_names = id uuid NO / name text NO / sort_order integer NO 0 / created_at timestamptz NO now()、
-- --    work_roles = work_id, role_id, sort_order / work_stakeholder_counts = work_id, role_id, headcount, sort_order、
-- --    career_items に company_id uuid YES / role_id uuid YES）
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and (table_name in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
--        or (table_name = 'career_items' and column_name in ('company_id','role_id')))
-- order by table_name, ordinal_position;
--
-- -- 2. RLS とポリシー（期待: 5 表すべて rls = true、各 4 本 delete_owner/insert_owner/select_reader/update_owner、roles はすべて {authenticated}）
-- select c.relname, c.relrowsecurity as rls,
--        (select string_agg(p.policyname || ':' || p.cmd || ':' || p.roles::text, ', ' order by p.policyname)
--           from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
-- order by 1;
--
-- -- 3. 表の権限（期待: authenticated に DELETE,INSERT,SELECT,UPDATE だけ。anon の行は 0）
-- select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
-- from information_schema.role_table_grants
-- where table_schema = 'public' and grantee in ('anon','authenticated')
--   and table_name in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
-- group by 1, 2 order by 1, 2;
--
-- -- 4. 関数（期待: 4 行。save_work_with_relations は (jsonb,text[],text[],uuid[],jsonb) だけで 3 引数版は無い。
-- --    anon_exec はすべて false、auth_exec はすべて true）
-- select p.oid::regprocedure as fn,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('save_work_with_relations','rename_company','rename_role','rename_phase_name')
-- order by 1;
--
-- -- 5. 件数（本体最後の表と同じ値であること。本番では breakdown_unparsed = 2 の見込み［ASSUMED］）
-- --    （本体 §8 の select をそのまま再実行）
--
-- -- 6. 担当役割: 紐付けから作った文字 = 今の文字を正規化したもの（期待: 0 行）
-- with t as (
--   select w.id, w.title, w.role,
--     (select string_agg(x.name, '・' order by x.first_ord)
--        from (select regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g') as name, min(s.ord) as first_ord
--              from regexp_split_to_table(w.role, '[・、,]') with ordinality as s(seg, ord)
--              group by 1) x
--        where x.name <> '') as legacy_norm,
--     (select string_agg(r.name, '・' order by wr.sort_order)
--        from public.work_roles wr join public.roles r on r.id = wr.role_id
--        where wr.work_id = w.id) as derived
--   from public.works w
-- )
-- select * from t where legacy_norm is distinct from derived;
--
-- -- 7. 体制内訳: 紐付けから作った文字 = 今の文字を読み直したもの（紐付けのある作品のみ。期待: 0 行）
-- with t as (
--   select w.id, w.title, w.stakeholder_breakdown,
--     (select string_agg(regexp_replace(q.m[1], '^[\s　]+|[\s　]+$', '', 'g') || (q.m[2])::integer, '・' order by q.ord)
--        from (select s.ord, regexp_match(regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g'), '^([^0-9]+)([0-9]+)名?$') as m
--              from regexp_split_to_table(w.stakeholder_breakdown, '[・、,]') with ordinality as s(seg, ord)) q) as legacy_norm,
--     (select string_agg(r.name || c.headcount, '・' order by c.sort_order)
--        from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
--        where c.work_id = w.id) as derived
--   from public.works w
--   where exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id)
-- )
-- select * from t where legacy_norm is distinct from derived;
-- --    続けて、読めなかった作品の一覧（本番の見込み: 11a52276…「14名・4組織横断」と 723313f5…「職能横断・キックオフ参加10名」）
-- select id, title, stakeholder_breakdown from public.works w
-- where regexp_replace(coalesce(w.stakeholder_breakdown, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
--   and not exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id);
--
-- -- 8. 経歴の文字 = マスタ名（期待: 0 行）と、大文字小文字だけが違う重複（期待: 0 行。あれば報告して手作業で統合）
-- select ci.id, 'company' as col, ci.company as text_value, c.name as master_name
-- from public.career_items ci left join public.companies c on c.id = ci.company_id
-- where ci.company <> '' and (c.id is null or c.name <> ci.company)
-- union all
-- select ci.id, 'role', ci.role, r.name
-- from public.career_items ci left join public.roles r on r.id = ci.role_id
-- where ci.role <> '' and (r.id is null or r.name <> ci.role);
-- select 'companies' as t, lower(name), array_agg(name) from public.companies group by lower(name) having count(*) > 1
-- union all select 'roles', lower(name), array_agg(name) from public.roles group by lower(name) having count(*) > 1
-- union all select 'phase_names', lower(name), array_agg(name) from public.phase_names group by lower(name) having count(*) > 1;
--
-- -- 9. anon は読めない（期待: permission denied のエラー）
-- begin; set local role anon; select count(*) from public.roles; rollback;
--
-- -- 10. ゲスト（readers の 1 人）として読む（期待: roles_seen = roles の全件、
-- --     work_roles_seen = 公開中の作品の分 = 下の published_work_roles と一致）
-- select (select count(*) from public.work_roles wr join public.works w on w.id = wr.work_id where w.is_published) as published_work_roles;
-- begin;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', (select user_id from private.readers limit 1), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select (select count(*) from public.roles) as roles_seen, (select count(*) from public.work_roles) as work_roles_seen;
-- rollback;
--
-- -- 11. 保存関数の試運転（オーナーとして実行し、最後に rollback するので何も残らない）
-- --     期待: エラーなし。最後の select の role / stakeholder_breakdown が検証 6・7 の derived と同じ
-- begin;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', (select user_id from private.owners limit 1), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.save_work_with_relations(
--   to_jsonb(w),
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
-- select id, role, stakeholder_breakdown from public.works where id = (select id from public.works order by sort_order limit 1);
-- rollback;
-- --     ゲストで同じことをすると 'Only the owner can save a work' で止まること（sub を private.readers に替えて再実行）
