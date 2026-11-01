-- 役割 → 関係者グループ・役職ありの事前割当（テンプレート）。
-- 手順:
--   1. 先に 20261101120000_stakeholder_groups.sql（本体）を適用しておく。
--   2. `select name from public.roles order by sort_order, name;` を流して役割名の一覧を見る。
--   3. 下の values 表に ('役割名', 'グループ名', 役職ありなら true / なしなら false) を手で書き足す。
--      グループ名は Product / Project / Designer / Engineer のいずれか（stakeholder_groups.name と同じ）。
--   4. 全体を流す。group_id が未設定の役割だけを更新するので、再実行しても安全（設定済みの役割は上書きしない）。
-- '__例__' の行は実在の役割に一致しない見本。消さずに残してよい。

update public.roles r
set group_id = g.id, is_titled = m.titled
from (values
  -- 2026-11-01 dev の役割 18 件から作成（本番も同じ名前なら流用できる。違う名前は追記する）
  ('事業責任者',                   'Product',  true),
  ('企画の主担当',                 'Product',  true),
  ('プロジェクトマネージャー',     'Project',  true),
  ('プロジェクトマネージャー兼デザイナー', 'Project', true),
  ('ディレクター',                 'Project',  true),
  ('デザインリード',               'Designer', true),
  ('リードUI/UXデザイナー',        'Designer', true),
  ('デザイナー',                   'Designer', false),
  ('Webデザイナー',                'Designer', false),
  ('UIデザイナー',                 'Designer', false),
  ('UI/UXデザイナー',              'Designer', false),
  ('ジュニアWebデザイナー',        'Designer', false),
  ('UIデザイン',                   'Designer', false),
  ('エンジニア',                   'Engineer', false),
  ('フロントエンドエンジニア',     'Engineer', false),
  -- 2026-11-01 本番の役割名（dev と異なる 6 件）から追加
  ('事業デザイン責任者',           'Product',  true),
  ('プロダクトマネージャー',       'Product',  true),
  ('プランナー',                   'Product',  false),
  ('リードデザイナー',             'Designer', true),
  ('WEBデザイナー',                'Designer', false),
  -- 未割当（グループを判断できない。管理画面で設定する）: カスタマーサクセス / インターン / 研修 / メンター
  ('__例__', 'Designer', false)
) as m(name, grp, titled)
join public.stakeholder_groups g on g.name = m.grp
where r.name = m.name and r.group_id is null;
-- 続けて全作品の図を作り直す
select private.refresh_work_stakeholders(array(select id from public.works));
-- 未割当の確認
select name from public.roles where group_id is null order by sort_order, name;
