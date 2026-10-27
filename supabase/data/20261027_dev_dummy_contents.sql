-- dev 専用のダミーデータ。制作内容タグ (contents_vocab / work_contents) と期間 (start_date / end_date) を
-- 公開中の作品に入れて、一覧カード・作品詳細の新しい表示を確認するためのもの。
-- 本番には流さない。何度流しても同じ結果になる (語彙は on conflict、紐付けは作品ごとに作り直し、期間は空の行だけ埋める)。
--
-- 前提: 20261027120000_work_contents.sql を適用済み。
-- 戻し方: delete from public.work_contents; delete from public.contents_vocab;
--         (期間は 3. で埋めた作品の start_date / end_date / is_current を手で null / false に戻す)

begin;

-- 1. 語彙
insert into public.contents_vocab (label, sort_order) values
  ('Product Design', 1),
  ('Service Design', 2),
  ('Web Application', 3),
  ('Mobile Application', 4),
  ('Design System Construction', 5),
  ('BtoC', 6),
  ('BtoB', 7),
  ('SaaS', 8)
on conflict (label) do nothing;

-- 2. 公開中の作品に、並び順で違う組み合わせを付ける (紐付けは先に消して作り直す)
delete from public.work_contents where work_id in (select id from public.works where is_published = true);

with w as (
  select id, row_number() over (order by sort_order, created_at) as n
  from public.works
  where is_published = true
),
pick as (
  select w.id as work_id, c.label, c.ord
  from w
  join lateral (
    select * from (values
      -- n % 3 = 1
      (1, 'Product Design', 0), (1, 'BtoC', 1), (1, 'SaaS', 2), (1, 'Mobile Application', 3),
      -- n % 3 = 2
      (2, 'Service Design', 0), (2, 'BtoB', 1), (2, 'Web Application', 2),
      -- n % 3 = 0
      (0, 'Design System Construction', 0), (0, 'Web Application', 1)
    ) as v(grp, label, ord)
    where v.grp = (w.n % 3)
  ) c on true
)
insert into public.work_contents (work_id, content_id, sort_order)
select p.work_id, v.id, p.ord
from pick p
join public.contents_vocab v on v.label = p.label;

-- 3. 期間が空の作品だけ、日付を埋める (period の文字はトリガーが日付から作り直す)
--    1 件目: 2023.4 - 2023.9 / 2 件目: 2024.1 - 現在 / 3 件目以降: 2022.10 - 2023.3 … と半年ずつずらす
with w as (
  select id, row_number() over (order by sort_order, created_at) as n
  from public.works
  where is_published = true and start_date is null
)
update public.works t set
  start_date = case when w.n = 1 then date '2023-04-01'
                    when w.n = 2 then date '2024-01-01'
                    else (date '2022-10-01' - ((w.n - 3) * interval '6 months'))::date end,
  end_date   = case when w.n = 1 then date '2023-09-01'
                    when w.n = 2 then null
                    else (date '2023-03-01' - ((w.n - 3) * interval '6 months'))::date end,
  is_current = (w.n = 2)
from w where w.id = t.id;

commit;

-- 確認 (別の Run で):
-- select w.title, w.period, string_agg(c.label, ' / ' order by wc.sort_order) as contents
-- from public.works w
-- left join public.work_contents wc on wc.work_id = w.id
-- left join public.contents_vocab c on c.id = wc.content_id
-- where w.is_published = true group by w.id, w.title, w.period, w.sort_order order by w.sort_order;
