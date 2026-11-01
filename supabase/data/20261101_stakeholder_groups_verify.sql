-- 20261101120000_stakeholder_groups.sql の適用後の検証。
-- 1〜7・9・10 は 1 本ずつ別の Run で流す（まとめて貼ると最後の結果しか見えない）。
-- 8 は begin〜rollback を丸ごと 1 回で流す。途中の結果は見えない作りで、不一致なら例外で止まり、全部通れば最後に '8a-8e OK' が出る。
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

-- 9. ゲスト（期待: ok = true、つまり groups_seen と groups_total が同じ数。次の行で 'Only the owner can change a role' のエラー）
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from private.readers limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as groups_seen,
       (select count(*) from public.stakeholder_groups) as groups_total,
       count(*) = (select count(*) from public.stakeholder_groups) as ok
from public.stakeholder_groups;
select public.set_role_titled((select id from public.roles order by sort_order limit 1), true);
rollback;

-- 10. anon（期待: permission denied のエラー）
begin; set local role anon; select count(*) from public.stakeholder_groups; rollback;
