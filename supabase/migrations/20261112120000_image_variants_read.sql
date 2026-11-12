-- 縮小版の画像(_v/<幅>/<元のパス>.webp)を、元の画像と同じ条件で閲覧者に読ませる。
-- 縮小版は scripts/make-image-variants.mjs が作る。幅は components/ProtectedImage.tsx の VariantWidth と揃える。
-- 読める範囲は変わらない: 縮小版は「元のパスが公開作品・プロフィール・公開作品のツールで使われているとき」だけ読める。

begin;

do $$
begin
  if to_regprocedure('private.is_public_portfolio_image(text)') is null then
    raise exception 'Apply 20261102123000_published_portfolio_storage_reads.sql first';
  end if;
end $$;

create or replace function private.is_public_portfolio_image(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    -- 縮小版なら元のパスに戻す。それ以外はそのまま
    select coalesce(substring(p_object_path from '^_v/(?:480|960)/(.+)\.webp$'), p_object_path) as path
  )
  select exists (
    select 1 from private.work_image_refs r
    join public.works w on w.id = r.work_id
    where r.object_path = (select path from target) and w.is_published
  ) or exists (
    select 1 from public.profile p
    where p.id = 1
      and private.portfolio_path_from_url(p.hero_image_url) = (select path from target)
  ) or exists (
    select 1 from public.tools_vocab t
    where private.portfolio_path_from_url(t.icon_url) = (select path from target)
      and exists (
        select 1 from public.work_tools wt
        join public.works w on w.id = wt.work_id
        where wt.tool_id = t.id and w.is_published
      )
  )
$$;

-- create or replace は権限を保つが、念のため元の migration と同じに揃える
revoke execute on function private.is_public_portfolio_image(text) from public, anon;
grant execute on function private.is_public_portfolio_image(text) to authenticated;

commit;
