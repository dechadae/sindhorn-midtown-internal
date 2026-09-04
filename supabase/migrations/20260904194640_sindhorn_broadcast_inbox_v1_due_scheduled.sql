-- r16 fix: a scheduled broadcast whose publish_at has passed is live to the
-- employee - that is what broadcast_visible_to_me and the select policy
-- already say - so the inbox lists it too, instead of only status published.
-- Nothing else changes; still security invoker, RLS decides.
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
      where b.status in ('scheduled','published')
        and b.publish_at is not null
        and b.publish_at <= now()
        and (b.expires_at is null or b.expires_at > now())
        and (select sindhorn_private.broadcast_visible_to_me(b.id))
    ), '[]'::jsonb),
    'unread', coalesce((
      select count(*)::int
      from public.sindhorn_broadcasts b
      where b.status in ('scheduled','published')
        and b.publish_at is not null
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
