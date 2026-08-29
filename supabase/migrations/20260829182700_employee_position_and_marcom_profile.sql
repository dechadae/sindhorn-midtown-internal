alter table public.sindhorn_employees
  add column if not exists position_title text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='sindhorn_employees_position_title_length'
      and conrelid='public.sindhorn_employees'::regclass
  ) then
    alter table public.sindhorn_employees
      add constraint sindhorn_employees_position_title_length
      check (position_title is null or char_length(btrim(position_title)) between 1 and 160);
  end if;
end $$;

insert into public.sindhorn_departments(id,code,name_en,name_th,active,created_at,updated_at)
values(gen_random_uuid(),'marcom','Marketing Communications',null,true,now(),now())
on conflict(code) do update set
  name_en=excluded.name_en,
  active=true,
  updated_at=now();

create or replace function public.sindhorn_settings_manifest()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_employee public.sindhorn_employees%rowtype;
  v_employee_id uuid;
  v_caps jsonb;
  v_sections jsonb;
  v_department_name text;
begin
  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_employee from public.sindhorn_employees where id=v_employee_id and active=true;
  if not found then raise exception 'active employee required' using errcode='42501'; end if;

  select d.name_en into v_department_name
  from public.sindhorn_departments d
  where d.id=v_employee.department_id;

  select coalesce(jsonb_agg(c.capability_key order by c.capability_key),'[]'::jsonb)
    into v_caps
  from public.sindhorn_effective_capabilities_for_employee(v_employee.id) c;

  select coalesce(jsonb_agg(jsonb_build_object(
      'key',s.key,'label',s.label,'navLabel',s.nav_label,'description',s.description,
      'renderer',s.renderer,'sortOrder',s.sort_order,'config',s.config
    ) order by s.sort_order,s.key),'[]'::jsonb)
    into v_sections
  from public.sindhorn_settings_sections s
  where s.enabled=true
    and (s.required_capability is null or exists(
      select 1 from public.sindhorn_effective_capabilities_for_employee(v_employee.id) c
      where c.capability_key=s.required_capability
    ));

  return jsonb_build_object(
    'ok',true,
    'version',2,
    'profile',jsonb_build_object(
      'id',v_employee.id,
      'employeeNumber',v_employee.employee_number,
      'displayName',v_employee.display_name,
      'workEmail',v_employee.work_email,
      'departmentId',v_employee.department_id,
      'departmentName',v_department_name,
      'positionTitle',v_employee.position_title,
      'role',v_employee.role,
      'accountType',v_employee.account_type,
      'preferredLanguage',v_employee.preferred_language,
      'active',v_employee.active,
      'pinConfigured',v_employee.pin_configured_at is not null
    ),
    'capabilities',v_caps,
    'sections',v_sections
  );
end;
$function$;
