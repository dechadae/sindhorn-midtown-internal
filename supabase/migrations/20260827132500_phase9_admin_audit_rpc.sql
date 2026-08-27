-- Phase 9 — broker-only audit recorder.
-- Service-side admin actions run with a Supabase secret key, so auth.uid() is
-- intentionally unavailable to row triggers. The trusted broker supplies the
-- already-verified actor UUID to this RPC.

create or replace function public.sindhorn_record_admin_audit(
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_actor_user_id is null then
    raise exception 'actor required';
  end if;
  if length(btrim(coalesce(p_action,''))) < 1 or length(btrim(coalesce(p_entity_type,''))) < 1 then
    raise exception 'action and entity type required';
  end if;
  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(p_actor_user_id,btrim(p_action),btrim(p_entity_type),p_entity_id,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.sindhorn_record_admin_audit(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.sindhorn_record_admin_audit(uuid,text,text,text,jsonb) to service_role;

comment on function public.sindhorn_record_admin_audit(uuid,text,text,text,jsonb) is
  'Service-role-only audit writer for trusted Sindhorn Auth/Admin Worker actions.';
