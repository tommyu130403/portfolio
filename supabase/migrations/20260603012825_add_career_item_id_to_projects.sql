-- Career カードの Works リンク用に projects を career_items へ紐付ける FK を追加。
-- 経歴削除時はプロジェクトを残したいので ON DELETE SET NULL。
alter table public.projects
  add column career_item_id uuid
  references public.career_items(id) on delete set null;

create index if not exists idx_projects_career_item_id
  on public.projects(career_item_id);
