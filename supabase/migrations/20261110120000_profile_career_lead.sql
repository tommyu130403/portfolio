-- profile.career_lead: トップページ Career 見出しの下に出すリード文。
-- 2026-10-13 に Figma に無い要素として削除した列 (20261013120000_drop_profile_career_lead.sql) を、
-- オーナーの判断 (2026-11-10) で戻す。空文字のときは表示しない。
--
-- 型は bio と同じく text not null default '' (null と空の二通りを持たせない)。
-- 既存行は default で '' が入る。RLS は profile の既存ポリシー (オーナーだけ書ける) がそのまま効く。
--
-- 適用順序: 列の追加なので、コードのデプロイより先に当ててよい
-- (公開中のコードは列を参照しない。admin の保存は select("*") の spread なので列があっても壊れない)。
--
-- 検証: select column_name, data_type, is_nullable, column_default
--         from information_schema.columns
--        where table_schema = 'public' and table_name = 'profile' and column_name = 'career_lead';
--       → 1 行 (text / NO / ''::text)
--
-- ロールバック: alter table public.profile drop column if exists career_lead;

alter table public.profile add column if not exists career_lead text not null default '';
