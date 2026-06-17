-- Phase 2: Work 詳細の Timeline（_Process）/ Stakeholders（_Stakeholder）用カラムを追加。
-- 本文 markdown の「::: timeline」「::: stakeholders」ディレクティブ位置に描画される構造化データ。
--   timeline:     { totalUnits, phases: [{ label, start, span, raci: ["R"|"A"|"C"|"I"], progress, note: { title, body } }] }
--   stakeholders: { groups: [{ label, icon, members: [{ label, me }] }] }
alter table public.works
  add column if not exists timeline     jsonb,
  add column if not exists stakeholders jsonb;
