-- Apply this migration before deploying the client that calls this RPC.
-- The owner replaces one skill experience's tool links in one transaction.

create function public.replace_experience_tools(
  p_experience_id uuid,
  p_tool_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tool_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_order integer := 0;
begin
  if not (select private.is_owner()) then
    raise exception 'Only the owner can replace experience tools';
  end if;
  if p_experience_id is null or p_tool_ids is null or array_position(p_tool_ids, null) is not null then
    raise exception 'Experience id and tool ids are required';
  end if;

  -- Serialize concurrent replacements for the same experience.
  perform 1 from public.skill_experience where id = p_experience_id for update;
  if not found then
    raise exception 'Skill experience not found';
  end if;

  delete from public.skill_experience_tools where experience_id = p_experience_id;
  foreach v_tool_id in array p_tool_ids loop
    if v_tool_id = any(v_seen) then
      continue;
    end if;
    insert into public.skill_experience_tools (experience_id, tool_id, sort_order)
      values (p_experience_id, v_tool_id, v_order);
    v_seen := array_append(v_seen, v_tool_id);
    v_order := v_order + 1;
  end loop;
end;
$$;

revoke all on function public.replace_experience_tools(uuid, uuid[]) from public, anon;
grant execute on function public.replace_experience_tools(uuid, uuid[]) to authenticated;
notify pgrst, 'reload schema';
