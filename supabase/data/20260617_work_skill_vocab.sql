-- Work タグ用スキル語彙 skills_vocab の再キュレート（2026-06-17）
-- 背景: Work 編集のスキルピッカーが skill_experience（スキルセクションの長文ラベル）
--       を流用していたため、専用マスタ skills_vocab を単一ソースに切替。
--       簡潔ラベル（& / () を使わない概念粒度）へ再キュレート。
--
-- dev と本番で初期状態が異なるため適用手順が分かれる:
--   dev : work_skills が空（used=0）→ 総入替で OK
--   本番: work_skills に実リンク7件あり → 非破壊マージ（リンク保持）が必須
--         （naive な delete は FK ON DELETE RESTRICT 違反になる）

-- ── dev（aemqzbsofprgmwtpfndf）: 総入替 ────────────────────────────
-- 事前確認: select count(*) from work_skills; -- = 0 を確認してから実行
begin;
delete from skills_vocab;
insert into skills_vocab (label) values
  ('UI Design'),('UX Design'),('UX Research'),('Visual Design'),
  ('Design System'),('Prototyping'),('Wireframing'),
  ('Project Management'),('Product Management'),('Requirement Definition'),('Roadmap Planning'),
  ('Frontend Development'),('Responsive Design'),('Component Design'),('Web Accessibility'),
  ('AI UX'),('Prompt Design'),('AI Integration');
commit;

-- ── 本番（kljlxjlbetaxhtxqzrdc）: 非破壊マージ ────────────────────
-- 実リンクを保つため、旧ラベルはリネーム、不足分のみ追加する。
begin;
update skills_vocab set label = 'Frontend Development' where label = 'Frontend';
update skills_vocab set label = 'Project Management'   where label = 'PJ Management';
insert into skills_vocab (label)
select v.label from (values
  ('UI Design'),('UX Design'),('UX Research'),('Visual Design'),
  ('Design System'),('Prototyping'),('Wireframing'),
  ('Project Management'),('Product Management'),('Requirement Definition'),('Roadmap Planning'),
  ('Frontend Development'),('Responsive Design'),('Component Design'),('Web Accessibility'),
  ('AI UX'),('Prompt Design'),('AI Integration')
) as v(label)
where not exists (select 1 from skills_vocab s where s.label = v.label);
commit;
