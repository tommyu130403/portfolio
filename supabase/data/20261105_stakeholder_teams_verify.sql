-- 20261105130000_stakeholder_teams.sql の適用後の検証（読み取りだけ。何も書き換えない）。番号ごとに 1 回の Run で流す。

-- 1. teams 列（期待: 1 行。data_type = jsonb, is_nullable = NO）
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'work_stakeholder_counts' and column_name = 'teams';

-- 2. org が残っている行（期待: 0 行。移行で teams へ移し、org は null にしてある）
select work_id, role_id, org from public.work_stakeholder_counts where org is not null;

-- 3. 人数がチームの合計と合わない行（期待: 0 行）
select c.work_id, c.role_id, c.headcount,
       (select sum((t->>'headcount')::integer) from jsonb_array_elements(c.teams) t) as team_sum
from public.work_stakeholder_counts c
where jsonb_array_length(c.teams) > 0
  and c.headcount is distinct from (select sum((t->>'headcount')::integer) from jsonb_array_elements(c.teams) t);

-- 4. 図に org カードが残っている作品（期待: 0 行）
select w.id, w.title from public.works w
where exists (
  select 1
  from jsonb_array_elements(coalesce(w.stakeholders->'layers', '[]'::jsonb)) l,
       jsonb_array_elements(l->'cards') c
  where c->>'kind' = 'org'
);

-- 5. キャッシュ = 計算結果（期待: 0 行）
select id, title from public.works
where stakeholders is distinct from private.compute_work_stakeholders(id);

-- 6. チームのある行の見本（最大 5 行。目で確認する）
select work_id, role_id, headcount, teams
from public.work_stakeholder_counts
where jsonb_array_length(teams) > 0
order by work_id, sort_order
limit 5;
