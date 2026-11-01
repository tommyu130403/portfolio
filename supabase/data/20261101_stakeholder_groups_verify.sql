-- 注意: 20261101150000 適用後は、全体を 1 回で流さず 1〜7・9・10 をブロックごとに流す（8 の期待値は旧形式 {groups} のため、新形式では必ず不一致で止まる）。
-- 20261101120000_stakeholder_groups.sql の適用後の検証。
-- 使い方: ファイル全体を 1 回の Run で流してよい。エラーが出ずに最後の表（11. まとめ）が出れば、8〜10 もすべて通っている。
--   8・9・10 は不一致のときだけ '8x 不一致' / '9 不一致' / '10 不一致' の例外で止まる（期待どおりの拒否は例外にしない）。
--   1〜7 の個別の結果を見たいときだけ、そのブロックを単独で Run する（まとめて貼ると最後の結果しか見えない）。
-- 1. 列（期待: roles.group_id uuid YES 既定なし / roles.is_titled boolean NO false /
--    stakeholder_groups = id uuid NO gen_random_uuid() / name text NO / icon text YES / sort_order integer NO 0 / created_at timestamptz NO now() /
--    works.stakeholders_legacy jsonb YES）
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (table_name = 'stakeholder_groups'
       or (table_name = 'roles' and column_name in ('group_id', 'is_titled'))
       or (table_name = 'works' and column_name = 'stakeholders_legacy'))
order by table_name, ordinal_position;

-- 2. RLS（期待: rls = true、delete_owner:DELETE:{authenticated}, insert_owner:INSERT:{authenticated},
--    select_reader:SELECT:{authenticated}, update_owner:UPDATE:{authenticated}）
select c.relname, c.relrowsecurity as rls,
       (select string_agg(p.policyname || ':' || p.cmd || ':' || p.roles::text, ', ' order by p.policyname)
          from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'stakeholder_groups';

-- 3. 表の権限（期待: authenticated に DELETE,INSERT,SELECT,UPDATE の 1 行だけ。anon の行なし）
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated') and table_name = 'stakeholder_groups'
group by 1, 2 order by 1, 2;

-- 4. 関数（期待: 11 行。anon_exec はすべて false、auth_exec はすべて true。save_work_with_relations は 5 引数版 1 本だけ）
select p.oid::regprocedure as fn,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in (
         'save_work_with_relations', 'rename_role', 'delete_role',
         'set_role_stakeholder_group', 'set_role_titled',
         'rename_stakeholder_group', 'set_stakeholder_group_icon', 'delete_stakeholder_group'))
   or (n.nspname = 'private' and p.proname in (
         'compute_work_stakeholders', 'refresh_work_stakeholders', 'refresh_role_works'))
order by 1;

-- 5. 種（期待: 4 行 Product|Abstract/application-one|1, Project|Components/tree-list|2, Designer|Components/platte|3, Engineer|Edit/code|4）
select name, icon, sort_order from public.stakeholder_groups order by sort_order;

-- 6. キャッシュ = 計算結果（期待: 0 行）
select id, title from public.works where stakeholders is distinct from private.compute_work_stakeholders(id);

-- 7. 退避の件数（期待: 適用前に控えた works_with_stakeholders と同じ値）
select count(*) as legacy_saved from public.works where stakeholders_legacy is not null;

-- 8. 規則と RPC の試運転（オーナーとして実行。最後に rollback するので何も残らない）
-- 期待: 最後の結果が '8a-8e OK'。途中で不一致があると '8x 不一致' の例外で止まる。
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from private.owners limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not (select private.is_owner()) then
    raise exception '8 前提エラー: オーナーとして実行できていない(auth.uid() = %)。begin から rollback までを 1 回の Run で流しているか確認する', (select auth.uid());
  end if;
  insert into public.roles (name, sort_order) values ('検証役職A', 9990), ('検証無名B', 9991);
  perform public.set_role_stakeholder_group((select id from public.roles where name = '検証役職A'),
                                            (select id from public.stakeholder_groups where name = 'Designer'));
  perform public.set_role_titled((select id from public.roles where name = '検証役職A'), true);
  perform public.save_work_with_relations(
    jsonb_build_object('id', '00000000-0000-4000-8000-00000000abcd', 'title', '検証作品',
                       'stakeholders', '{"groups":[{"label":"無視される","members":[{"label":"x"}]}]}'::jsonb),
    array[]::text[], array[]::text[],
    array[(select id from public.roles where name = '検証無名B')],
    jsonb_build_array(jsonb_build_object('role_id', (select id from public.roles where name = '検証役職A'), 'headcount', 2))
  );
  if (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd') is distinct from
     '{"groups": [{"icon": "Components/platte", "label": "Designer", "members": [{"me": false, "label": "検証役職A"}, {"me": false, "label": "検証役職A"}]},
                  {"icon": null, "label": "", "members": [{"me": true, "label": ""}]}]}'::jsonb then
    raise exception '8a 不一致: %', (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;

  perform public.set_role_titled((select id from public.roles where name = '検証役職A'), false);
  perform public.set_role_stakeholder_group((select id from public.roles where name = '検証無名B'),
                                            (select id from public.stakeholder_groups where name = 'Engineer'));
  perform public.set_role_titled((select id from public.roles where name = '検証無名B'), true);
  if (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd') is distinct from
     '{"groups": [{"icon": "Components/platte", "label": "Designer", "members": [{"me": false, "label": ""}, {"me": false, "label": ""}]},
                  {"icon": "Edit/code", "label": "Engineer", "members": [{"me": true, "label": "検証無名B"}]}]}'::jsonb then
    raise exception '8b 不一致: %', (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;

  perform public.rename_stakeholder_group((select id from public.stakeholder_groups where name = 'Designer'), 'Design');
  perform public.set_stakeholder_group_icon((select id from public.stakeholder_groups where name = 'Design'), null);
  perform public.rename_role((select id from public.roles where name = '検証無名B'), '検証無名C');
  if (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd') is distinct from
     '{"groups": [{"icon": null, "label": "Design", "members": [{"me": false, "label": ""}, {"me": false, "label": ""}]},
                  {"icon": "Edit/code", "label": "Engineer", "members": [{"me": true, "label": "検証無名C"}]}]}'::jsonb then
    raise exception '8c 不一致: %', (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;

  perform public.delete_stakeholder_group((select id from public.stakeholder_groups where name = 'Design'));
  if (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd') is distinct from
     '{"groups": [{"icon": "Edit/code", "label": "Engineer", "members": [{"me": true, "label": "検証無名C"}]},
                  {"icon": null, "label": "", "members": [{"me": false, "label": ""}, {"me": false, "label": ""}]}]}'::jsonb then
    raise exception '8d 不一致: %', (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;

  perform public.delete_role((select id from public.roles where name = '検証役職A'));
  if (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd') is distinct from
     '{"groups": [{"icon": "Edit/code", "label": "Engineer", "members": [{"me": true, "label": "検証無名C"}]}]}'::jsonb then
    raise exception '8e 不一致(stakeholders): %', (select stakeholders from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;
  if (select stakeholder_breakdown from public.works where id = '00000000-0000-4000-8000-00000000abcd') is not null then
    raise exception '8e 不一致(stakeholder_breakdown が null でない): %', (select stakeholder_breakdown from public.works where id = '00000000-0000-4000-8000-00000000abcd');
  end if;
end $$;
select '8a-8e OK' as result;
rollback;

-- 9. ゲスト（期待: 最後の結果が '9 OK'。グループは全件見えるが役割は変更できない）
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from private.readers limit 1), 'role', 'authenticated')::text, true);
select set_config('verify.groups_total', (select count(*) from public.stakeholder_groups)::text, true);
set local role authenticated;
do $$
declare
  v_seen integer;
  v_total integer := current_setting('verify.groups_total', true)::integer;
begin
  select count(*) into v_seen from public.stakeholder_groups;
  if v_seen <> v_total or v_seen = 0 then
    raise exception '9 不一致: ゲストに見えるグループ % 件 / 全 % 件', v_seen, v_total;
  end if;
  begin
    perform public.set_role_titled((select id from public.roles order by sort_order limit 1), true);
    raise exception '9 不一致: ゲストが役割を変更できてしまった';
  exception
    when raise_exception then
      if sqlerrm <> 'Only the owner can change a role' then
        raise;
      end if;
  end;
end $$;
select '9 OK' as result;
rollback;

-- 10. anon（期待: 例外なし。anon が読めてしまうと '10 不一致' で止まる）
begin;
do $$
declare v integer;
begin
  execute 'set local role anon';
  begin
    select count(*) into v from public.stakeholder_groups;
    raise exception '10 不一致: anon が stakeholder_groups を読めてしまった(% 件)', v;
  exception
    when insufficient_privilege then null;
  end;
end $$;
rollback;

-- 11. まとめ（期待: functions_ok = 11, groups_seeded = 4, stale_cache = 0,
--     legacy_saved = 適用前に控えた works_with_stakeholders の値, unassigned_roles = 事前割当前なら全役割数・後なら 3）
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where ((n.nspname = 'public' and p.proname in (
             'save_work_with_relations', 'rename_role', 'delete_role',
             'set_role_stakeholder_group', 'set_role_titled',
             'rename_stakeholder_group', 'set_stakeholder_group_icon', 'delete_stakeholder_group'))
        or (n.nspname = 'private' and p.proname in (
             'compute_work_stakeholders', 'refresh_work_stakeholders', 'refresh_role_works')))
      and not has_function_privilege('anon', p.oid, 'execute')
      and has_function_privilege('authenticated', p.oid, 'execute')) as functions_ok,
  (select count(*) from public.stakeholder_groups) as groups_seeded,
  (select count(*) from public.works where stakeholders is distinct from private.compute_work_stakeholders(id)) as stale_cache,
  (select count(*) from public.works where stakeholders_legacy is not null) as legacy_saved,
  (select count(*) from public.roles where group_id is null) as unassigned_roles;
