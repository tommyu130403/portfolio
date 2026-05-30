-- Dev environment seed data (dummy data only, not a copy of production)

INSERT INTO profile (name_jp, name_en, title, bio, hero_image_url, introduction, career_lead)
VALUES (
  'テスト 太郎',
  'Test Taro',
  'Frontend Engineer',
  'dev環境用のサンプルプロフィールです。',
  '/images/hero-placeholder.jpg',
  '{"blocks": [{"type": "paragraph", "content": "サンプル自己紹介テキストです。"}]}',
  'dev環境用のキャリアリードテキストです。'
);

INSERT INTO career_items (company, role, period, description, sort_order) VALUES
  ('サンプル株式会社A', 'フロントエンドエンジニア', '2022.04 - 現在', 'Next.js / TypeScript でプロダクト開発。', 1),
  ('サンプル株式会社B', 'Webデザイナー', '2020.04 - 2022.03', 'UIデザイン・コーディングを担当。', 2);

INSERT INTO skill_level_tokens (key, value, mode, description) VALUES
  ('skill/react', 'advanced', 'default', 'Reactスキルレベル'),
  ('skill/typescript', 'intermediate', 'default', 'TypeScriptスキルレベル'),
  ('skill/figma', 'intermediate', 'default', 'Figmaスキルレベル');

INSERT INTO projects (title, category, period, role, sort_order) VALUES
  ('サンプルプロジェクトA', 'Web', '2023.01 - 2023.06', 'デザイン・開発', 1),
  ('サンプルプロジェクトB', 'Mobile', '2022.04 - 2022.12', 'UIデザイン', 2);

INSERT INTO skill_cards (title, title_jp, icon_set, icon_name, sort_order) VALUES
  ('UI Design', 'UIデザイン', 'Edit', 'format-brush', 1),
  ('Frontend', 'フロントエンド', 'Build', 'code', 2);
