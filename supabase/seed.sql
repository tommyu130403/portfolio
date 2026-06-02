-- Dev environment seed data (dummy data only, not a copy of production)
-- 削除済みテーブル（todos / user_skills / skill_level_tokens）への INSERT は含めない。

INSERT INTO profile (name_jp, name_en, title, bio, hero_image_url, introduction, career_lead)
VALUES (
  'テスト 太郎',
  'Test Taro',
  'Frontend Engineer',
  'dev環境用のサンプルプロフィールです。',
  '/images/hero-placeholder.jpg',
  '[{"type": "paragraph", "content": "サンプル自己紹介テキストです。"}]',
  'dev環境用のキャリアリードテキストです。'
);

INSERT INTO career_items (company, role, period, description, sort_order) VALUES
  ('サンプル株式会社A', 'フロントエンドエンジニア', '2022.04 - 現在', 'Next.js / TypeScript でプロダクト開発。', 1),
  ('サンプル株式会社B', 'Webデザイナー', '2020.04 - 2022.03', 'UIデザイン・コーディングを担当。', 2);

INSERT INTO projects (title, category, period, role, sort_order) VALUES
  ('サンプルプロジェクトA', 'Web', '2023.01 - 2023.06', 'デザイン・開発', 1),
  ('サンプルプロジェクトB', 'Mobile', '2022.04 - 2022.12', 'UIデザイン', 2);

-- スキルセクション（アコーディオン）— Figma node 502:1344 準拠
--   segments: Expert=10 / Advanced=7 / Intermediate=5 / Beginner=2（segmentsToLevel に対応）
INSERT INTO tools_vocab (name, slug, category) VALUES
  ('Figma','figma','Design Tools'),
  ('Illustrator',NULL,'Design Tools'),
  ('Photoshop',NULL,'Design Tools'),
  ('Google Analytics',NULL,'Analytics & Research'),
  ('Asana',NULL,'Project Management'),
  ('HTML',NULL,'Frontend Frameworks & UI Libraries'),
  ('CSS',NULL,'Frontend Frameworks & UI Libraries'),
  ('JavaScript',NULL,'Frontend Frameworks & UI Libraries'),
  ('TypeScript',NULL,'Frontend Frameworks & UI Libraries'),
  ('Visual Studio Code',NULL,'Source Control & Developer Platforms'),
  ('React',NULL,'Frontend Frameworks & UI Libraries'),
  ('Next.js',NULL,'Frontend Frameworks & UI Libraries'),
  ('Github','github','Source Control & Developer Platforms'),
  ('Docker',NULL,'Source Control & Developer Platforms');

WITH cards AS (
  INSERT INTO skill_cards (title,title_jp,icon_set,icon_name,sort_order) VALUES
    ('Product Design','ユーザー中心の設計とシステム構築','Components','platte',0),
    ('Product & Project Mgmt','ビジネス目標とプロジェクト推進','Peoples','peoples-two',1),
    ('Frontend & Engineering','エンジニアとの協業と実装力','Edit','code',2),
    ('AI & Emerging Tech','AIを活用したプロセス効率化とプロダクト設計','Edit','ai-intract',3)
  RETURNING id, title
),
exp AS (
  INSERT INTO skill_experience (card_id,label,label_note,icon_set,icon_name,segments,level,description,sort_order)
  SELECT c.id,e.label,e.label_note,e.icon_set,e.icon_name,e.segments,e.level,e.description,e.sort_order
  FROM (VALUES
    ('Product Design','UI Design & Visuals','UIデザイン','Edit','writing-fluently',10,'Expert',NULL::text,0),
    ('Product Design','Research & Strategy','リサーチ＆戦略','Office','file-search',10,'Expert',NULL,1),
    ('Product Design','Design Systems','デザインシステム','Base','system',10,'Expert',NULL,2),
    ('Product Design','Evaluation & Quality','評価＆品質','Components','checklist',10,'Expert',NULL,3),
    ('Product & Project Mgmt','Strategy & Discovery','戦略立案＆プロダクトディスカバリー','Connect','tree-diagram',7,'Advanced',NULL,0),
    ('Product & Project Mgmt','Delivery & Execution','プロジェクト実行＆デリバリー','Hands','delivery',10,'Expert',E'・アジャイル(スクラム)体制によるプロジェクトマネジメント\n・RACI図などによる関係者の管理と連携',1),
    ('Product & Project Mgmt','Evaluation & Metrics','評価＆メトリクス管理','Charts','chart-line',7,'Advanced',NULL,2),
    ('Frontend & Engineering','HTML / CSS / JavaScript (TypeScript)','基礎技術','Hardware','i-mac',10,'Expert','Webサイト・ハイブリッド型アプリケーション(WebView)のデザインからフロントエンドの実装まで担当',0),
    ('Frontend & Engineering','Framework / Library (React / Next.js)','モダンフレームワーク・ライブラリ','Others','toolkit',7,'Advanced',E'・Reactコンポーネントの設計 (css-module設計などを含むカプセル化)\n・React / Next.js環境のアプリケーションのフロントエンド実装、コードレビュー',1),
    ('Frontend & Engineering','Development Tools (Git / Webpack / Vite)','バージョン管理・ビルドシステム','Connect','pull-requests',7,'Advanced',NULL,2),
    ('Frontend & Engineering','Design Integration','デザイン連携','Others','magic',10,'Expert',NULL,3),
    ('AI & Emerging Tech','Tools & Workflows','ツール＆ワークフロー','Industry','spanner',7,'Advanced',NULL,0),
    ('AI & Emerging Tech','AI UX & Interaction','AI UX＆インタラクション','Datas','data-user',5,'Intermediate',NULL,1),
    ('AI & Emerging Tech','Evaluation & Ethics','評価＆倫理','Safe','balance-two',5,'Intermediate',NULL,2),
    ('AI & Emerging Tech','Strategy & Growth','戦略＆グロース','Health','pure-natural',2,'Beginner',NULL,3)
  ) AS e(card_title,label,label_note,icon_set,icon_name,segments,level,description,sort_order)
  JOIN cards c ON c.title = e.card_title
  RETURNING id, label
)
INSERT INTO skill_experience_tools (experience_id,tool_id,sort_order)
SELECT ex.id, tv.id, l.sort_order
FROM (VALUES
  ('UI Design & Visuals','Figma',0),
  ('UI Design & Visuals','Illustrator',1),
  ('UI Design & Visuals','Photoshop',2),
  ('Research & Strategy','Google Analytics',0),
  ('Design Systems','Figma',0),
  ('Evaluation & Quality','Google Analytics',0),
  ('Delivery & Execution','Asana',0),
  ('HTML / CSS / JavaScript (TypeScript)','HTML',0),
  ('HTML / CSS / JavaScript (TypeScript)','CSS',1),
  ('HTML / CSS / JavaScript (TypeScript)','JavaScript',2),
  ('HTML / CSS / JavaScript (TypeScript)','TypeScript',3),
  ('HTML / CSS / JavaScript (TypeScript)','Visual Studio Code',4),
  ('Framework / Library (React / Next.js)','React',0),
  ('Framework / Library (React / Next.js)','Next.js',1),
  ('Development Tools (Git / Webpack / Vite)','Github',0),
  ('Development Tools (Git / Webpack / Vite)','Docker',1)
) AS l(label,tool_name,sort_order)
JOIN exp ex ON ex.label = l.label
JOIN tools_vocab tv ON tv.name = l.tool_name;
