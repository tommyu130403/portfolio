-- 20261028090000_work_thumbnail.sql の適用後の検証。
-- 下の 4 本を、1 本ずつ別の Run で流す（まとめて貼ると最後の結果しか見えない）。
-- 期待値は各クエリの上のコメントに書いてある。違ったら出力をそのまま貼って報告する。

-- (1) works.thumbnail が jsonb で、null を許す列になっている
--     期待: column_name=thumbnail / data_type=jsonb / is_nullable=YES の 1 行
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'works' and column_name = 'thumbnail';

-- (2) 保存関数が thumbnail を保存する (on conflict の set に excluded.thumbnail がある)
--     期待: true
select position('thumbnail = excluded.thumbnail,' in pg_get_functiondef('public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)'::regprocedure)) > 0 as saves_thumbnail;

-- (3) 保存関数が 1 つだけで、引数の形が変わっていない (20261027_work_contents_verify.sql の検証 4)
--     期待: args=「p_work jsonb, p_content_labels text[], p_tool_names text[], p_role_ids uuid[], p_stakeholder_counts jsonb」/ versions=1
select pg_get_function_identity_arguments('public.save_work_with_relations'::regproc) as args,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'save_work_with_relations') as versions;

-- (4) 関数の実行権限 (20261027_work_contents_verify.sql の検証 7)
--     期待: anon_exec=false / auth_exec=true
select has_function_privilege('anon', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as anon_exec,
       has_function_privilege('authenticated', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as auth_exec;
