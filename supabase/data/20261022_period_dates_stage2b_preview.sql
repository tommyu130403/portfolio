with src as (
  select 'career_items'::text as tbl, id, sort_order, (company || ' / ' || role) as label, period from public.career_items
  union all
  select 'works', id, sort_order, title, period from public.works
), g as (
  select s.*, regexp_match(
    regexp_replace(translate(coalesce(s.period, ''), '０１２３４５６７８９', '0123456789'), '^[\s　]+|[\s　]+$', '', 'g'),
    '^([0-9]{4})(?:年([0-9]{1,2})月|\.([0-9]{1,2}))\s*[-–−~〜～]\s*(?:(現在)|([0-9]{4})(?:年([0-9]{1,2})月|\.([0-9]{1,2})))?$') as m
  from src s
), n as (
  select g.*, m[1]::integer as sy, coalesce(m[2], m[3])::integer as sm, m[4] is not null as cur,
         m[5]::integer as ey, coalesce(m[6], m[7])::integer as em
  from g
), r as (
  select n.*,
    case
      when m is null then null
      when sy not between 1900 and 2100 or sm not between 1 and 12 then null
      when ey is not null and (ey not between 1900 and 2100 or em not between 1 and 12 or ey * 12 + em < sy * 12 + sm) then null
      else sy::text || '年' || sm::text || '月 - '
           || case when cur then '現在' when ey is not null then ey::text || '年' || em::text || '月' else '' end
    end as after
  from n
)
select tbl, id, label, period as before, after,
  case
    when after is null and regexp_replace(coalesce(period, ''), '^[\s　]+|[\s　]+$', '', 'g') = '' then '空'
    when after is null then '旧形式のまま'
    when after = period then '変化なし'
    else '書き換え'
  end as status
from r
order by tbl, sort_order;
