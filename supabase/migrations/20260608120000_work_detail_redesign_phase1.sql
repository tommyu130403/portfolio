-- Work 詳細ページ再デザイン (Phase 1): Hero / Overview / 情報カード用カラムを追加。
-- いずれも追加（additive）かつ NULL 許容/デフォルト付きで、既存データ・既存クエリに非破壊。
--   overview         : Overview セクションのリード本文
--   overview_cards   : アイコン付き見出しカード群（Problem/Goal 等。増減・非表示可）
--                      形: [{ "icon": "Others/thinking-problem", "heading": "Problem", "body": "..." }]
--   hero_screenshots : Hero のデバイスモックアップ画像URL群（string[]）
--   hero_bg_color    : Hero 背景のブランドカラー（null のときはデフォルトの main 緑）
-- ※ 既存 sections(jsonb) は Phase 1 でブロック型へ移行するが、jsonb のまま中身の形だけ変えるため
--   スキーマ変更は不要（アプリ側で後方互換アダプタを用意）。
alter table public.works
  add column if not exists overview         text,
  add column if not exists overview_cards   jsonb default '[]'::jsonb,
  add column if not exists hero_screenshots jsonb default '[]'::jsonb,
  add column if not exists hero_bg_color    text;
