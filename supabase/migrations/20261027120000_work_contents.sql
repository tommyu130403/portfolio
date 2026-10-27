-- 作品カードの「スキル」タグ (skills_vocab / work_skills) を「制作内容」(contents_vocab / work_contents) に作り替える。
--
-- 理由: 作品カードの表示をスキルから制作内容 (例: Product Design / BtoC / SaaS) へ変えるため (Figma Master 494:1363)。
--       構造は同じ (語彙テーブル + 作品との紐付けテーブル)。名前だけ変え、既存の行は捨てる。
--       捨てる前に private.skills_vocab_backup_20261027 / private.work_skills_backup_20261027 へ全行を控える。
--       ホームのスキル欄は別のテーブル (skill_cards / skill_experience / skill_experience_tools / tools_vocab) を使うので触らない。
--       work_tools も触らない。
--       保存関数 save_work_with_relations は第 2 引数を p_skill_labels から p_content_labels に変える (引数の形は同じ 5 つ)。
--
-- 適用順序 (旧管理画面と新管理画面の間をあけない):
--   1. dev に適用 → 検証 SQL (supabase/data/20261027_work_contents_verify.sql) を流す。
--   2. フロントのデプロイ直前に本番へ適用 → 検証 SQL を流す → すぐにフロントをデプロイする。
--   - フロントを先にデプロイすると、新画面が work_contents / contents_vocab を読みにいってテーブルが無くエラーになる。
--   - 逆に SQL を先に当てると、旧管理画面の保存は p_skill_labels の関数が無くて失敗する。
--     そのため SQL を当ててからデプロイが終わるまでの間は、管理画面で作品を編集・保存しない。
--   - 再実行しても安全 (改名済みなら改名・削除・控えをスキップし、関数だけ作り直す)。
--
-- RLS ポリシーはテーブルの改名にそのまま付いてくるので作り直さない。
-- 既存の select_reader / insert_owner / update_owner / delete_owner がそのまま contents_vocab / work_contents に効く。
--
-- ロールバック (以下を順に流す。コメント解除して使う):
--   -- 先にフロントを旧版 (work_skills / skills_vocab を参照する版) へ戻すこと。
--   -- 1. 保存関数を戻す: 20261022130000_period_dates_stage2b.sql の「8.」(create or replace function 〜 grant execute) だけを流す。
--   --    その前に: drop function if exists public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb);
--   -- 2. 改名を戻す:
--   --    alter table public.contents_vocab drop constraint if exists contents_vocab_label_unique;
--   --    alter table public.contents_vocab drop constraint if exists contents_vocab_label_not_blank_chk;
--   --    alter table public.contents_vocab drop column if exists sort_order;
--   --    alter table public.contents_vocab add column if not exists category text;
--   --    alter table public.contents_vocab add column if not exists label_short text;
--   --    alter table public.work_contents rename column content_id to skill_id;
--   --    alter table public.work_contents rename constraint work_contents_content_id_fkey to work_skills_skill_id_fkey;
--   --    alter table public.work_contents rename constraint work_contents_work_id_fkey to work_skills_work_id_fkey;
--   --    alter table public.work_contents rename constraint work_contents_pkey to work_skills_pkey;
--   --    alter table public.contents_vocab rename constraint contents_vocab_pkey to skills_vocab_pkey;
--   --    alter table public.work_contents rename to work_skills;
--   --    alter table public.contents_vocab rename to skills_vocab;
--   -- 3. 行を控えから戻す (先に語彙、次に紐付け):
--   --    delete from public.work_skills; delete from public.skills_vocab;
--   --    (列名を明示する。手順 2 で列を足し直すと並びが控えと変わるため、select * では created_at に category が入って失敗する)
--   --    insert into public.skills_vocab (id, label, category, created_at, label_short)
--   --      select id, label, category, created_at, label_short from private.skills_vocab_backup_20261027;
--   --    insert into public.work_skills (work_id, skill_id, sort_order)
--   --      select work_id, skill_id, sort_order from private.work_skills_backup_20261027;
--   -- 4. notify pgrst, 'reload schema';
--
-- 検証 SQL (適用後に 1 本ずつ別の Run で流す。同じ内容を supabase/data/20261027_work_contents_verify.sql に置く):
--   1. select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
--      where table_schema='public' and table_name in ('contents_vocab','work_contents') order by table_name, ordinal_position;
--        -- 期待: contents_vocab = id uuid / label text NO / created_at timestamptz / sort_order integer NO 0 (category・label_short は無い)
--        --       work_contents = work_id / content_id / sort_order
--   2. select to_regclass('public.skills_vocab') as old_vocab, to_regclass('public.work_skills') as old_link;
--        -- 期待: 2 つとも null
--   3. select tablename, policyname, cmd, roles from pg_policies
--      where schemaname='public' and tablename in ('contents_vocab','work_contents') order by tablename, policyname;
--        -- 期待: 各テーブル 4 本 (delete_owner / insert_owner / select_reader / update_owner)
--   4. select pg_get_function_identity_arguments('public.save_work_with_relations'::regproc) as args,
--             (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--               where n.nspname='public' and p.proname='save_work_with_relations') as versions;
--        -- 期待: args = p_work jsonb, p_content_labels text[], p_tool_names text[], p_role_ids uuid[], p_stakeholder_counts jsonb / versions = 1
--   5. select (select count(*) from public.contents_vocab) as vocab, (select count(*) from public.work_contents) as links,
--             (select count(*) from private.skills_vocab_backup_20261027) as vocab_backup,
--             (select count(*) from private.work_skills_backup_20261027) as links_backup;
--        -- 期待: vocab = 0 / links = 0 / 控えは適用前の件数 (0 より大きい)
--   6. begin; set local role anon; insert into public.contents_vocab (label) values ('検証用'); rollback;
--        -- 期待: エラー (row-level security policy 違反)。anon は書き込めない
--   7. select has_function_privilege('anon', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as anon_exec,
--             has_function_privilege('authenticated', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as auth_exec;
--        -- 期待: anon_exec = false / auth_exec = true

begin;

-- 0. 前提の確認 (改名済みの再実行も通す)
do $$
begin
  if to_regclass('public.skills_vocab') is null and to_regclass('public.contents_vocab') is null then
    raise exception 'public.skills_vocab も public.contents_vocab も存在しません';
  end if;
  if to_regclass('public.work_skills') is null and to_regclass('public.work_contents') is null then
    raise exception 'public.work_skills も public.work_contents も存在しません';
  end if;
  if to_regprocedure('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)') is null then
    raise exception '5 引数の public.save_work_with_relations が存在しません (20261022130000 を先に適用してください)';
  end if;
end $$;

-- 1. 控え (消す前の全行。再実行では最初の控えを残す)
do $$
begin
  if to_regclass('public.skills_vocab') is not null then
    create table if not exists private.skills_vocab_backup_20261027 as
      select * from public.skills_vocab with no data;
    alter table private.skills_vocab_backup_20261027 enable row level security;
    revoke all on private.skills_vocab_backup_20261027 from public, anon, authenticated;
    insert into private.skills_vocab_backup_20261027
      select * from public.skills_vocab
      where not exists (select 1 from private.skills_vocab_backup_20261027);
  end if;
  if to_regclass('public.work_skills') is not null then
    create table if not exists private.work_skills_backup_20261027 as
      select * from public.work_skills with no data;
    alter table private.work_skills_backup_20261027 enable row level security;
    revoke all on private.work_skills_backup_20261027 from public, anon, authenticated;
    insert into private.work_skills_backup_20261027
      select * from public.work_skills
      where not exists (select 1 from private.work_skills_backup_20261027);
  end if;
end $$;

-- 2. 現在の行を捨てる (スキルは作品ごとのタグだけに使っていた。紐付けを先に消す)
--    改名済みの再実行では、新しい制作内容を消さないようスキップする。
do $$
begin
  if to_regclass('public.work_skills') is not null then
    delete from public.work_skills;
  end if;
  if to_regclass('public.skills_vocab') is not null then
    delete from public.skills_vocab;
  end if;
end $$;

-- 3. 改名 (どれも「まだ旧名があるときだけ」)
do $$
begin
  if to_regclass('public.skills_vocab') is not null and to_regclass('public.contents_vocab') is null then
    alter table public.skills_vocab rename to contents_vocab;
  end if;
  if to_regclass('public.work_skills') is not null and to_regclass('public.work_contents') is null then
    alter table public.work_skills rename to work_contents;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_contents' and column_name = 'skill_id'
  ) then
    alter table public.work_contents rename column skill_id to content_id;
  end if;
  if exists (select 1 from pg_constraint where conname = 'work_skills_pkey' and conrelid = 'public.work_contents'::regclass) then
    alter table public.work_contents rename constraint work_skills_pkey to work_contents_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'work_skills_work_id_fkey' and conrelid = 'public.work_contents'::regclass) then
    alter table public.work_contents rename constraint work_skills_work_id_fkey to work_contents_work_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'work_skills_skill_id_fkey' and conrelid = 'public.work_contents'::regclass) then
    alter table public.work_contents rename constraint work_skills_skill_id_fkey to work_contents_content_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'skills_vocab_pkey' and conrelid = 'public.contents_vocab'::regclass) then
    alter table public.contents_vocab rename constraint skills_vocab_pkey to contents_vocab_pkey;
  end if;
end $$;

-- 語彙の列: 使わない category / label_short を外し、管理画面で並べるための sort_order を足す
alter table public.contents_vocab drop column if exists category;
alter table public.contents_vocab drop column if exists label_short;
alter table public.contents_vocab add column if not exists sort_order integer not null default 0;

-- 表記ゆれ・空欄を防ぐ (work_categories の name と同じ考え方)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contents_vocab_label_unique' and conrelid = 'public.contents_vocab'::regclass) then
    alter table public.contents_vocab add constraint contents_vocab_label_unique unique (label);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contents_vocab_label_not_blank_chk' and conrelid = 'public.contents_vocab'::regclass) then
    alter table public.contents_vocab add constraint contents_vocab_label_not_blank_chk check (btrim(label) <> '');
  end if;
end $$;

-- RLS ポリシー (select_reader / insert_owner / update_owner / delete_owner) は改名に付いてくるので作り直さない。

-- 4. 保存関数: 第 2 引数を p_skill_labels から p_content_labels に変える (名前が変わるので drop して作り直す)
drop function if exists public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb);

create function public.save_work_with_relations(
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
end;
$$;

revoke all on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) from public, anon;
grant execute on function public.save_work_with_relations(jsonb, text[], text[], uuid[], jsonb) to authenticated;

-- 5. API に新しい形を知らせる
notify pgrst, 'reload schema';

commit;
