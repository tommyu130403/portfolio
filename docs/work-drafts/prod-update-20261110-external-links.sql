-- 2026-11-10 作品本文から外部サイトへのリンクを外す(リンクの文字は残す)
-- 対象: public.works.sections の Markdown リンク [文字](https://外部)。
-- 残すもの: 画像 ![..](..)、Supabase の保存場所(kljlxjlbetaxhtxqzrdc.supabase.co)、サイト内(tommyu130403.github.io)。
-- 見本計算(2026-11-10): 4 作品 6 件 → 0 件。
--   ee9dcea3 melev.leverages.jp / 177adc06 fact-board.co.jp /
--   894c880d media.careerticket.jp, careerticket.jp / d0d0c6c6 wantedly.com, levtech-direct.jp

-- 1) 控え(書き換える行だけ)
create table if not exists private.works_sections_backup_20261110_extlinks as
select id, sections, now() as backed_up_at
from public.works
where sections::text ~ '(?<!!)\[[^\]\[]+\]\(https?://(?!kljlxjlbetaxhtxqzrdc\.supabase\.co|tommyu130403\.github\.io)';

-- 2) 書き換え
update public.works w
set sections = regexp_replace(
      w.sections::text,
      '(?<!!)\[([^\]\[]+)\]\(https?://(?!kljlxjlbetaxhtxqzrdc\.supabase\.co|tommyu130403\.github\.io)[^)\s]+\)',
      '\1', 'g')::jsonb
where w.id in (select id from private.works_sections_backup_20261110_extlinks);

-- 3) 検証(期待: 0 件)
-- select count(*) from public.works
-- where to_jsonb(works)::text ~ 'https?://(?!kljlxjlbetaxhtxqzrdc\.supabase\.co|tommyu130403\.github\.io)';

-- 戻し方
-- update public.works w set sections = b.sections
-- from private.works_sections_backup_20261110_extlinks b where w.id = b.id;
