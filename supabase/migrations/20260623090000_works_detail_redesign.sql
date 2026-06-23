-- Works 詳細ページ刷新（モーダル → 独立ページ）に伴うカラム追加
-- 左パネルの新要素: サマリー本文 / サイトリンクカード / 体制内訳テキスト
alter table public.works
  add column if not exists summary text,
  add column if not exists site_url text,
  add column if not exists site_title text,
  add column if not exists site_thumbnail_url text,
  add column if not exists stakeholder_breakdown text;

-- Tools をアイコン表示するためのロゴ URL（任意・未設定時はテキスト Tag フォールバック）
alter table public.tools_vocab
  add column if not exists icon_url text;
