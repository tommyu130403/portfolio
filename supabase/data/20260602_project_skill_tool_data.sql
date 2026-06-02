-- ============================================================================
-- プロジェクトセクション用 スキル／ツール データ入替（2026-06-02）
--
-- 出典シート（プロジェクトの各アイテムで呼び出すデータ）:
--   https://docs.google.com/spreadsheets/d/1r7-4RQyTcEW0we8D8mdvjzIungNjFSl1Q0xP3BIpmeg/
--   Skills 列(6): PJ Management / Product Management / UI Design / Visual Design /
--                 Frontend / UX Research
--   Tools  列(23): Figma, Illustrator, Photoshop, Asana, Google Analytics, Docker,
--                  React, Vue.js, HTML, CSS, JavaScript, TypeScript, Webpack, Vite,
--                  STUDIO, Claude Code, Claude Design, Codex, Github,
--                  Visual Studio Code, Storybook, Cursor, Next.js
--
-- 方針（ユーザー確認済み）:
--   * スキル: skills_vocab を上記6件へ総入替。スキルセクション(skill_experience系)は
--             skills_vocab を参照しないため無影響。プロジェクト紐付けは下記の推論
--             マッピングで再構築。
--   * ツール: 共有 tools_vocab に対し「無い項目は追加 / 同一は新データ優先」。
--             実質は新規5件(Vue.js/Webpack/Vite/Claude Design/Codex)追加と
--             重複統合(HTML×3→1, 未使用 css設計 削除)のみ。シート外ツールは保持。
--
-- 推論マッピング（シートに対応表が無いため best-effort・ユーザー承認済み）:
--   Strategy & Discovery  -> Product Management
--   UI Design & Visuals   -> UI Design
--   UIデザイン            -> UI Design
--   UX設計                -> UX Research
--   フロントエンド        -> Frontend
--
-- 注意:
--   * これは「スキーマ」ではなく「データ」の記録（適用時点のスナップショット）。
--     ソース・オブ・トゥルースは実DB。supabase/migrations/ には置かない
--     （db reset で流さないため）。
--   * 名前・ラベル基準で冪等。dev/prod どちらにも再実行可能。
-- ============================================================================

BEGIN;

-- ───────── TOOLS ─────────
-- T1) 新規ツール5件を追加（既存名はスキップ）
INSERT INTO tools_vocab (name, slug, category)
SELECT v.name, v.slug, v.category FROM (VALUES
  ('Vue.js','vue','Frontend Frameworks & UI Libraries'),
  ('Webpack','webpack','Frontend Frameworks & UI Libraries'),
  ('Vite','vite','Frontend Frameworks & UI Libraries'),
  ('Claude Design', NULL, NULL),
  ('Codex', NULL, NULL)
) AS v(name,slug,category)
WHERE NOT EXISTS (SELECT 1 FROM tools_vocab t WHERE lower(t.name)=lower(v.name));

-- T2) HTML 重複3行 → カテゴリ付き1行へ統合（参照を生存行へ張替え後に削除）
DO $$
DECLARE surv uuid; dups uuid[];
BEGIN
  SELECT id INTO surv FROM tools_vocab WHERE lower(name)='html'
    ORDER BY (category IS NOT NULL) DESC, created_at ASC LIMIT 1;
  SELECT array_agg(id) INTO dups FROM tools_vocab WHERE lower(name)='html' AND id<>surv;
  IF dups IS NOT NULL THEN
    INSERT INTO project_tools(project_id,tool_id,sort_order)
      SELECT project_id,surv,sort_order FROM project_tools WHERE tool_id=ANY(dups)
      ON CONFLICT DO NOTHING;
    DELETE FROM project_tools WHERE tool_id=ANY(dups);
    INSERT INTO skill_experience_tools(experience_id,tool_id,sort_order)
      SELECT experience_id,surv,sort_order FROM skill_experience_tools WHERE tool_id=ANY(dups)
      ON CONFLICT DO NOTHING;
    DELETE FROM skill_experience_tools WHERE tool_id=ANY(dups);
    DELETE FROM tools_vocab WHERE id=ANY(dups);
  END IF;
END $$;

-- T3) 未使用の重複 'css設計' を削除（参照ゼロのみ）
DELETE FROM tools_vocab tv WHERE tv.name='css設計'
  AND NOT EXISTS (SELECT 1 FROM project_tools pt WHERE pt.tool_id=tv.id)
  AND NOT EXISTS (SELECT 1 FROM skill_experience_tools st WHERE st.tool_id=tv.id);

-- ───────── SKILLS ─────────
-- S1) 新規スキル6件を追加（既存ラベルはスキップ）
INSERT INTO skills_vocab (label)
SELECT v.label FROM (VALUES
  ('PJ Management'),('Product Management'),('UI Design'),
  ('Visual Design'),('Frontend'),('UX Research')
) v(label)
WHERE NOT EXISTS (SELECT 1 FROM skills_vocab s WHERE lower(s.label)=lower(v.label));

-- S2) project_skills を新ラベルへ再マッピング
WITH map(old_label,new_label) AS (VALUES
  ('Strategy & Discovery','Product Management'),
  ('UI Design & Visuals','UI Design'),
  ('UIデザイン','UI Design'),
  ('UX設計','UX Research'),
  ('フロントエンド','Frontend')
)
INSERT INTO project_skills(project_id,skill_id,sort_order)
SELECT ps.project_id, nsv.id, ps.sort_order
FROM project_skills ps
JOIN skills_vocab osv ON osv.id=ps.skill_id
JOIN map m ON m.old_label=osv.label
JOIN skills_vocab nsv ON nsv.label=m.new_label
ON CONFLICT (project_id,skill_id) DO NOTHING;

-- S2.5) 旧ラベルを指す project_skills 紐付けを除去
--       （S2 で新リンクを張った後に旧リンクを消す。これをしないと S3 が FK 違反になる）
DELETE FROM project_skills
WHERE skill_id IN (
  SELECT id FROM skills_vocab WHERE label NOT IN
    ('PJ Management','Product Management','UI Design','Visual Design','Frontend','UX Research')
);

-- S3) 新6件以外の skills_vocab を総入替で削除（参照が消えた旧語彙を物理削除）
DELETE FROM skills_vocab
WHERE label NOT IN
  ('PJ Management','Product Management','UI Design','Visual Design','Frontend','UX Research');

COMMIT;
