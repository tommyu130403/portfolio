-- summary とサイトリンク (site_url / site_title / site_thumbnail_url) は
-- Figma の _ProjectContents に席が無く、2026-09-08 (PR #90) で公開側の表示を削除した。
-- admin にだけ入力欄が残り「入力しても絶対に表示されないデータ」になっていたため、
-- カラムごと削除する。適用前の実測値は本番 4 行 / dev 5 行ともすべて null
-- (supabase/backups/20260911_works_pre_drop.json)。
--
-- ※ 破壊的変更。本番へは「旧カラムを参照しないコード (本マイグレーションを含む PR) の
--    デプロイ後」に適用すること。app/admin/actions.ts の saveWork が
--    これらのカラムを明示列挙して upsert しているため、先に本番へ当てると
--    デプロイ完了までの間 Works の保存が失敗する。
--
-- ロールバック (4 カラムとも text / nullable / default なし):
--   alter table public.works
--     add column if not exists summary text,
--     add column if not exists site_url text,
--     add column if not exists site_title text,
--     add column if not exists site_thumbnail_url text;

alter table public.works
  drop column if exists summary,
  drop column if exists site_url,
  drop column if exists site_title,
  drop column if exists site_thumbnail_url;
