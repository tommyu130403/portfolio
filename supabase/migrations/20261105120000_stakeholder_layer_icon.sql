-- 関係者図の層にグループのアイコン（stakeholder_groups.icon）を載せる。
--
-- 何をするか:
--   1. private.compute_work_stakeholders を、各層に icon（「セット名/アイコン名」か null）を足す版に置き換える。
--   2. 全作品の図を作り直す。
--   理由: マスタ画面でグループにアイコンを設定できるのに、層カード形式（20261101150000）の図には
--         icon が入っておらず、公開ページにも管理画面にも出なかったため。
--   規則は lib/stakeholders.ts の buildStakeholders と同じ。片方を変えたら両方直す。
--   アイコン変更時の作り直しは set_stakeholder_group_icon（20261101120000）が既に行っている。
--
-- 適用順序: dev → 本番。フロントとはどちらが先でもよい
--   （旧フロントは icon を読み飛ばし、新フロントは icon が無ければ出さないだけ）。
-- 再実行: 安全（関数は create or replace、図は毎回作り直す）。
-- ロールバック: 20261101150000_stakeholder_layers.sql の「2. 図の計算」の関数定義をそのまま流し、
--   update public.works set stakeholders = private.compute_work_stakeholders(id); を実行する。

begin;

do $$
begin
  if to_regprocedure('private.compute_work_stakeholders(uuid)') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'stakeholder_groups' and column_name = 'note') then
    raise exception '20261101150000 を先に適用してください';
  end if;
end $$;

create or replace function private.compute_work_stakeholders(p_work_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with role_rows as (
    -- 体制内訳の行（並び順どおり）
    select c.role_id, c.headcount, c.note, c.org, 0 as src, c.sort_order as ord
    from public.work_stakeholder_counts c
    where c.work_id = p_work_id
    union all
    -- 担当役割のうち体制内訳に無いもの（1 名として後ろに足す）
    select wr.role_id, 1, null, null, 1, wr.sort_order
    from public.work_roles wr
    where wr.work_id = p_work_id
      and not exists (
        select 1 from public.work_stakeholder_counts c2
        where c2.work_id = p_work_id and c2.role_id = wr.role_id
      )
  ),
  entries as (
    select r.group_id, rr.role_id, r.name, rr.headcount, rr.note, rr.org, m.is_me,
           row_number() over (partition by r.group_id order by rr.src, rr.ord, rr.role_id) as pos
    from role_rows rr
    join public.roles r on r.id = rr.role_id
    cross join lateral (
      select exists (
        select 1 from public.work_roles x
        where x.work_id = p_work_id and x.role_id = rr.role_id
      ) as is_me
    ) m
  ),
  cards as (
    select e.group_id, e.pos as card_pos,
           jsonb_build_object(
             'kind', 'role',
             'name', e.name,
             'note', coalesce(e.note, e.headcount::text || '名'),
             'me', e.is_me
           ) as card
    from entries e
    where e.org is null
    union all
    select e.group_id, min(e.pos) as card_pos,
           jsonb_build_object(
             'kind', 'org',
             'title', e.org,
             'rows', jsonb_agg(
               jsonb_build_object(
                 'text', e.name
                         || coalesce('（' || e.note || '）', '')
                         || case when e.headcount > 1 then ' ×' || e.headcount::text else '' end,
                 'me', e.is_me
               ) order by e.pos
             )
           ) as card
    from entries e
    where e.org is not null
    group by e.group_id, e.org
  ),
  layers as (
    select c.group_id, jsonb_agg(c.card order by c.card_pos) as cards
    from cards c
    group by c.group_id
  ),
  agg as (
    select jsonb_agg(
             jsonb_build_object(
               'name', coalesce(g.name, ''),
               'note', g.note,
               'icon', g.icon,
               'cards', l.cards
             )
             order by (l.group_id is null), g.sort_order, g.name collate "C"
           ) as layers
    from layers l
    left join public.stakeholder_groups g on g.id = l.group_id
  )
  select case when agg.layers is null then null else jsonb_build_object('v', 2, 'layers', agg.layers) end
  from agg;
$$;

update public.works set stakeholders = private.compute_work_stakeholders(id);

commit;

-- 結果（この表を控えて報告する）: derived は適用前の「図がある作品数」と一致すること
select
  (select count(*) from public.works where stakeholders is not null) as derived,
  (select count(*) from public.works w
     where exists (select 1 from jsonb_array_elements(w.stakeholders->'layers') l where l ? 'icon')) as with_icon_key,
  (select count(*) from public.stakeholder_groups where icon is not null) as groups_with_icon;
