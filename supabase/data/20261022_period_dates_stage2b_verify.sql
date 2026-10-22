-- 1. まとめて合否（期待: pass = true）
with c as (
  select
    (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name in ('career_items', 'works')
         and column_name in ('start_date', 'end_date', 'is_current')) as typed_columns,
    (select count(*) from pg_constraint
       where conrelid in ('public.career_items'::regclass, 'public.works'::regclass)
         and conname ~ '_period_[a-z_]+_chk$') as period_constraints,
    (select count(*) from pg_trigger
       where not tgisinternal and tgname in ('career_items_sync_period', 'works_sync_period')) as triggers,
    (select count(*) from public.career_items
       where start_date is not null and period is distinct from private.format_period(start_date, end_date, is_current))
    + (select count(*) from public.works
       where start_date is not null and period is distinct from private.format_period(start_date, end_date, is_current)) as text_mismatch,
    (select count(*) from public.career_items t
       where start_date is null and exists (select 1 from private.parse_period_text(t.period)))
    + (select count(*) from public.works t
       where start_date is null and exists (select 1 from private.parse_period_text(t.period))) as legacy_but_parseable,
    (select count(*) from (
        select start_date, end_date, is_current from public.career_items
        union all
        select start_date, end_date, is_current from public.works) t
      where (start_date is not null and extract(day from start_date) <> 1)
         or (end_date is not null and extract(day from end_date) <> 1)
         or (start_date is null and (end_date is not null or is_current))
         or (is_current and end_date is not null)
         or end_date < start_date) as rule_violations,
    (select count(*) from private.period_text_backup_20261022) as backup_rows,
    position('start_date' in pg_get_functiondef(
      'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)'::regprocedure)) > 0 as save_fn_has_dates,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'save_work_with_relations') as save_fn_versions,
    has_function_privilege('anon', 'public.save_work_with_relations(jsonb,text[],text[],uuid[],jsonb)', 'execute') as anon_can_save,
    (has_function_privilege('anon', 'private.format_period(date,date,boolean)', 'execute')
      or has_function_privilege('anon', 'private.parse_period_text(text)', 'execute')
      or has_function_privilege('anon', 'private.sync_period_text()', 'execute')) as anon_can_run_helpers,
    has_function_privilege('authenticated', 'private.format_period(date,date,boolean)', 'execute') as auth_can_format
)
select c.*,
  (typed_columns = 6 and period_constraints = 10 and triggers = 2 and text_mismatch = 0
   and legacy_but_parseable = 0 and rule_violations = 0 and backup_rows > 0 and save_fn_has_dates
   and save_fn_versions = 1 and not anon_can_save and not anon_can_run_helpers and auth_can_format) as pass
from c;

-- 2. 旧形式のまま残った行（管理画面で入力し直す候補）
select 'career_items' as tbl, id, company || ' / ' || role as label, period
from public.career_items
where start_date is null and regexp_replace(period, '^[\s　]+|[\s　]+$', '', 'g') <> ''
union all
select 'works', id, title, period
from public.works
where start_date is null and regexp_replace(coalesce(period, ''), '^[\s　]+|[\s　]+$', '', 'g') <> ''
order by 1, 3;

-- 3. 文字が書き換わった行（事前確認の「書き換え」と一致すること）
select b.tbl, b.id, coalesce(c.company || ' / ' || c.role, w.title) as label,
       b.period as before, coalesce(c.period, w.period) as after
from private.period_text_backup_20261022 b
left join public.career_items c on b.tbl = 'career_items' and c.id = b.id
left join public.works w on b.tbl = 'works' and w.id = b.id
where (c.id is not null or w.id is not null)
  and b.period is distinct from coalesce(c.period, w.period)
order by 1, 3;
