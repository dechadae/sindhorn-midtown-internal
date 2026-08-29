create or replace function public.sindhorn_admin_create_employee_v3(
  p_employee_number text,
  p_display_name text,
  p_work_email text,
  p_department_id uuid,
  p_role text,
  p_active boolean,
  p_preferred_language text,
  p_account_type text,
  p_position_title text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_employee public.sindhorn_employees%rowtype;
  v_employee_id uuid;
begin
  if length(coalesce(p_position_title,'')) > 160 then
    raise exception 'invalid employee input';
  end if;

  v_result := public.sindhorn_admin_create_employee_v2(
    p_employee_number,
    p_display_name,
    p_work_email,
    p_department_id,
    p_role,
    p_active,
    p_preferred_language,
    p_account_type
  );

  v_employee_id := nullif(v_result->'employee'->>'id','')::uuid;
  if v_employee_id is null then
    raise exception 'employee save failed';
  end if;

  update public.sindhorn_employees
     set position_title = nullif(btrim(coalesce(p_position_title,'')),''),
         updated_at = now()
   where id = v_employee_id;

  select * into v_employee from public.sindhorn_employees where id = v_employee_id;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_employee));
end;
$function$;

create or replace function public.sindhorn_admin_update_employee_v3(
  p_employee_id uuid,
  p_employee_number text,
  p_display_name text,
  p_work_email text,
  p_department_id uuid,
  p_role text,
  p_active boolean,
  p_preferred_language text,
  p_account_type text,
  p_position_title text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_employee public.sindhorn_employees%rowtype;
begin
  if length(coalesce(p_position_title,'')) > 160 then
    raise exception 'invalid employee input';
  end if;

  v_result := public.sindhorn_admin_update_employee_v2(
    p_employee_id,
    p_employee_number,
    p_display_name,
    p_work_email,
    p_department_id,
    p_role,
    p_active,
    p_preferred_language,
    p_account_type
  );

  update public.sindhorn_employees
     set position_title = nullif(btrim(coalesce(p_position_title,'')),''),
         updated_at = now()
   where id = p_employee_id;

  select * into v_employee from public.sindhorn_employees where id = p_employee_id;
  if not found then
    raise exception 'employee not found';
  end if;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_employee));
end;
$function$;

revoke all on function public.sindhorn_admin_create_employee_v3(text,text,text,uuid,text,boolean,text,text,text) from public, anon;
revoke all on function public.sindhorn_admin_update_employee_v3(uuid,text,text,text,uuid,text,boolean,text,text,text) from public, anon;
grant execute on function public.sindhorn_admin_create_employee_v3(text,text,text,uuid,text,boolean,text,text,text) to authenticated, service_role;
grant execute on function public.sindhorn_admin_update_employee_v3(uuid,text,text,text,uuid,text,boolean,text,text,text) to authenticated, service_role;
