-- 注意: 20261105130000_stakeholder_teams.sql の適用後は、この検証は古い（org カードを前提にしている）。
--       適用後は 20261105_stakeholder_teams_verify.sql を使う。
-- 20261101150000_stakeholder_layers.sql の適用後の検証。番号ごとに 1 回の Run で流す（まとめて貼ると最後の結果しか見えない）。
-- 5 は begin から rollback までを 1 回の Run で流す（何も残らない）。

-- 1. 列（期待: 3 行すべて data_type = text, is_nullable = YES）
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'stakeholder_groups' and column_name = 'note')
    or (table_name = 'work_stakeholder_counts' and column_name in ('note', 'org')))
order by table_name, column_name;

-- 2. 関数（期待: 1 行。anon_exec = false, auth_exec = true）
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_stakeholder_group_note';

-- 3. キャッシュ = 計算結果（期待: 0 行）
select id, title from public.works
where stakeholders is distinct from private.compute_work_stakeholders(id);

-- 4. 新形式（期待: 0 行）
select id, title from public.works
where stakeholders is not null and stakeholders->>'v' is distinct from '2';

-- 5. 規則と RPC の試運転（オーナーとして実行。最後に rollback するので何も残らない）
-- 期待: 最後の結果が '5 OK'。不一致があると '5x 不一致' の例外で止まる。
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from private.owners limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  v_work constant uuid := '00000000-0000-4000-8000-00000000abce';
  v_layer uuid;
  v_got jsonb;
begin
  if not (select private.is_owner()) then
    raise exception '5 前提エラー: オーナーとして実行できていない(auth.uid() = %)。begin から rollback までを 1 回の Run で流しているか確認する', (select auth.uid());
  end if;
  insert into public.stakeholder_groups (name, sort_order) values ('検証層', -1) returning id into v_layer;
  insert into public.roles (name, sort_order)
    values ('検証A', 9990), ('検証B', 9991), ('検証C', 9992), ('検証D', 9993);
  perform public.set_role_stakeholder_group((select id from public.roles where name = '検証A'), v_layer);
  perform public.set_role_stakeholder_group((select id from public.roles where name = '検証B'), v_layer);
  perform public.set_role_stakeholder_group((select id from public.roles where name = '検証C'), v_layer);
  perform public.set_stakeholder_group_note(v_layer, '検証メモ');
  perform public.save_work_with_relations(
    jsonb_build_object('id', v_work, 'title', '検証作品'),
    array[]::text[], array[]::text[],
    array[(select id from public.roles where name = '検証D'), (select id from public.roles where name = '検証B')],
    jsonb_build_array(
      jsonb_build_object('role_id', (select id from public.roles where name = '検証A'), 'headcount', 2),
      jsonb_build_object('role_id', (select id from public.roles where name = '検証B'), 'headcount', 1,
                         'note', 'ノートB', 'org', 'オーグ'),
      jsonb_build_object('role_id', (select id from public.roles where name = '検証C'), 'headcount', 3,
                         'org', 'オーグ')
    )
  );
  v_got := (select stakeholders from public.works where id = v_work);
  if v_got is distinct from
     '{"v": 2, "layers": [{"name": "検証層", "note": "検証メモ", "cards": [{"kind": "role", "name": "検証A", "note": "2名", "me": false}, {"kind": "org", "title": "オーグ", "rows": [{"text": "検証B（ノートB）", "me": true}, {"text": "検証C ×3", "me": false}]}]}, {"name": "", "note": null, "cards": [{"kind": "role", "name": "検証D", "note": "1名", "me": true}]}]}'::jsonb then
    raise exception '5a 不一致: %', v_got;
  end if;

  perform public.set_stakeholder_group_note(v_layer, null);
  v_got := (select stakeholders from public.works where id = v_work);
  if v_got->'layers'->0->'note' is distinct from 'null'::jsonb then
    raise exception '5b 不一致(層のメモが null になっていない): %', v_got;
  end if;

  begin
    perform public.save_work_with_relations(
      jsonb_build_object('id', v_work, 'title', '検証作品'),
      array[]::text[], array[]::text[], array[]::uuid[],
      jsonb_build_array(jsonb_build_object('role_id', (select id from public.roles where name = '検証A'),
                                           'headcount', 1, 'note', 123))
    );
    raise exception '5c 不一致: 数値のメモが保存できてしまった';
  exception
    when raise_exception then
      if sqlerrm <> '体制内訳のメモ・組織の形式が正しくありません' then
        raise;
      end if;
  end;
end $$;
select '5 OK' as result;
rollback;
