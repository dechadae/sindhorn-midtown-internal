-- Sindhorn Midtown unified Settings/Admin capability authority.
-- Applied live to project sjpvhgxacsiorrtijqua as migration
-- 20260829135251_sindhorn_settings_capability_authority.

create table if not exists public.sindhorn_capabilities (
  key text primary key,
  label text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_capabilities_key_check check (key ~ '^[a-z][a-z0-9_.-]{1,79}$')
);

create table if not exists public.sindhorn_capability_grants (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_key text not null,
  capability_key text not null references public.sindhorn_capabilities(key) on delete cascade,
  allowed boolean not null default true,
  scope jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_capability_grants_subject_type_check check (subject_type in ('everyone','role','account_type','employee')),
  constraint sindhorn_capability_grants_subject_key_check check (length(subject_key) between 1 and 160),
  constraint sindhorn_capability_grants_unique unique(subject_type,subject_key,capability_key)
);

create table if not exists public.sindhorn_settings_sections (
  key text primary key,
  label text not null,
  nav_label text not null,
  description text,
  renderer text not null,
  required_capability text references public.sindhorn_capabilities(key),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_settings_sections_key_check check (key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  constraint sindhorn_settings_sections_renderer_check check (renderer ~ '^[a-z][a-z0-9_-]{1,63}$')
);

alter table public.sindhorn_capabilities enable row level security;
alter table public.sindhorn_capability_grants enable row level security;
alter table public.sindhorn_settings_sections enable row level security;
revoke all on public.sindhorn_capabilities from anon, authenticated;
revoke all on public.sindhorn_capability_grants from anon, authenticated;
revoke all on public.sindhorn_settings_sections from anon, authenticated;

insert into public.sindhorn_capabilities(key,label,description,sort_order) values
 ('settings.read','Settings','Open the authenticated Settings experience',10),
 ('account.read','Account','Read own employee account details',20),
 ('fnb.read','F&B read','Read authenticated F&B operational content',30),
 ('fnb.edit','F&B edit','Mutate privileged F&B operational state',40),
 ('people.read','People read','Read employee, department and group administration data',50),
 ('people.manage','People manage','Create and update employee administration data',60),
 ('departments.manage','Departments manage','Create and update departments',70),
 ('groups.manage','Groups manage','Create and update groups and membership',80),
 ('broadcasts.manage','Broadcasts manage','Create and manage internal broadcasts',90),
 ('audit.read','Audit read','Read administrative audit records',100),
 ('system.manage','System manage','Manage system configuration and privileged policy',110),
 ('private_contacts.manage','Private contacts','Read and update protected employee contact details',120),
 ('security.manage','Employee security','Issue recovery codes and revoke employee sessions/access',130)
on conflict(key) do update set
 label=excluded.label,description=excluded.description,sort_order=excluded.sort_order,active=true,updated_at=now();

insert into public.sindhorn_capability_grants(subject_type,subject_key,capability_key,allowed,active)
select 'everyone','*',x.key,true,true
from (values ('settings.read'),('account.read'),('fnb.read')) as x(key)
on conflict(subject_type,subject_key,capability_key) do update set allowed=true,active=true,updated_at=now();

insert into public.sindhorn_capability_grants(subject_type,subject_key,capability_key,allowed,active)
select 'account_type','developer',c.key,true,true from public.sindhorn_capabilities c where c.active
on conflict(subject_type,subject_key,capability_key) do update set allowed=true,active=true,updated_at=now();

insert into public.sindhorn_capability_grants(subject_type,subject_key,capability_key,allowed,active)
select 'role','super_admin',c.key,true,true from public.sindhorn_capabilities c where c.active
on conflict(subject_type,subject_key,capability_key) do update set allowed=true,active=true,updated_at=now();

insert into public.sindhorn_settings_sections(key,label,nav_label,description,renderer,required_capability,enabled,sort_order,config) values
 ('account','Account','Account','Profile, preferences, security status and sign out','account','account.read',true,10,'{"icon":"account"}'::jsonb),
 ('people','People','People','Employees, departments and groups','people','people.read',true,20,'{"entities":["employees","departments","groups"]}'::jsonb),
 ('comms','Comms','Comms','Internal broadcasts and communication controls','comms','broadcasts.manage',true,30,'{"status":"planned"}'::jsonb),
 ('system','System','System','Audit and system configuration','system','system.manage',true,40,'{"includes":["audit","configuration"]}'::jsonb)
on conflict(key) do update set
 label=excluded.label,nav_label=excluded.nav_label,description=excluded.description,renderer=excluded.renderer,
 required_capability=excluded.required_capability,enabled=excluded.enabled,sort_order=excluded.sort_order,config=excluded.config,updated_at=now();

create or replace function public.sindhorn_effective_capabilities_for_employee(p_employee_id uuid)
returns table(capability_key text)
language sql stable security definer set search_path=''
as $$
  with employee as (
    select e.id,e.role,e.account_type from public.sindhorn_employees e
    where e.id=p_employee_id and e.active=true
  ), matches as (
    select g.capability_key,g.allowed,
      case g.subject_type when 'employee' then 400 when 'account_type' then 300 when 'role' then 200 else 100 end as priority,
      g.updated_at
    from employee e
    join public.sindhorn_capability_grants g on g.active=true and (
      (g.subject_type='everyone' and g.subject_key='*') or
      (g.subject_type='role' and g.subject_key=e.role) or
      (g.subject_type='account_type' and g.subject_key=e.account_type) or
      (g.subject_type='employee' and g.subject_key=e.id::text)
    )
    join public.sindhorn_capabilities c on c.key=g.capability_key and c.active=true
  ), ranked as (
    select m.*,row_number() over(partition by m.capability_key order by m.priority desc,m.updated_at desc) as rn from matches m
  )
  select r.capability_key from ranked r where r.rn=1 and r.allowed=true order by r.capability_key;
$$;
revoke all on function public.sindhorn_effective_capabilities_for_employee(uuid) from public,anon,authenticated;
grant execute on function public.sindhorn_effective_capabilities_for_employee(uuid) to service_role;

create or replace function public.sindhorn_has_capability(p_capability text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.sindhorn_effective_capabilities_for_employee(sindhorn_private.current_employee_id()) c
    where c.capability_key=p_capability
  );
$$;
revoke all on function public.sindhorn_has_capability(text) from public,anon,authenticated;
grant execute on function public.sindhorn_has_capability(text) to service_role;

create or replace function public.sindhorn_settings_manifest()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_employee public.sindhorn_employees%rowtype;
  v_employee_id uuid;
  v_caps jsonb;
  v_sections jsonb;
begin
  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_employee from public.sindhorn_employees where id=v_employee_id and active=true;
  if not found then raise exception 'active employee required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(c.capability_key order by c.capability_key),'[]'::jsonb)
    into v_caps from public.sindhorn_effective_capabilities_for_employee(v_employee.id) c;
  select coalesce(jsonb_agg(jsonb_build_object(
      'key',s.key,'label',s.label,'navLabel',s.nav_label,'description',s.description,
      'renderer',s.renderer,'sortOrder',s.sort_order,'config',s.config
    ) order by s.sort_order,s.key),'[]'::jsonb)
    into v_sections
  from public.sindhorn_settings_sections s
  where s.enabled=true and (s.required_capability is null or exists(
    select 1 from public.sindhorn_effective_capabilities_for_employee(v_employee.id) c
    where c.capability_key=s.required_capability
  ));
  return jsonb_build_object(
    'ok',true,'version',1,
    'profile',jsonb_build_object(
      'id',v_employee.id,'employeeNumber',v_employee.employee_number,'displayName',v_employee.display_name,
      'workEmail',v_employee.work_email,'departmentId',v_employee.department_id,'role',v_employee.role,
      'accountType',v_employee.account_type,'preferredLanguage',v_employee.preferred_language,
      'active',v_employee.active,'pinConfigured',v_employee.pin_configured_at is not null
    ),
    'capabilities',v_caps,'sections',v_sections
  );
end;
$$;
revoke all on function public.sindhorn_settings_manifest() from public,anon;
grant execute on function public.sindhorn_settings_manifest() to authenticated,service_role;

-- Existing admin wrappers are kept as their established APIs; only authorization
-- is migrated to capabilities. Low-level helpers remain non-executable by
-- anon/authenticated.

create or replace function public.sindhorn_admin_list_users_v3()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor public.sindhorn_employees%rowtype; v_actor_id uuid; v_users jsonb; v_departments jsonb; v_private boolean;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('people.read') then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found then raise exception 'admin access required'; end if;
  v_private := public.sindhorn_has_capability('private_contacts.manage');
  select coalesce(jsonb_agg(
    to_jsonb(e) || jsonb_build_object(
      'sindhorn_employee_identities',coalesce((select jsonb_agg(jsonb_build_object('login_method',i.login_method,'provider',i.provider,'email',i.email,'last_used_at',i.last_used_at) order by i.created_at) from public.sindhorn_employee_identities i where i.employee_id=e.id),'[]'::jsonb),
      'private_contact',case when v_private then coalesce((select jsonb_build_object('personal_email',c.personal_email,'mobile_e164',c.mobile_e164) from sindhorn_private.employee_contacts c where c.employee_id=e.id),jsonb_build_object('personal_email',null,'mobile_e164',null)) else null end,
      'session_count',case when e.auth_user_id is null then 0 else (select count(*)::int from auth.sessions s where s.user_id=e.auth_user_id and (s.not_after is null or s.not_after>now())) end
    ) order by e.employee_number),'[]'::jsonb) into v_users from public.sindhorn_employees e;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name_en',d.name_en,'name_th',d.name_th,'active',d.active) order by d.name_en),'[]'::jsonb)
    into v_departments from public.sindhorn_departments d;
  return jsonb_build_object('ok',true,'users',v_users,'departments',v_departments,'actor',jsonb_build_object('id',v_actor.id,'role',v_actor.role,'account_type',v_actor.account_type));
end;
$$;

create or replace function public.sindhorn_admin_create_employee_v2(
  p_employee_number text,p_display_name text,p_work_email text,p_department_id uuid,p_role text,p_active boolean,p_preferred_language text,p_account_type text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid; v_new_id uuid; v_employee public.sindhorn_employees%rowtype;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('people.manage') then raise exception 'admin access required'; end if;
  if nullif(btrim(coalesce(p_employee_number,'')),'') is null or p_role not in ('employee','supervisor','manager','admin','super_admin') or p_account_type not in ('employee','developer','contractor','service') or p_preferred_language not in ('en','th') then raise exception 'invalid employee input'; end if;
  if p_department_id is not null and not exists(select 1 from public.sindhorn_departments d where d.id=p_department_id and d.active) then raise exception 'invalid department'; end if;
  if (p_role='super_admin' or p_account_type='developer') and not public.sindhorn_has_capability('system.manage') then raise exception 'insufficient role'; end if;
  v_new_id := public.sindhorn_admin_create_employee(auth.uid(),p_employee_number,p_display_name,p_work_email,p_department_id,p_role,p_active,p_preferred_language,p_account_type);
  select * into v_employee from public.sindhorn_employees where id=v_new_id;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_employee));
end;
$$;

create or replace function public.sindhorn_admin_update_employee_v2(
  p_employee_id uuid,p_employee_number text,p_display_name text,p_work_email text,p_department_id uuid,p_role text,p_active boolean,p_preferred_language text,p_account_type text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor public.sindhorn_employees%rowtype; v_existing public.sindhorn_employees%rowtype; v_actor_id uuid; v_updated boolean; v_auth_user_id uuid;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('people.manage') then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found then raise exception 'admin access required'; end if;
  select * into v_existing from public.sindhorn_employees where id=p_employee_id for update;
  if not found then raise exception 'employee not found'; end if;
  if nullif(btrim(coalesce(p_employee_number,'')),'') is null or p_role not in ('employee','supervisor','manager','admin','super_admin') or p_account_type not in ('employee','developer','contractor','service') or p_preferred_language not in ('en','th') then raise exception 'invalid employee input'; end if;
  if p_department_id is not null and not exists(select 1 from public.sindhorn_departments d where d.id=p_department_id and d.active) then raise exception 'invalid department'; end if;
  if (v_existing.role='super_admin' or v_existing.account_type='developer' or p_role='super_admin' or p_account_type='developer') and not public.sindhorn_has_capability('system.manage') then raise exception 'insufficient role'; end if;
  if p_employee_id=v_actor.id and (not p_active or p_role<>v_actor.role or p_account_type<>v_actor.account_type) then raise exception 'cannot remove own admin access'; end if;
  v_updated := public.sindhorn_admin_update_employee(auth.uid(),p_employee_id,p_employee_number,p_display_name,p_work_email,p_department_id,p_role,p_active,p_preferred_language,p_account_type);
  if not v_updated then raise exception 'employee not found'; end if;
  if v_existing.active and not p_active then
    v_auth_user_id := v_existing.auth_user_id;
    if v_auth_user_id is null then select i.auth_user_id into v_auth_user_id from public.sindhorn_employee_identities i where i.employee_id=v_existing.id order by i.created_at limit 1; end if;
    update sindhorn_private.activation_codes set revoked_at=coalesce(revoked_at,now()),claim_token_hash=null,claim_expires_at=null where employee_id=v_existing.id and consumed_at is null and revoked_at is null;
    if v_auth_user_id is not null then
      update auth.sessions set not_after=now(),updated_at=now() where user_id=v_auth_user_id and (not_after is null or not_after>now());
      update auth.refresh_tokens set revoked=true,updated_at=now() where user_id=v_auth_user_id::text and not revoked;
    end if;
  end if;
  select * into v_existing from public.sindhorn_employees where id=p_employee_id;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_existing));
end;
$$;

create or replace function public.sindhorn_admin_issue_activation_code_v2(p_employee_number text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_target public.sindhorn_employees%rowtype; v_actor_id uuid; v_bytes bytea; v_number bigint; v_code text; v_hash text; v_purpose text; v_expires_at timestamptz; v_activation_id uuid;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('security.manage') then raise exception 'admin access required'; end if;
  select * into v_target from public.sindhorn_employees where employee_number=btrim(p_employee_number) and active for update;
  if not found then raise exception 'employee not found'; end if;
  if (v_target.role='super_admin' or v_target.account_type='developer') and not public.sindhorn_has_capability('system.manage') then raise exception 'insufficient role'; end if;
  v_bytes := extensions.gen_random_bytes(4);
  v_number := get_byte(v_bytes,0)::bigint*16777216 + get_byte(v_bytes,1)::bigint*65536 + get_byte(v_bytes,2)::bigint*256 + get_byte(v_bytes,3)::bigint;
  v_code := lpad((v_number % 1000000)::text,6,'0');
  v_hash := 'bcrypt:' || extensions.crypt(v_code,extensions.gen_salt('bf',10));
  v_purpose := case when v_target.auth_user_id is null then 'activate' else 'recovery' end;
  v_expires_at := now()+interval '15 minutes';
  v_activation_id := public.sindhorn_issue_activation_code(v_target.id,v_hash,v_expires_at,v_purpose,auth.uid());
  return jsonb_build_object('ok',true,'employeeNumber',v_target.employee_number,'code',v_code,'purpose',v_purpose,'expiresAt',v_expires_at,'preferredLanguage',case when v_target.preferred_language='en' then 'en' else 'th' end);
end;
$$;

create or replace function public.sindhorn_admin_revoke_access_v2(p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor_id uuid; v_target public.sindhorn_employees%rowtype; v_auth_user_id uuid; v_sessions integer:=0; v_refresh integer:=0;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('security.manage') then raise exception 'admin access required'; end if;
  select * into v_target from public.sindhorn_employees where id=p_employee_id for update;
  if not found then raise exception 'employee not found'; end if;
  if v_target.id=v_actor_id then raise exception 'cannot remove own admin access'; end if;
  if (v_target.role='super_admin' or v_target.account_type='developer') and not public.sindhorn_has_capability('system.manage') then raise exception 'insufficient role'; end if;
  v_auth_user_id:=v_target.auth_user_id;
  if v_auth_user_id is null then select i.auth_user_id into v_auth_user_id from public.sindhorn_employee_identities i where i.employee_id=v_target.id order by i.created_at limit 1; end if;
  perform set_config('sindhorn.audit_actor',auth.uid()::text,true);
  update public.sindhorn_employees set active=false,deactivated_at=coalesce(deactivated_at,now()),updated_at=now() where id=v_target.id;
  update sindhorn_private.activation_codes set revoked_at=coalesce(revoked_at,now()),claim_token_hash=null,claim_expires_at=null where employee_id=v_target.id and consumed_at is null and revoked_at is null;
  if v_auth_user_id is not null then
    update auth.sessions set not_after=now(),updated_at=now() where user_id=v_auth_user_id and (not_after is null or not_after>now()); get diagnostics v_sessions=row_count;
    update auth.refresh_tokens set revoked=true,updated_at=now() where user_id=v_auth_user_id::text and not revoked; get diagnostics v_refresh=row_count;
  end if;
  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'employee_access_revoked','sindhorn_employees',v_target.id::text,jsonb_build_object('sessions_ended',v_sessions,'refresh_tokens_revoked',v_refresh));
  return jsonb_build_object('ok',true,'employeeId',v_target.id,'sessionsEnded',v_sessions,'refreshTokensRevoked',v_refresh);
end;
$$;

create or replace function public.sindhorn_admin_upsert_contact_v2(p_employee_id uuid,p_personal_email text,p_mobile_e164 text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_target public.sindhorn_employees%rowtype; v_actor_id uuid; v_email text; v_mobile text;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null or not public.sindhorn_has_capability('private_contacts.manage') then raise exception 'admin access required'; end if;
  select * into v_target from public.sindhorn_employees where id=p_employee_id;
  if not found then raise exception 'employee not found'; end if;
  v_email:=nullif(lower(btrim(coalesce(p_personal_email,''))),''); v_mobile:=nullif(btrim(coalesce(p_mobile_e164,'')),'');
  if v_email is not null and (length(v_email)<3 or length(v_email)>320 or position('@' in v_email)<=1) then raise exception 'invalid personal email'; end if;
  if v_mobile is not null and v_mobile !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid mobile'; end if;
  if v_email is null and v_mobile is null then delete from sindhorn_private.employee_contacts where employee_id=v_target.id;
  else insert into sindhorn_private.employee_contacts(employee_id,personal_email,mobile_e164,email_enabled,sms_enabled,updated_at) values(v_target.id,v_email,v_mobile,false,false,now()) on conflict(employee_id) do update set personal_email=excluded.personal_email,mobile_e164=excluded.mobile_e164,email_enabled=false,sms_enabled=false,updated_at=now(); end if;
  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'employee_contact_updated','sindhorn_employees',v_target.id::text,jsonb_build_object('has_personal_email',v_email is not null,'has_mobile',v_mobile is not null));
  return jsonb_build_object('ok',true,'contact',jsonb_build_object('personal_email',v_email,'mobile_e164',v_mobile));
end;
$$;

create or replace function public.sindhorn_fnb_artwork_status_write(p_checks jsonb)
returns jsonb language plpgsql security definer set search_path='public','pg_temp'
as $$
declare pair record; updated_count integer:=0;
begin
  if auth.uid() is null or not public.sindhorn_has_capability('fnb.edit') then raise exception 'not authorized' using errcode='42501'; end if;
  if p_checks is null or jsonb_typeof(p_checks)<>'object' then raise exception 'p_checks must be a JSON object' using errcode='22023'; end if;
  if (select count(*) from jsonb_each(p_checks))>500 then raise exception 'too many artwork statuses' using errcode='22023'; end if;
  for pair in select key,value from jsonb_each(p_checks) loop
    if char_length(pair.key)<1 or char_length(pair.key)>160 or jsonb_typeof(pair.value)<>'boolean' then raise exception 'invalid artwork status payload' using errcode='22023'; end if;
    insert into public.sindhorn_fnb_artwork_status(artwork_id,done,updated_at,updated_by) values(pair.key,(pair.value #>> '{}')::boolean,now(),auth.uid())
    on conflict(artwork_id) do update set done=excluded.done,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
    updated_count:=updated_count+1;
  end loop;
  return jsonb_build_object('ok',true,'updated',updated_count);
end;
$$;

revoke all on function public.sindhorn_admin_list_users_v3() from anon;
revoke all on function public.sindhorn_admin_create_employee_v2(text,text,text,uuid,text,boolean,text,text) from anon;
revoke all on function public.sindhorn_admin_update_employee_v2(uuid,text,text,text,uuid,text,boolean,text,text) from anon;
revoke all on function public.sindhorn_admin_issue_activation_code_v2(text) from anon;
revoke all on function public.sindhorn_admin_revoke_access_v2(uuid) from anon;
revoke all on function public.sindhorn_admin_upsert_contact_v2(uuid,text,text) from anon;
revoke all on function public.sindhorn_fnb_artwork_status_write(jsonb) from anon;
grant execute on function public.sindhorn_admin_list_users_v3() to authenticated,service_role;
grant execute on function public.sindhorn_admin_create_employee_v2(text,text,text,uuid,text,boolean,text,text) to authenticated,service_role;
grant execute on function public.sindhorn_admin_update_employee_v2(uuid,text,text,text,uuid,text,boolean,text,text) to authenticated,service_role;
grant execute on function public.sindhorn_admin_issue_activation_code_v2(text) to authenticated,service_role;
grant execute on function public.sindhorn_admin_revoke_access_v2(uuid) to authenticated,service_role;
grant execute on function public.sindhorn_admin_upsert_contact_v2(uuid,text,text) to authenticated,service_role;
grant execute on function public.sindhorn_fnb_artwork_status_write(jsonb) to authenticated,service_role;
