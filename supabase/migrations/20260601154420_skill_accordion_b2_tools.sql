-- ============================================================================
-- Skill section accordion redesign — B-2 tools linkage (2026-06-01)
--   スキルセクションのアコーディオン化に伴うスキーマ拡張。
--
--   (A) skill_experience に展開行表現用の列を追加（icon / label_note）
--   (B-2) ツールをスキル行単位で持つため中間テーブル skill_experience_tools を新設し、
--         tools_vocab に slug フォールバック用の category 列を追加。
--         （既存 project_tools / project_skills の中間テーブル流儀に準拠）
--   (C) 新テーブルの RLS は既存 skill_* と同一の3ポリシー。
--
--   レガシーの public.skill_tools（カード単位）は残置（表示は中間テーブル経由へ移行）。
-- ============================================================================

-- (A) skill_experience: 展開行の表現に必要な列
ALTER TABLE public.skill_experience
  ADD COLUMN IF NOT EXISTS icon_set   text,   -- スキル行アイコンのカテゴリ（例 "Edit"）
  ADD COLUMN IF NOT EXISTS icon_name  text,   -- スキル行アイコン名（例 "writing-fluently"）
  ADD COLUMN IF NOT EXISTS label_note text;   -- 展開時の JP 短ラベル（例 "UIデザイン"）

-- (B-2) tools_vocab: ロゴ未整備時のカテゴリーアイコン・フォールバック用（slug は既存）
ALTER TABLE public.tools_vocab
  ADD COLUMN IF NOT EXISTS category text;

-- (B-2) スキル行 × ツール の中間テーブル
CREATE TABLE IF NOT EXISTS public.skill_experience_tools (
  experience_id uuid NOT NULL REFERENCES public.skill_experience(id) ON DELETE CASCADE,
  tool_id       uuid NOT NULL REFERENCES public.tools_vocab(id)      ON DELETE CASCADE,
  sort_order    int  NOT NULL DEFAULT 0,
  PRIMARY KEY (experience_id, tool_id)
);

-- (C) RLS: 既存 skill_* と同一の3ポリシー
ALTER TABLE public.skill_experience_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon full access skill_experience_tools" ON public.skill_experience_tools;
CREATE POLICY "anon full access skill_experience_tools"
  ON public.skill_experience_tools FOR ALL    TO anon   USING (true);

DROP POLICY IF EXISTS "auth write skill_experience_tools" ON public.skill_experience_tools;
CREATE POLICY "auth write skill_experience_tools"
  ON public.skill_experience_tools FOR ALL    TO public USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "public read skill_experience_tools" ON public.skill_experience_tools;
CREATE POLICY "public read skill_experience_tools"
  ON public.skill_experience_tools FOR SELECT TO public USING (true);
