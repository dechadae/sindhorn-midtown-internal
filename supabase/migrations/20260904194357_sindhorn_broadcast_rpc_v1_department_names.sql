-- r16 fix: sindhorn_broadcast_list_admin_v1 referenced d.name / g.name, but
-- departments and groups carry name_en / name_th. Same contract otherwise;
-- the list now returns {id, name, nameTh, active} for both.
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
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name_en, 'nameTh', d.name_th, 'active', d.active) order by d.name_en)
      from public.sindhorn_departments d where d.active
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name_en, 'nameTh', g.name_th, 'active', g.active) order by g.name_en)
      from public.sindhorn_groups g where g.active
    ), '[]'::jsonb),
    'actor', jsonb_build_object('id', v_actor_id)
  );
end;
$$;
revoke all on function public.sindhorn_broadcast_list_admin_v1() from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_list_admin_v1() to authenticated;
