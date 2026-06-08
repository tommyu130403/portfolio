-- Work 詳細 Hero のブランド名（プロダクト/サービス名のワードマーク）用カラムを追加。
-- Figma では左上に "Bistecca" のようなブランド名を表示する（category・title とは別）。
-- additive・NULL 許容で非破壊。
alter table public.works
  add column if not exists hero_brand text;
