-- Sindhorn broadcasts: the RPC surface the /next Messages tab and the Settings ›
-- Broadcast tab call. Follows the accepted people.manage / security.manage pattern
-- (sindhorn_settings_capability_authority, 29 Aug 2026): privileged writes go
-- through capability-gated security-definer functions; the table policies are
-- NOT touched — direct table writes still require can_manage_content() + aal2,
-- exactly as phase9a left them. Employee reads and read receipts run as the
-- caller (security invoker) so RLS remains the authority for what an employee
-- can see.
--
-- Push delivery is deliberately out of scope here: the alerts Worker keeps
-- device-level subscriptions with no employee binding, so targeted push needs
-- its own bridge (see the business dashboard notification bridge for the
-- pg_net + Vault pattern). This migration records nothing and calls nothing
-- external.

-- ---------------------------------------------------------------------------
-- 1. Employee side: inbox + read receipts (security invoker, RLS decides)
-- ---------------------------------------------------------------------------

create or replace function public.sindhorn_broadcast_inbox_v1()
returns jsonb
language sql stable security invoker set search_path=''
as $$
  select jsonb_build_object(
    'ok', true,
    'broadcasts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'titleEn', b.title_en, 'titleTh', b.title_th,
        'bodyEn', b.body_en, 'bodyTh', b.body_th,
        'category', b.category, 'priority', b.priority,
        'pinned', b.pinned, 'sensitive', b.sensitive,
        'route', b.route,
        'publishAt', b.publish_at, 'expiresAt', b.expires_at,
        'readAt', r.read_at
      ) order by b.pinned desc, b.publish_at desc)
      from public.sindhorn_broadcasts b
      left join public.sindhorn_broadcast_reads r
        on r.broadcast_id = b.id
       and r.employee_id = (select sindhorn_private.current_employee_id())
      where b.status = 'published'
        and b.publish_at <= now()
        and (b.expires_at is null or b.expires_at > now())
        and (select sindhorn_private.broadcast_visible_to_me(b.id))
    ), '[]'::jsonb),
    'unread', coalesce((
      select count(*)::int
      from public.sindhorn_broadcasts b
      where b.status = 'published'
        and b.publish_at <= now()
        and (b.expires_at is null or b.expires_at > now())
        and (select sindhorn_private.broadcast_visible_to_me(b.id))
        and not exists (
          select 1 from public.sindhorn_broadcast_reads r
          where r.broadcast_id = b.id
            and r.employee_id = (select sindhorn_private.current_employee_id())
        )
    ), 0)
  );
$$;
revoke all on function public.sindhorn_broadcast_inbox_v1() from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_inbox_v1() to authenticated;

-- Marks the given broadcasts read for the caller. Runs as the caller, so the
-- existing sindhorn_broadcast_reads_insert policy (own employee_id + visible)
-- is what allows or refuses each row. Ids that are not visible are skipped
-- silently rather than raising, so a stale inbox never blocks the rest.
create or replace function public.sindhorn_broadcast_mark_read_v1(p_broadcast_ids uuid[])
returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare
  v_employee_id uuid := sindhorn_private.current_employee_id();
  v_marked int := 0;
begin
  if v_employee_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  insert into public.sindhorn_broadcast_reads(broadcast_id, employee_id)
  select b.id, v_employee_id
  from public.sindhorn_broadcasts b
  where b.id = any(coalesce(p_broadcast_ids, '{}'::uuid[]))
    and (select sindhorn_private.broadcast_visible_to_me(b.id))
  on conflict (broadcast_id, employee_id) do nothing;
  get diagnostics v_marked = row_count;
  return jsonb_build_object('ok', true, 'marked', v_marked);
end;
$$;
revoke all on function public.sindhorn_broadcast_mark_read_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_mark_read_v1(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Manager side: list / save / publish / revoke (security definer,
--    gated by the broadcasts.manage capability — super_admin + developer today)
-- ---------------------------------------------------------------------------

-- Shared guard, same wording the admin RPCs already use so the client's
-- explain() mapping keeps working.
create or replace function sindhorn_private.require_broadcast_manager()
returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare v_actor_id uuid := sindhorn_private.current_employee_id();
begin
  if v_actor_id is null or not public.sindhorn_has_capability('broadcasts.manage') then
    raise exception 'admin access required';
  end if;
  return v_actor_id;
end;
$$;
revoke all on function sindhorn_private.require_broadcast_manager() from public, anon, authenticated;

create or replace function public.sindhorn_broadcast_list_admin_v1()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_actor_id uuid;
begin
  v_actor_id := sindhorn_private.require_broadcast_manager();
  return jsonb_build_object(
    'ok', true,
    'broadcasts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'titleEn', b.title_en, 'titleTh', b.title_th,
        'bodyEn', b.body_en, 'bodyTh', b.body_th,
        'category', b.category, 'priority', b.priority, 'status', b.status,
        'pinned', b.pinned, 'sensitive', b.sensitive, 'pushEnabled', b.push_enabled,
        'route', b.route,
        'publishAt', b.publish_at, 'expiresAt', b.expires_at,
        'createdAt', b.created_at, 'updatedAt', b.updated_at,
        'publishedAt', b.published_at, 'revokedAt', b.revoked_at,
        'targets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'type', t.target_type,
            'departmentId', t.department_id, 'role', t.role,
            'groupId', t.group_id, 'employeeId', t.employee_id
          ) order by t.created_at)
          from public.sindhorn_broadcast_targets t where t.broadcast_id = b.id
        ), '[]'::jsonb),
        'readCount', (select count(*)::int from public.sindhorn_broadcast_reads r where r.broadcast_id = b.id)
      ) order by
        case b.status when 'published' then 0 when 'scheduled' then 1 when 'draft' then 2 else 3 end,
        coalesce(b.publish_at, b.updated_at) desc)
      from public.sindhorn_broadcasts b
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'active', d.active) order by d.name)
      from public.sindhorn_departments d where d.active
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'active', g.active) order by g.name)
      from public.sindhorn_groups g where g.active
    ), '[]'::jsonb),
    'actor', jsonb_build_object('id', v_actor_id)
  );
end;
$$;
revoke all on function public.sindhorn_broadcast_list_admin_v1() from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_list_admin_v1() to authenticated;

-- Create or update a draft / scheduled broadcast and replace its audience.
-- p_targets: jsonb array of {type:'everyone'|'department'|'role'|'group'|'employee',
--            departmentId?, role?, groupId?, employeeId?}. At least one target.
-- Status changes go through publish/revoke below; this never publishes.
create or replace function public.sindhorn_broadcast_save_v1(
  p_id uuid,
  p_title_en text, p_title_th text,
  p_body_en text, p_body_th text,
  p_category text, p_priority text,
  p_sensitive boolean, p_pinned boolean, p_push_enabled boolean,
  p_publish_at timestamptz, p_expires_at timestamptz,
  p_targets jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_actor_id uuid;
  v_row public.sindhorn_broadcasts%rowtype;
  v_status text;
  v_target jsonb;
  v_count int := 0;
begin
  v_actor_id := sindhorn_private.require_broadcast_manager();

  if nullif(btrim(coalesce(p_title_en,'')),'') is null or nullif(btrim(coalesce(p_body_en,'')),'') is null
     or p_category not in ('hotel_news','operations','safety','hr','event','environment')
     or p_priority not in ('normal','high','urgent')
     or jsonb_typeof(coalesce(p_targets,'null'::jsonb)) <> 'array' or jsonb_array_length(p_targets) = 0 then
    raise exception 'invalid broadcast input';
  end if;

  -- A future publish_at makes it scheduled; otherwise it stays a draft.
  v_status := case when p_publish_at is not null and p_publish_at > now() then 'scheduled' else 'draft' end;

  if p_id is null then
    insert into public.sindhorn_broadcasts(
      title_en, title_th, body_en, body_th, category, priority, status,
      sensitive, pinned, push_enabled, publish_at, expires_at)
    values (
      btrim(p_title_en), nullif(btrim(coalesce(p_title_th,'')),''),
      btrim(p_body_en), nullif(btrim(coalesce(p_body_th,'')),''),
      p_category, p_priority, v_status,
      coalesce(p_sensitive,false), coalesce(p_pinned,false), coalesce(p_push_enabled,true),
      case when v_status = 'scheduled' then p_publish_at else null end, p_expires_at)
    returning * into v_row;
  else
    select * into v_row from public.sindhorn_broadcasts where id = p_id for update;
    if not found then raise exception 'broadcast not found'; end if;
    if v_row.status not in ('draft','scheduled') then raise exception 'broadcast is not editable'; end if;
    update public.sindhorn_broadcasts set
      title_en = btrim(p_title_en), title_th = nullif(btrim(coalesce(p_title_th,'')),''),
      body_en = btrim(p_body_en), body_th = nullif(btrim(coalesce(p_body_th,'')),''),
      category = p_category, priority = p_priority, status = v_status,
      sensitive = coalesce(p_sensitive,false), pinned = coalesce(p_pinned,false),
      push_enabled = coalesce(p_push_enabled,true),
      publish_at = case when v_status = 'scheduled' then p_publish_at else null end,
      expires_at = p_expires_at
    where id = p_id
    returning * into v_row;
    delete from public.sindhorn_broadcast_targets where broadcast_id = p_id;
  end if;

  for v_target in select * from jsonb_array_elements(p_targets) loop
    insert into public.sindhorn_broadcast_targets(broadcast_id, target_type, department_id, role, group_id, employee_id)
    values (
      v_row.id,
      v_target->>'type',
      nullif(v_target->>'departmentId','')::uuid,
      nullif(v_target->>'role',''),
      nullif(v_target->>'groupId','')::uuid,
      nullif(v_target->>'employeeId','')::uuid)
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  -- The table's shape check raises 'sindhorn_broadcast_targets_shape_check' for a
  -- malformed target; the client maps that to 'invalid audience'.

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'targets', v_count);
end;
$$;
revoke all on function public.sindhorn_broadcast_save_v1(uuid,text,text,text,text,text,text,boolean,boolean,boolean,timestamptz,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_save_v1(uuid,text,text,text,text,text,text,boolean,boolean,boolean,timestamptz,timestamptz,jsonb) to authenticated;

-- Publish now. The stamp trigger sets publish_at/published_at/published_by.
create or replace function public.sindhorn_broadcast_publish_v1(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_row public.sindhorn_broadcasts%rowtype;
begin
  perform sindhorn_private.require_broadcast_manager();
  select * into v_row from public.sindhorn_broadcasts where id = p_id for update;
  if not found then raise exception 'broadcast not found'; end if;
  if v_row.status not in ('draft','scheduled') then raise exception 'broadcast is not editable'; end if;
  if not exists (select 1 from public.sindhorn_broadcast_targets t where t.broadcast_id = p_id) then
    raise exception 'broadcast has no audience';
  end if;
  update public.sindhorn_broadcasts set status = 'published', publish_at = now() where id = p_id returning * into v_row;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'publishedAt', v_row.published_at);
end;
$$;
revoke all on function public.sindhorn_broadcast_publish_v1(uuid) from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_publish_v1(uuid) to authenticated;

-- Revoke. Immutable afterwards (trigger enforces).
create or replace function public.sindhorn_broadcast_revoke_v1(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_row public.sindhorn_broadcasts%rowtype;
begin
  perform sindhorn_private.require_broadcast_manager();
  select * into v_row from public.sindhorn_broadcasts where id = p_id for update;
  if not found then raise exception 'broadcast not found'; end if;
  if v_row.status = 'revoked' then return jsonb_build_object('ok', true, 'id', p_id, 'status', 'revoked'); end if;
  update public.sindhorn_broadcasts set status = 'revoked' where id = p_id returning * into v_row;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'revokedAt', v_row.revoked_at);
end;
$$;
revoke all on function public.sindhorn_broadcast_revoke_v1(uuid) from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_revoke_v1(uuid) to authenticated;

-- Settings section metadata: Comms was 'planned'; the /next Broadcast tab reads
-- the same manifest, so flip the status only. No policy is changed here.
update public.sindhorn_settings_sections
   set config = config || '{"status":"available"}'::jsonb, updated_at = now()
 where key = 'comms';

comment on function public.sindhorn_broadcast_inbox_v1() is 'Employee Messages inbox: published, unexpired broadcasts visible to the caller, with own read receipt. Security invoker; RLS decides.';
comment on function public.sindhorn_broadcast_mark_read_v1(uuid[]) is 'Marks visible broadcasts read for the caller. Security invoker; the reads insert policy applies.';
comment on function public.sindhorn_broadcast_list_admin_v1() is 'Broadcast administration list; requires the broadcasts.manage capability.';
comment on function public.sindhorn_broadcast_save_v1(uuid,text,text,text,text,text,text,boolean,boolean,boolean,timestamptz,timestamptz,jsonb) is 'Create/update a draft or scheduled broadcast and replace its audience; requires broadcasts.manage. Never publishes.';
comment on function public.sindhorn_broadcast_publish_v1(uuid) is 'Publish a draft/scheduled broadcast now; requires broadcasts.manage and at least one target.';
comment on function public.sindhorn_broadcast_revoke_v1(uuid) is 'Revoke a broadcast; requires broadcasts.manage. Revoked broadcasts are immutable.';
