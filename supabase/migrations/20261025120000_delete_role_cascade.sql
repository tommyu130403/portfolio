-- 役割（roles）を、使用中でも削除できるようにする関数 delete_role を追加する。
-- 目的: 管理画面の Masters で、経歴・作品の担当役割・体制内訳に使われている役割も
--       確認ダイアログのうえで削除できるようにする。
-- 動作: 1つの関数の中（= 1トランザクション）で次を行う。
--   - career_items.role_id を null にする（文字列の role 列はそのまま残す）
--   - work_roles / work_stakeholder_counts の該当行を削除する
--   - roles の行を削除する
--   - 影響を受けた作品の works.role / works.stakeholder_breakdown を rename_role と同じ式で作り直す
-- 適用: ユーザーが Supabase の SQL Editor で実行する（dev → 本番の順）。
-- ロールバック（必要になったら下の行を実行）:
-- drop function if exists public.delete_role(uuid);

create or replace function public.delete_role(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exists boolean;
  v_rows integer;
  v_role_works uuid[];
  v_breakdown_works uuid[];
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can delete a role';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio-work-save'));
  select exists (select 1 from public.roles where id = p_id) into v_exists;
  if not v_exists then
    raise exception '役割が見つかりません';
  end if;

  select array_agg(distinct work_id) into v_role_works
    from public.work_roles where role_id = p_id;
  select array_agg(distinct work_id) into v_breakdown_works
    from public.work_stakeholder_counts where role_id = p_id;

  update public.career_items set role_id = null where role_id = p_id;
  delete from public.work_roles where role_id = p_id;
  delete from public.work_stakeholder_counts where role_id = p_id;
  delete from public.roles where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '権限がないか、役割が見つかりません';
  end if;

  if v_role_works is not null then
    update public.works w set role = (
        select string_agg(r.name, '・' order by wr.sort_order)
        from public.work_roles wr join public.roles r on r.id = wr.role_id
        where wr.work_id = w.id
      )
      where w.id = any(v_role_works);
  end if;
  if v_breakdown_works is not null then
    update public.works w set stakeholder_breakdown = (
        select string_agg(r.name || c.headcount::text, '・' order by c.sort_order)
        from public.work_stakeholder_counts c join public.roles r on r.id = c.role_id
        where c.work_id = w.id
      )
      where w.id = any(v_breakdown_works);
  end if;
end;
$$;

revoke all on function public.delete_role(uuid) from public, anon;
grant execute on function public.delete_role(uuid) to authenticated;

notify pgrst, 'reload schema';
