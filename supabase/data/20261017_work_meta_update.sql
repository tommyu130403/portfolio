-- 作品詳細の 役割 / 関係者 / スキル / ツール を引き継ぎ資料に合わせて更新する（2026-10-17）
-- 実行先: 本番 kljlxjlbetaxhtxqzrdc（SQL Editor で実行）
-- 控え:   supabase/backups/20261017_work_meta_pre_update.json
--
-- 方針
-- - 関係者は「職種名+人数」を「・」でつなぐ（画面側が分解して人数バッジ付きタグにする）。
--   人数に分解できない作品（サービス間連携 / EFO / 採用・育成）と、記録のない募集掲載は触らない。
-- - 略語の読み替え: PO→事業責任者 / PM→プロジェクトマネージャー / De→デザイナー /
--   En→エンジニア / Dir→ディレクター / CS→カスタマーサクセス
-- - スキル・ツールは既存の語彙（skills_vocab.label / tools_vocab.name）から引く。語彙は増やさない。
-- - 立ち上げ（894c880d）のスキルは今の7件を維持するため work_skills を触らない。

begin;

-- ------------------------------------------------------------------
-- 1. 役割・関係者
-- ------------------------------------------------------------------
update works set stakeholder_breakdown = '事業責任者1・デザイナー1・エンジニア1'
  where id = '0e986137-1b6c-408c-a99b-d734058fd845';

update works set role = 'デザインリード・プロジェクトマネージャー'
  where id = '11a52276-96b7-48e2-8275-17648f3247ea';

update works set stakeholder_breakdown = '事業責任者1・プロジェクトマネージャー1・エンジニア3・デザイナー2'
  where id in ('2de17215-462a-4486-b4de-c9ce3ba90229', '412da8f6-cd0b-4569-b29f-402c8d6470df');

update works set stakeholder_breakdown = '事業責任者1・プロジェクトマネージャー兼デザイナー1・エンジニア3・デザイナー1'
  where id = '65afbbb3-1ba4-40f7-ab1e-538b34c65847';

update works set stakeholder_breakdown = 'ディレクター1・デザイナー1・エンジニア2'
  where id = '6d8bb338-c19d-4235-8317-196ace01aaf9';

update works set role = 'デザインリード・プロジェクトマネージャー',
                 stakeholder_breakdown = '事業責任者1・プロジェクトマネージャー兼デザイナー1・エンジニア3・デザイナー1'
  where id = '894c880d-8a59-48e0-aebc-eb25c904cb2b';

update works set stakeholder_breakdown = '事業責任者1・プロジェクトマネージャー兼デザイナー1・エンジニア3・デザイナー1・カスタマーサクセス2'
  where id = '94734d87-a54f-4588-a521-e9ea414b9ef0';

-- ------------------------------------------------------------------
-- 2. スキル（作品ごとに入れ替え。894c880d は対象外）
-- ------------------------------------------------------------------
delete from work_skills where work_id in (
  '0e986137-1b6c-408c-a99b-d734058fd845', '11a52276-96b7-48e2-8275-17648f3247ea',
  '2de17215-462a-4486-b4de-c9ce3ba90229', '412da8f6-cd0b-4569-b29f-402c8d6470df',
  '65afbbb3-1ba4-40f7-ab1e-538b34c65847', '6d8bb338-c19d-4235-8317-196ace01aaf9',
  '723313f5-dd84-4557-a63d-f6a9b92f60f9', '94734d87-a54f-4588-a521-e9ea414b9ef0',
  'ab150f48-3da7-47b6-ba3d-f0b624e8ff29', 'c58ff371-9532-4634-8b7b-938f9d91bbf9'
);

insert into work_skills (work_id, skill_id, sort_order)
select v.work_id::uuid, s.id, v.ord
from (values
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'Requirement Definition', 0),
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'Prototyping', 1),
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'UI Design', 2),
  ('11a52276-96b7-48e2-8275-17648f3247ea', 'Project Management', 0),
  ('11a52276-96b7-48e2-8275-17648f3247ea', 'Requirement Definition', 1),
  ('2de17215-462a-4486-b4de-c9ce3ba90229', 'UI Design', 0),
  ('2de17215-462a-4486-b4de-c9ce3ba90229', 'UX Design', 1),
  ('412da8f6-cd0b-4569-b29f-402c8d6470df', 'Requirement Definition', 0),
  ('412da8f6-cd0b-4569-b29f-402c8d6470df', 'UI Design', 1),
  ('412da8f6-cd0b-4569-b29f-402c8d6470df', 'UX Design', 2),
  ('65afbbb3-1ba4-40f7-ab1e-538b34c65847', 'UX Research', 0),
  ('65afbbb3-1ba4-40f7-ab1e-538b34c65847', 'UI Design', 1),
  ('6d8bb338-c19d-4235-8317-196ace01aaf9', 'UI Design', 0),
  ('6d8bb338-c19d-4235-8317-196ace01aaf9', 'UX Research', 1),
  ('723313f5-dd84-4557-a63d-f6a9b92f60f9', 'UI Design', 0),
  ('723313f5-dd84-4557-a63d-f6a9b92f60f9', 'UX Design', 1),
  ('94734d87-a54f-4588-a521-e9ea414b9ef0', 'UX Research', 0),
  ('94734d87-a54f-4588-a521-e9ea414b9ef0', 'UX Design', 1),
  ('ab150f48-3da7-47b6-ba3d-f0b624e8ff29', 'UI Design', 0),
  ('ab150f48-3da7-47b6-ba3d-f0b624e8ff29', 'UX Research', 1),
  ('ab150f48-3da7-47b6-ba3d-f0b624e8ff29', 'Requirement Definition', 2)
) as v(work_id, label, ord)
join skills_vocab s on s.label = v.label;

-- ------------------------------------------------------------------
-- 3. ツール（全11作品を入れ替え）
-- ------------------------------------------------------------------
delete from work_tools where work_id in (select id from works);

insert into work_tools (work_id, tool_id, sort_order)
select v.work_id::uuid, t.id, v.ord
from (values
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'STUDIO', 0),
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'Figma', 1),
  ('0e986137-1b6c-408c-a99b-d734058fd845', 'Asana', 2),
  ('11a52276-96b7-48e2-8275-17648f3247ea', 'Asana', 0),
  ('11a52276-96b7-48e2-8275-17648f3247ea', 'Figma', 1),
  ('2de17215-462a-4486-b4de-c9ce3ba90229', 'Asana', 0),
  ('412da8f6-cd0b-4569-b29f-402c8d6470df', 'Figma', 0),
  ('65afbbb3-1ba4-40f7-ab1e-538b34c65847', 'Figma', 0),
  ('6d8bb338-c19d-4235-8317-196ace01aaf9', 'Google Optimize', 0),
  ('723313f5-dd84-4557-a63d-f6a9b92f60f9', 'Google Optimize', 0),
  ('894c880d-8a59-48e0-aebc-eb25c904cb2b', 'Figma', 0),
  ('94734d87-a54f-4588-a521-e9ea414b9ef0', 'Figma', 0)
) as v(work_id, name, ord)
join tools_vocab t on t.name = v.name;

-- ------------------------------------------------------------------
-- 4. 件数チェック（期待: スキル 21+7=28 / ツール 12。違えば rollback）
-- ------------------------------------------------------------------
do $$
declare n_skills int; n_tools int;
begin
  select count(*) into n_skills from work_skills;
  select count(*) into n_tools from work_tools;
  if n_skills <> 28 or n_tools <> 12 then
    raise exception '件数が想定と違う: work_skills=% (期待28) / work_tools=% (期待12)', n_skills, n_tools;
  end if;
end $$;

commit;
