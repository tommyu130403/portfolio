-- Stage 2-A 適用後の独立検証（読み取りのみ。書き込みなし）。
-- 番号ごとに 1 回ずつ SQL Editor で Run する。9 と 10 は begin ... rollback で囲んであり何も残らない。
-- 検証 11（保存関数の試運転）は書き込みを含むため、このファイルには入れていない。

-- 1. 列（期待: companies/roles/phase_names = id uuid NO / name text NO / sort_order integer NO 0 / created_at timestamptz NO now()、
--    work_roles = work_id, role_id, sort_order / work_stakeholder_counts = work_id, role_id, headcount, sort_order、
--    career_items に company_id uuid YES / role_id uuid YES）
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (table_name in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
       or (table_name = 'career_items' and column_name in ('company_id','role_id')))
order by table_name, ordinal_position;

-- 2. RLS とポリシー（期待: 5 表すべて rls = true、各 4 本 delete_owner/insert_owner/select_reader/update_owner、roles はすべて {authenticated}）
select c.relname, c.relrowsecurity as rls,
       (select string_agg(p.policyname || ':' || p.cmd || ':' || p.roles::text, ', ' order by p.policyname)
          from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
order by 1;

-- 3. 表の権限（期待: authenticated に DELETE,INSERT,SELECT,UPDATE だけ。anon の行は 0）
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('companies','roles','phase_names','work_roles','work_stakeholder_counts')
group by 1, 2 order by 1, 2;

-- 4. 関数（期待: 4 行。save_work_with_relations は (jsonb,text[],text[],uuid[],jsonb) だけで 3 引数版は無い。
--    anon_exec はすべて false、auth_exec はすべて true）
select p.oid::regprocedure as fn,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('save_work_with_relations','rename_company','rename_role','rename_phase_name')
order by 1;

-- 5. 件数（本体最後の表と同じ値であること。本番では breakdown_unparsed = 2 の見込み［ASSUMED］）
--    （本体 §8 の select をそのまま再実行）
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

-- 6. 担当役割: 紐付けから作った文字 = 今の文字を正規化したもの（期待: 0 行）
with t as (
  select w.id, w.title, w.role,
    (select string_agg(x.name, '・' order by x.first_ord)
       from (select regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g') as name, min(s.ord) as first_ord
             from regexp_split_to_table(w.role, '[・、,]') with ordinality as s(seg, ord)
             group by 1) x
       where x.name <> '') as legacy_norm,
    (select string_agg(r.name, '・' order by wr.sort_order)
       from public.work_roles wr join public.roles r on r.id = wr.role_id
       where wr.work_id = w.id) as derived
  from public.works w
)
select * from t where legacy_norm is distinct from derived;

-- 7. 体制内訳: 紐付けから作った文字 = 今の文字を読み直したもの（紐付けのある作品のみ。期待: 0 行）
with t as (
  select w.id, w.title, w.stakeholder_breakdown,
    (select string_agg(regexp_replace(q.m[1], '^[\s　]+|[\s　]+$', '', 'g') || (q.m[2])::integer, '・' order by q.ord)
       from (select s.ord, regexp_match(regexp_replace(s.seg, '^[\s　]+|[\s　]+$', '', 'g'), '^([^0-9]+)([0-9]+)名?$') as m
             from regexp_split_to_table(w.stakeholder_breakdown, '[・、,]') with ordinality as s(seg, ord)) q) as legacy_norm,
    (select string_agg(r.name || c.headcount, '・' order by c.sort_order)
       from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
       where c.work_id = w.id) as derived
  from public.works w
  where exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id)
)
select * from t where legacy_norm is distinct from derived;
--    続けて、読めなかった作品の一覧（本番の見込み: 11a52276…「14名・4組織横断」と 723313f5…「職能横断・キックオフ参加10名」）
select id, title, stakeholder_breakdown from public.works w
where regexp_replace(coalesce(w.stakeholder_breakdown, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
  and not exists (select 1 from public.work_stakeholder_counts c where c.work_id = w.id);

-- 8. 経歴の文字 = マスタ名（期待: 0 行）と、大文字小文字だけが違う重複（期待: 0 行。あれば報告して手作業で統合）
select ci.id, 'company' as col, ci.company as text_value, c.name as master_name
from public.career_items ci left join public.companies c on c.id = ci.company_id
where ci.company <> '' and (c.id is null or c.name <> ci.company)
union all
select ci.id, 'role', ci.role, r.name
from public.career_items ci left join public.roles r on r.id = ci.role_id
where ci.role <> '' and (r.id is null or r.name <> ci.role);
select 'companies' as t, lower(name), array_agg(name) from public.companies group by lower(name) having count(*) > 1
union all select 'roles', lower(name), array_agg(name) from public.roles group by lower(name) having count(*) > 1
union all select 'phase_names', lower(name), array_agg(name) from public.phase_names group by lower(name) having count(*) > 1;

-- 9. anon は読めない（期待: permission denied のエラー）
begin; set local role anon; select count(*) from public.roles; rollback;

-- 10. ゲスト（readers の 1 人）として読む（期待: roles_seen = roles の全件、
--     work_roles_seen = 公開中の作品の分 = 下の published_work_roles と一致）
select (select count(*) from public.work_roles wr join public.works w on w.id = wr.work_id where w.is_published) as published_work_roles;
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from private.readers limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
select (select count(*) from public.roles) as roles_seen, (select count(*) from public.work_roles) as work_roles_seen;
rollback;

-- 12. 人数の上限（保存関数と同じ 1〜999）を超える紐付けが無いこと（期待: 0 行）
select * from public.work_stakeholder_counts where headcount > 999;
