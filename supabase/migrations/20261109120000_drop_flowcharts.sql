-- フローチャート機能の廃止に伴い、flowcharts テーブルと関連オブジェクトを削除する。
-- 本番の flowcharts は 0 行、公開作品の本文に `::: flowchart` の参照も無いことを確認済み。
--
-- 削除するもの:
--   public.flowcharts（テーブル。付いているポリシー select_reader / insert_owner /
--     update_owner / delete_owner とトリガー・インデックスもテーブルと一緒に消える）
--   private.is_published_flowchart(uuid)
--   private.flowchart_ids_in_sections(jsonb)
--   private.flowchart_ids_in_markdown(text)
--
-- 順序: ポリシー select_reader が is_published_flowchart に依存しているため、
-- 先にテーブル（= ポリシー）を消してから関数を消す。
-- 共有ヘルパー（private.is_owner / is_reader / can_read_portfolio）には触れない。
-- 過去のマイグレーションは編集しない。

begin;

drop table if exists public.flowcharts;

drop function if exists private.is_published_flowchart(uuid);
drop function if exists private.flowchart_ids_in_sections(jsonb);
drop function if exists private.flowchart_ids_in_markdown(text);

do $$
begin
  if to_regclass('public.flowcharts') is not null then
    raise exception 'public.flowcharts が残っている';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname like '%flowchart%'
  ) then
    raise exception 'private スキーマにフローチャート関連の関数が残っている';
  end if;
end $$;

commit;
