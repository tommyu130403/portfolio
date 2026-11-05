-- 20261105140000_work_hero_layout.sql の適用後の検証（読み取りだけ。何も書き換えない）。番号ごとに 1 回の Run で流す。

-- 1. works.hero_layout が text で、null を許す列になっている
--    期待: column_name=hero_layout / data_type=text / is_nullable=YES の 1 行
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'works' and column_name = 'hero_layout';

-- 2. 値を 5 種類か null に絞る制約がある
--    期待: 1 行。definition に none / sp2 / pcsp / pc / images が並ぶ
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.works'::regclass and conname = 'works_hero_layout_check';

-- 3. 保存関数が hero_layout を保存する（本体に hero_layout がある）
--    期待: true
select position('hero_layout = excluded.hero_layout,' in pg_get_functiondef('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)'::regprocedure)) > 0 as saves_hero_layout;

-- 4. 保存関数が 1 つだけで、引数の形が変わっていない
--    期待: args=「p_work jsonb, p_content_labels text[], p_tool_names text[], p_role_ids uuid[], p_stakeholder_counts jsonb」/ versions=1
select pg_get_function_identity_arguments('public.save_work_with_relations'::regproc) as args,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'save_work_with_relations') as versions;

-- 5. 関数の実行権限
--    期待: anon_exec=false / auth_exec=true
select has_function_privilege('anon', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as anon_exec,
       has_function_privilege('authenticated', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as auth_exec;

-- 6. 既存の作品は hero_layout が null のまま（旧形式で描かれる）
--    期待: 適用直後は total = legacy_null。構成を選んで保存した分だけ legacy_null が減る
select count(*) as total, count(*) filter (where hero_layout is null) as legacy_null from public.works;
