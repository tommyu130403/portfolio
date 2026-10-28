-- work_categories にカテゴリ色 (色相) の列を足す。
--
-- 理由: 作品カテゴリごとに色を持たせ、公開サイトのカテゴリタグを色分けするため (D案: 背景 oklch(0.30 0.06 h)・文字 oklch(0.88 0.09 h))。
--       color_hue は 0〜359 の整数。NULL は「色なし」で、従来の見た目 (Main/600 地) のまま。
--       既存の update_owner ポリシーが列追加後もそのまま更新を許可するので、ポリシーの変更は不要。
--
-- 適用順序:
--   1. 本マイグレーションを dev に適用 → 検証 SQL を流す → 本番に適用 → 検証 SQL を流す。
--      (nullable 列の追加と、未設定行への初期色の割り当て。設定済みの行は変えない)
--   2. フロントをデプロイする。先にデプロイすると color_hue を読む select が失敗してカテゴリが出ない。
--
-- ロールバック (以下をコメント解除して流す):
--   -- 先にフロントを color_hue を参照しない版へ戻すこと。
--   alter table public.work_categories drop column if exists color_hue;
--   notify pgrst, 'reload schema';
--
-- 検証 SQL (適用後に本体とは別の Run で流す):
--   select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='work_categories' and column_name='color_hue';
--     -- 期待: color_hue smallint YES
--   select name, color_hue from public.work_categories order by sort_order, name;
--     -- 期待: 全行の color_hue が NULL でなく、0〜359 の値。先頭から 165, 210, 255, ... の順

alter table public.work_categories
  add column if not exists color_hue smallint
  check (color_hue is null or (color_hue >= 0 and color_hue <= 359));

-- 初期色: 色が未設定のカテゴリに、D案の 8 色 (165/210/255/300/345/30/75/120) を並び順 (sort_order, name) で順番に割り当てる。
-- 8 件を超えると色は繰り返す。設定済みの行は変えない (未設定の行だけが対象。「なし」にした行は流し直すと色が付く)。
with ranked as (
  select id, (row_number() over (order by sort_order, name)) - 1 as rn
  from public.work_categories
  where color_hue is null
)
update public.work_categories c
  set color_hue = (array[165, 210, 255, 300, 345, 30, 75, 120])[(r.rn % 8) + 1]
  from ranked r
  where c.id = r.id;

notify pgrst, 'reload schema';
