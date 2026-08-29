create or replace function public.sindhorn_current_employee_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_employee public.sindhorn_employees%rowtype;
begin
  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select *
    into v_employee
  from public.sindhorn_employees
  where id = v_employee_id
    and active = true;

  if not found then
    raise exception 'active employee required' using errcode='42501';
  end if;

  return jsonb_build_object(
    'id', v_employee.id,
    'employee_number', v_employee.employee_number,
    'display_name', v_employee.display_name,
    'work_email', v_employee.work_email,
    'account_type', v_employee.account_type,
    'department_id', v_employee.department_id,
    'role', v_employee.role,
    'active', v_employee.active,
    'preferred_language', v_employee.preferred_language,
    'activated_at', v_employee.activated_at,
    'pin_configured_at', v_employee.pin_configured_at,
    'position_title', v_employee.position_title
  );
end;
$$;

revoke all on function public.sindhorn_current_employee_profile() from public;
grant execute on function public.sindhorn_current_employee_profile() to authenticated;
