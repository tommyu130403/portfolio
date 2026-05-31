-- ============================================================================
-- Drop unused tables (2026-05-31)
--   - todos              … コード未参照（prod 1行 / dev 0行）
--   - user_skills        … スキルマトリクス機能廃止（PR #39 でレーダー除去。prod 2行 / dev 0行）
--   - skill_level_tokens … 現行コード未参照の Figma トークン残骸（prod 5行 / dev 3行）
--
-- ⚠️ 本番（kljlxjlbetaxhtxqzrdc）適用前に必ずデータをバックアップすること。
--    MCP / SQL Editor で以下を実行し結果を保存しておく:
--
--    select
--      (select coalesce(json_agg(t),'[]') from public.todos t)               as todos,
--      (select coalesce(json_agg(t),'[]') from public.user_skills t)         as user_skills,
--      (select coalesce(json_agg(t),'[]') from public.skill_level_tokens t)  as skill_level_tokens;
--
--    あるいは: supabase db dump --data-only \
--      -t public.todos -t public.user_skills -t public.skill_level_tokens \
--      -f supabase/backups/20260531_dropped_tables_data.sql
-- ============================================================================

DROP TABLE IF EXISTS public.todos CASCADE;
DROP TABLE IF EXISTS public.user_skills CASCADE;
DROP TABLE IF EXISTS public.skill_level_tokens CASCADE;
