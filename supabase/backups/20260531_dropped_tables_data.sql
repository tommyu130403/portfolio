-- ============================================================================
-- 削除対象テーブルの本番データ バックアップ（prod: kljlxjlbetaxhtxqzrdc）
-- 取得日時: 2026-05-31 / Supabase MCP 経由で実データを退避
--   - todos: 1 行 / user_skills: 2 行 / skill_level_tokens: 5 行
-- 復元が必要な場合は、対象テーブルを再作成した上で以下を実行する。
-- ============================================================================

-- ── todos ───────────────────────────────────────────────────────────────────
INSERT INTO public.todos (id, title, contents, start_date, end_date) VALUES
  (1, 'title1', 'contents1', '2024-02-19', '2024-02-19');

-- ── user_skills ──────────────────────────────────────────────────────────────
INSERT INTO public.user_skills
  (id, user_id, prototype, visual, interaction, ia, presentation, updated_at, is_target,
   implementation, accessibility, writing, qualitative_research, quantitative_research, strategy, facilitation) VALUES
  ('3874131b-8281-4310-9312-0b1da24ee86f', 'c1a30e69-bc3a-429a-8adb-31d4c69a3a28',
   3.5, 5, 5, 5, 5, '2026-03-22T15:07:16.181368+00:00', false,
   3, 3, 3, 4, 3, 4, 4),
  ('951b2625-b4f1-4582-b5f7-3bdd9d84d75b', 'c1a30e69-bc3a-429a-8adb-31d4c69a3a28',
   5, 5, 5, 5, 5, '2026-03-22T15:07:16.181368+00:00', true,
   4, 5, 4, 5, 4, 5, 5);

-- ── skill_level_tokens ───────────────────────────────────────────────────────
INSERT INTO public.skill_level_tokens
  (key, value, description, figma_variable_id, figma_type, is_override, scopes, updated_at) VALUES
  ('Level.1', 'Lv.1 Novice',  'Lv.1 指示やマニュアルに従って、定型的なタスクを完了できる。',                 'VariableID:515:2846', 'string', true, ARRAY['ALL_SCOPES'], '2026-03-18T13:50:40.724913+00:00'),
  ('Level.2', 'Lv.2 Pro.',    'Lv.2 標準的な案件を独力で完結させ、一定の品質を担保できる。',                 'VariableID:515:2847', 'string', true, ARRAY['ALL_SCOPES'], '2026-03-18T13:50:40.724913+00:00'),
  ('Level.3', 'Lv.3 Senior',  'Lv.3 複雑な課題に対し、最適な手法を選択・提案し、他者のレビューができる。',     'VariableID:515:2851', 'string', true, ARRAY['ALL_SCOPES'], '2026-03-18T13:50:40.724913+00:00'),
  ('Level.4', 'Lv.4 Expert',  'Lv.4 組織横断的な課題を解決し、デザインによる事業の競争優位性を作る。',         'VariableID:515:2855', 'string', true, ARRAY['ALL_SCOPES'], '2026-03-18T13:50:40.724913+00:00'),
  ('Level.5', 'Lv.5 Master',  'Lv.5 業界標準や組織のあり方を再定義し、社内外に多大な影響を与える。',           'VariableID:516:2859', 'string', true, ARRAY['ALL_SCOPES'], '2026-03-18T13:50:40.724913+00:00');
