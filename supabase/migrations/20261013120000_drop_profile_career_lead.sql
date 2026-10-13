-- profile.career_lead (トップページ Career のリード文) は、表示を PR #95 で、
-- 管理画面の入力欄を PR #96 で削除済み。どこからも読み書きされない列になったため削除する。
--
-- 適用順序: PR #96 は 2026-10-13 に GitHub Pages へデプロイ済み。公開中のコードは
-- career_lead を明示列挙していない (admin は select("*") の結果を spread して upsert) ため、
-- 本マイグレーションはデプロイ待ちの縛りなく適用できる。
--
-- 適用前の実測値は本番 1 行とも null (supabase/backups/20261013_profile_career_lead_pre_drop.json)。
-- dev 1 行は seed のダミー文 (21 文字) のみで、控えは取っていない。
--
-- ※ 破壊的変更。
--
-- ロールバック (text / nullable / default なし。値は上記バックアップから戻す):
--   alter table public.profile add column if not exists career_lead text;

alter table public.profile drop column if exists career_lead;
