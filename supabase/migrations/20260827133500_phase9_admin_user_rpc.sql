-- Phase 9 — transactional broker-only employee management.
-- The broker verifies role/MFA before calling these functions. The database
-- records the verified actor in the existing row audit trigger atomically.

create or replace function sindhorn_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  configured_actor text;
  old_data jsonb;
  new_data jsonb;
  row_id text;
begin
  configured_actor := current_setting('sindhorn.audit_actor', true);
  if configured_actor is not null and configured_actor <> '' then
    actor := configured_actor::uuid;
  else
    actor := (select auth.uid());
  end if;

  if tg_op = 'INSERT' then
    old_data := null;
    new_data := to_jsonb(new);
    row_id := new_data->>'id';
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    row_id := coalesce(new_data->>'id', old_data->>'id');
  else
    old_data := to_jsonb(old);
    new_data := null;
    row_id := old_data->>'id';
  end if;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,before_json,after_json)
  values(actor,lower(tg_op),tg_table_name,row_id,old_data,new_data);
  return coalesce(new, old);
end
$$;

create or replace function public.sindhorn_admin_create_employee(
  p_actor_user_id uuid,
  p_employee_number text,
  p_display_name text,
  p_work_email text,
  p_department_id uuid,
  p_role text,
  p_active boolean,
  p_preferred_language text,
  p_account_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_actor_user_id is null then raise exception 'actor required'; end if;
  perform set_config('sindhorn.audit_actor', p_actor_user_id::text, true);
  insert into public.sindhorn_employees(
    employee_number,display_name,work_email,department_id,role,active,preferred_language,account_type,deactivated_at
  ) values(
    btrim(p_employee_number),nullif(btrim(coalesce(p_display_name,'')),''),nullif(lower(btrim(coalesce(p_work_email,''))),''),p_department_id,p_role,coalesce(p_active,true),p_preferred_language,p_account_type,
    case when coalesce(p_active,true) then null else now() end
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.sindhorn_admin_update_employee(
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_employee_number text,
  p_display_name text,
  p_work_email text,
  p_department_id uuid,
  p_role text,
  p_active boolean,
  p_preferred_language text,
  p_account_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_user_id is null then raise exception 'actor required'; end if;
  perform set_config('sindhorn.audit_actor', p_actor_user_id::text, true);
  update public.sindhorn_employees
  set employee_number=btrim(p_employee_number),
      display_name=nullif(btrim(coalesce(p_display_name,'')),''),
      work_email=nullif(lower(btrim(coalesce(p_work_email,''))),''),
      department_id=p_department_id,
      role=p_role,
      active=p_active,
      preferred_language=p_preferred_language,
      account_type=p_account_type,
      deactivated_at=case when p_active then null else coalesce(deactivated_at,now()) end,
      updated_at=now()
  where id=p_employee_id;
  return found;
end
$$;

revoke all on function public.sindhorn_admin_create_employee(uuid,text,text,text,uuid,text,boolean,text,text) from public,anon,authenticated;
revoke all on function public.sindhorn_admin_update_employee(uuid,uuid,text,text,text,uuid,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.sindhorn_admin_create_employee(uuid,text,text,text,uuid,text,boolean,text,text) to service_role;
grant execute on function public.sindhorn_admin_update_employee(uuid,uuid,text,text,text,uuid,text,boolean,text,text) to service_role;
