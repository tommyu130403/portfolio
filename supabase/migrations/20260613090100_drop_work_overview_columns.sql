-- Overview は本文 markdown（# Overview セクション）へ統合済みのため、旧専用カラムを削除（C-2）。
-- ※ 破壊的変更。本番へは「旧カラムを参照しないコード（本マイグレーションを含む PR）のデプロイ後」に適用すること。
alter table public.works
  drop column if exists overview,
  drop column if exists overview_cards;
