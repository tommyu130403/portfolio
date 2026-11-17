-- 作品に連番の「作品番号」(works.work_no integer) を足す。管理画面だけで "W01" の形で表示する。
--
-- 目的: 作品を短い番号で呼べるようにするため（管理画面の一覧・編集画面で表示）。公開ページと URL は変えない。
--       既存の行は created_at の古い順（同じなら sort_order → id の順）に 1 から振る。
--
-- 採番の方法: 列の既定値 (default nextval) は使わない。
--   保存関数 save_work_with_relations (20261105140000_work_hero_layout.sql) は既存作品の保存でも
--   insert ... on conflict (id) do update を通る。Postgres は衝突して update に回る場合でも既定値の nextval を
--   先に評価するため、既定値にすると「既存作品を保存するたびに番号が 1 つ消費され、新規の番号が飛ぶ」。
--   代わりに BEFORE INSERT トリガーで、同じ id の行が既にあればその番号を引き継ぎ（= on conflict で update に回る保存）、
--   無いときだけ nextval する。on conflict の update 側は work_no を更新しないので、一度付いた番号は変わらない。
--   保存関数は advisory lock で直列化されているため、存在確認と採番の間で競合しない。関数は変更しない。
--
-- 適用順序:
--   1. dev に適用 → 末尾の検証 SQL を流す。
--   2. 本番へ適用する。フロントは先にデプロイしても壊れない（管理画面は列が無ければ番号を出さないだけ）。
--   - 再実行しても安全: 列は if not exists、番号は null の行だけ振る、sequence は if not exists、
--     カウンタは現在値より戻さない、制約は pg_constraint を見て追加、既定値は外す、トリガーは作り直す。
--     (この版より前の「既定値 nextval」版を流した DB にこの版を流すと、既定値が外れてトリガー方式に移る)
--
-- ロールバック（番号が消える破壊的操作なので、実行前に要承認）:
--   drop trigger if exists works_assign_work_no on public.works;
--   drop function if exists public.works_assign_work_no();
--   alter table public.works drop constraint if exists works_work_no_key;
--   alter table public.works drop column work_no;      -- owned by の sequence も一緒に消える

begin;

alter table public.works add column if not exists work_no integer;

-- 既存の行に番号を振る（null の行だけ。再実行しても振り直さない）
-- 再実行で新しい null 行があっても、既存の最大値の続きから振る
with base as (
  select coalesce(max(work_no), 0) as max_no from public.works
),
numbered as (
  select w.id, b.max_no + row_number() over (order by w.created_at nulls last, w.sort_order nulls last, w.id) as n
  from public.works w cross join base b
  where w.work_no is null
)
update public.works w set work_no = numbered.n
from numbered
where w.id = numbered.id;

create sequence if not exists public.works_work_no_seq owned by public.works.work_no;

-- 次の番号 = 「現在の最大 + 1」と「カウンタが次に出す値」の大きい方（空のテーブルなら 1）。
-- 再実行でカウンタを戻さないため（戻すと削除済み作品の番号を再利用してしまう）。is_called=false なので、この値そのものが次に出る
select setval(
  'public.works_work_no_seq',
  greatest(
    coalesce((select max(work_no) from public.works), 0) + 1,
    (select case when is_called then last_value + 1 else last_value end from public.works_work_no_seq)
  ),
  false
);

alter table public.works alter column work_no drop default;
alter table public.works alter column work_no set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'works_work_no_key' and conrelid = 'public.works'::regclass
  ) then
    alter table public.works add constraint works_work_no_key unique (work_no);
  end if;
end $$;

-- 新しい行のときだけ採番する。on conflict で update に回る保存では、既存の番号を入れて not null を満たす
create or replace function public.works_assign_work_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.work_no is null then
    select w.work_no into new.work_no from public.works w where w.id = new.id;
    if new.work_no is null then
      new.work_no := nextval('public.works_work_no_seq');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists works_assign_work_no on public.works;
create trigger works_assign_work_no
  before insert on public.works
  for each row execute function public.works_assign_work_no();

-- 保存関数は呼んだ人の権限で insert する (security invoker)。トリガーも同じ権限で動くので sequence の権限が要る
grant usage, select on sequence public.works_work_no_seq to authenticated;

notify pgrst, 'reload schema';

commit;

-- 検証 (適用後に流す。期待: total = distinct_no、nulls = 0、min_no = 1、col_default が null、trigger_count = 1)
-- select count(*) as total, count(distinct work_no) as distinct_no, count(*) filter (where work_no is null) as nulls,
--        min(work_no) as min_no, max(work_no) as max_no,
--        (select column_default from information_schema.columns
--          where table_schema = 'public' and table_name = 'works' and column_name = 'work_no') as col_default,
--        (select count(*) from pg_trigger where tgname = 'works_assign_work_no' and not tgisinternal) as trigger_count
-- from public.works;
