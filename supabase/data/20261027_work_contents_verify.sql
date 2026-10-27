-- 20261027120000_work_contents.sql の適用後の検証。
-- 全文を SQL Editor に貼って 1 回 Run すると、最後に「番号 / 項目 / pass / 詳細」の表が 7 行出る。
-- pass が全部 true なら OK。false の行は detail に実際の値が入るので、そのまま貼って報告する。

create temp table if not exists chk (no int, name text, pass boolean, detail text);
delete from chk;

do $$
declare
  v_cols text;
  v_old text;
  v_pol text;
  v_args text;
  v_versions int;
  v_vocab int;
  v_links int;
  v_vocab_backup int;
  v_links_backup int;
  v_anon_blocked boolean := false;
  v_anon_detail text;
  v_anon_exec boolean;
  v_auth_exec boolean;
begin
  -- 1. 列
  select string_agg(table_name || '.' || column_name, ', ' order by table_name, ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name in ('contents_vocab', 'work_contents');
  insert into chk values (1, '列の構成',
    v_cols = 'contents_vocab.id, contents_vocab.label, contents_vocab.created_at, contents_vocab.sort_order, work_contents.work_id, work_contents.content_id, work_contents.sort_order',
    v_cols);

  -- 2. 旧テーブルが無い
  v_old := coalesce(to_regclass('public.skills_vocab')::text, 'null') || ' / ' || coalesce(to_regclass('public.work_skills')::text, 'null');
  insert into chk values (2, '旧テーブルが消えている',
    to_regclass('public.skills_vocab') is null and to_regclass('public.work_skills') is null,
    v_old);

  -- 3. ポリシー
  select string_agg(tablename || ':' || policyname, ', ' order by tablename, policyname)
    into v_pol
    from pg_policies
   where schemaname = 'public' and tablename in ('contents_vocab', 'work_contents');
  insert into chk values (3, 'ポリシー 4 本ずつ',
    v_pol = 'contents_vocab:delete_owner, contents_vocab:insert_owner, contents_vocab:select_reader, contents_vocab:update_owner, work_contents:delete_owner, work_contents:insert_owner, work_contents:select_reader, work_contents:update_owner',
    v_pol);

  -- 4. 保存関数の引数
  select pg_get_function_identity_arguments('public.save_work_with_relations'::regproc),
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'save_work_with_relations')
    into v_args, v_versions;
  insert into chk values (4, '保存関数の引数',
    v_args = 'p_work jsonb, p_content_labels text[], p_tool_names text[], p_role_ids uuid[], p_stakeholder_counts jsonb' and v_versions = 1,
    v_args || ' / versions=' || v_versions);

  -- 5. 件数
  select (select count(*) from public.contents_vocab),
         (select count(*) from public.work_contents),
         (select count(*) from private.skills_vocab_backup_20261027),
         (select count(*) from private.work_skills_backup_20261027)
    into v_vocab, v_links, v_vocab_backup, v_links_backup;
  -- 控えの件数は環境による（dev は紐づけ 0 件）。合否は新テーブルが空であることだけで見る
  insert into chk values (5, '件数（新 0 件・控えは適用前の件数）',
    v_vocab = 0 and v_links = 0,
    format('vocab=%s links=%s vocab_backup=%s links_backup=%s', v_vocab, v_links, v_vocab_backup, v_links_backup));

  -- 6. anon は書き込めない（内側のブロックはサブトランザクションなので、万一入っても巻き戻る）
  begin
    perform set_config('role', 'anon', true);
    insert into public.contents_vocab (label) values ('検証用');
    raise exception 'ANON_INSERT_SUCCEEDED';
  exception
    when insufficient_privilege then
      v_anon_blocked := true;
      v_anon_detail := 'RLS で拒否: ' || sqlerrm;
    when others then
      v_anon_blocked := false;
      v_anon_detail := sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into chk values (6, 'anon は書けない', v_anon_blocked, v_anon_detail);

  -- 7. 関数の実行権限
  select has_function_privilege('anon', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute'),
         has_function_privilege('authenticated', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute')
    into v_anon_exec, v_auth_exec;
  insert into chk values (7, '関数の実行権限',
    v_anon_exec = false and v_auth_exec = true,
    format('anon_exec=%s auth_exec=%s', v_anon_exec, v_auth_exec));
end $$;

select no, name, pass, detail from chk order by no;
