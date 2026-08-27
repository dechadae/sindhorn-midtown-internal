-- Phase 9 post-acceptance: Supabase-only employee login is proven.
-- Retire abandoned bootstrap/contact-OTP broker surfaces and finish Admin > Users.

drop function if exists public.sindhorn_bootstrap_activation_prepare(text,text,text,integer);
drop function if exists public.sindhorn_activation_prepare(text,text,text,integer);
drop function if exists public.sindhorn_activation_finalize(uuid,text,uuid);
drop function if exists public.sindhorn_activation_release_claim(uuid,text);
drop function if exists public.sindhorn_contact_login_lookup(text,text,text);
drop function if exists public.sindhorn_store_auth_bridge_secret(text);

update sindhorn_private.employee_contacts
set email_enabled=false,
    sms_enabled=false,
    updated_at=now()
where email_enabled or sms_enabled;

alter table sindhorn_private.employee_contacts
  alter column email_enabled set default false,
  alter column sms_enabled set default false;

comment on table sindhorn_private.employee_contacts is
'Private Sindhorn employee personal contact data. Not directly readable by browser roles; exposed only through role-gated administrator RPCs. Automated email/SMS login is disabled.';

create or replace function public.sindhorn_admin_list_users_v3()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor public.sindhorn_employees%rowtype;
  v_actor_id uuid;
  v_users jsonb;
  v_departments jsonb;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found or v_actor.role not in ('admin','super_admin') then raise exception 'admin access required'; end if;

  select coalesce(jsonb_agg(
    to_jsonb(e)
    || jsonb_build_object(
      'sindhorn_employee_identities', coalesce((
        select jsonb_agg(jsonb_build_object(
          'login_method',i.login_method,
          'provider',i.provider,
          'email',i.email,
          'last_used_at',i.last_used_at
        ) order by i.created_at)
        from public.sindhorn_employee_identities i
        where i.employee_id=e.id
      ),'[]'::jsonb),
      'private_contact', case
        when v_actor.role='super_admin'
          or (e.role not in ('admin','super_admin') and e.account_type<>'developer')
        then coalesce((
          select jsonb_build_object(
            'personal_email',c.personal_email,
            'mobile_e164',c.mobile_e164
          )
          from sindhorn_private.employee_contacts c
          where c.employee_id=e.id
        ), jsonb_build_object('personal_email',null,'mobile_e164',null))
        else null
      end,
      'session_count', case when e.auth_user_id is null then 0 else (
        select count(*)::int from auth.sessions s
        where s.user_id=e.auth_user_id and (s.not_after is null or s.not_after>now())
      ) end
    )
    order by e.employee_number
  ),'[]'::jsonb) into v_users
  from public.sindhorn_employees e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'code',d.code,'name_en',d.name_en,'name_th',d.name_th,'active',d.active
  ) order by d.name_en),'[]'::jsonb)
  into v_departments
  from public.sindhorn_departments d
  where d.active or v_actor.role='super_admin';

  return jsonb_build_object(
    'ok',true,
    'users',v_users,
    'departments',v_departments,
    'actor',jsonb_build_object('id',v_actor.id,'role',v_actor.role)
  );
end
$function$;

revoke all on function public.sindhorn_admin_list_users_v3() from public,anon;
grant execute on function public.sindhorn_admin_list_users_v3() to authenticated;

create or replace function public.sindhorn_admin_upsert_contact_v2(
  p_employee_id uuid,
  p_personal_email text,
  p_mobile_e164 text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor public.sindhorn_employees%rowtype;
  v_target public.sindhorn_employees%rowtype;
  v_actor_id uuid;
  v_email text;
  v_mobile text;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found or v_actor.role not in ('admin','super_admin') then raise exception 'admin access required'; end if;

  select * into v_target from public.sindhorn_employees where id=p_employee_id;
  if not found then raise exception 'employee not found'; end if;
  if v_actor.role='admin' and (v_target.role in ('admin','super_admin') or v_target.account_type='developer') then
    raise exception 'insufficient role';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_personal_email,''))),'');
  v_mobile := nullif(btrim(coalesce(p_mobile_e164,'')),'');

  if v_email is not null and (length(v_email)<3 or length(v_email)>320 or position('@' in v_email)<=1) then
    raise exception 'invalid personal email';
  end if;
  if v_mobile is not null and v_mobile !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid mobile';
  end if;

  if v_email is null and v_mobile is null then
    delete from sindhorn_private.employee_contacts where employee_id=v_target.id;
  else
    insert into sindhorn_private.employee_contacts(
      employee_id,personal_email,mobile_e164,email_enabled,sms_enabled,updated_at
    ) values (
      v_target.id,v_email,v_mobile,false,false,now()
    )
    on conflict(employee_id) do update
      set personal_email=excluded.personal_email,
          mobile_e164=excluded.mobile_e164,
          email_enabled=false,
          sms_enabled=false,
          updated_at=now();
  end if;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'employee_contact_updated','sindhorn_employees',v_target.id::text,
    jsonb_build_object('has_personal_email',v_email is not null,'has_mobile',v_mobile is not null));

  return jsonb_build_object(
    'ok',true,
    'contact',jsonb_build_object('personal_email',v_email,'mobile_e164',v_mobile)
  );
end
$function$;

revoke all on function public.sindhorn_admin_upsert_contact_v2(uuid,text,text) from public,anon;
grant execute on function public.sindhorn_admin_upsert_contact_v2(uuid,text,text) to authenticated;

create or replace function public.sindhorn_admin_revoke_access_v2(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor public.sindhorn_employees%rowtype;
  v_target public.sindhorn_employees%rowtype;
  v_actor_id uuid;
  v_auth_user_id uuid;
  v_sessions integer := 0;
  v_refresh integer := 0;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found or v_actor.role not in ('admin','super_admin') then raise exception 'admin access required'; end if;

  select * into v_target from public.sindhorn_employees where id=p_employee_id for update;
  if not found then raise exception 'employee not found'; end if;
  if v_target.id=v_actor.id then raise exception 'cannot remove own admin access'; end if;
  if v_actor.role='admin' and (v_target.role in ('admin','super_admin') or v_target.account_type='developer') then
    raise exception 'insufficient role';
  end if;

  v_auth_user_id := v_target.auth_user_id;
  if v_auth_user_id is null then
    select i.auth_user_id into v_auth_user_id
    from public.sindhorn_employee_identities i
    where i.employee_id=v_target.id
    order by i.created_at
    limit 1;
  end if;

  perform set_config('sindhorn.audit_actor',auth.uid()::text,true);
  update public.sindhorn_employees
    set active=false,
        deactivated_at=coalesce(deactivated_at,now()),
        updated_at=now()
  where id=v_target.id;

  update sindhorn_private.activation_codes
    set revoked_at=coalesce(revoked_at,now()),
        claim_token_hash=null,
        claim_expires_at=null
  where employee_id=v_target.id and consumed_at is null and revoked_at is null;

  if v_auth_user_id is not null then
    update auth.sessions
      set not_after=now(), updated_at=now()
    where user_id=v_auth_user_id and (not_after is null or not_after>now());
    get diagnostics v_sessions = row_count;

    update auth.refresh_tokens
      set revoked=true, updated_at=now()
    where user_id=v_auth_user_id::text and not revoked;
    get diagnostics v_refresh = row_count;
  end if;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'employee_access_revoked','sindhorn_employees',v_target.id::text,
    jsonb_build_object('sessions_ended',v_sessions,'refresh_tokens_revoked',v_refresh));

  return jsonb_build_object('ok',true,'employeeId',v_target.id,'sessionsEnded',v_sessions,'refreshTokensRevoked',v_refresh);
end
$function$;

revoke all on function public.sindhorn_admin_revoke_access_v2(uuid) from public,anon;
grant execute on function public.sindhorn_admin_revoke_access_v2(uuid) to authenticated;

create or replace function public.sindhorn_admin_create_employee_v2(
  p_employee_number text,
  p_display_name text,
  p_work_email text,
  p_department_id uuid,
  p_role text,
  p_active boolean,
  p_preferred_language text,
  p_account_type text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor public.sindhorn_employees%rowtype;
  v_actor_id uuid;
  v_new_id uuid;
  v_employee public.sindhorn_employees%rowtype;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found or v_actor.role not in ('admin','super_admin') then raise exception 'admin access required'; end if;

  if nullif(btrim(coalesce(p_employee_number,'')),'') is null
     or p_role not in ('employee','supervisor','manager','admin','super_admin')
     or p_account_type not in ('employee','developer','contractor','service')
     or p_preferred_language not in ('en','th') then
    raise exception 'invalid employee input';
  end if;
  if p_department_id is not null and not exists(select 1 from public.sindhorn_departments d where d.id=p_department_id and d.active) then
    raise exception 'invalid department';
  end if;
  if v_actor.role='admin' and (p_role in ('admin','super_admin') or p_account_type='developer') then
    raise exception 'insufficient role';
  end if;

  v_new_id := public.sindhorn_admin_create_employee(
    auth.uid(),p_employee_number,p_display_name,p_work_email,p_department_id,p_role,p_active,p_preferred_language,p_account_type
  );
  select * into v_employee from public.sindhorn_employees where id=v_new_id;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_employee));
end
$function$;

revoke all on function public.sindhorn_admin_create_employee_v2(text,text,text,uuid,text,boolean,text,text) from public,anon;
grant execute on function public.sindhorn_admin_create_employee_v2(text,text,text,uuid,text,boolean,text,text) to authenticated;

create or replace function public.sindhorn_admin_update_employee_v2(
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
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor public.sindhorn_employees%rowtype;
  v_existing public.sindhorn_employees%rowtype;
  v_actor_id uuid;
  v_updated boolean;
  v_auth_user_id uuid;
begin
  v_actor_id := sindhorn_private.current_employee_id();
  if v_actor_id is null then raise exception 'admin access required'; end if;
  select * into v_actor from public.sindhorn_employees where id=v_actor_id and active;
  if not found or v_actor.role not in ('admin','super_admin') then raise exception 'admin access required'; end if;

  select * into v_existing from public.sindhorn_employees where id=p_employee_id for update;
  if not found then raise exception 'employee not found'; end if;

  if nullif(btrim(coalesce(p_employee_number,'')),'') is null
     or p_role not in ('employee','supervisor','manager','admin','super_admin')
     or p_account_type not in ('employee','developer','contractor','service')
     or p_preferred_language not in ('en','th') then
    raise exception 'invalid employee input';
  end if;
  if p_department_id is not null and not exists(select 1 from public.sindhorn_departments d where d.id=p_department_id and d.active) then
    raise exception 'invalid department';
  end if;
  if v_actor.role='admin' and (
    v_existing.role in ('admin','super_admin') or p_role in ('admin','super_admin') or p_account_type='developer'
  ) then raise exception 'insufficient role'; end if;
  if p_employee_id=v_actor.id and (not p_active or p_role<>v_actor.role) then
    raise exception 'cannot remove own admin access';
  end if;

  v_updated := public.sindhorn_admin_update_employee(
    auth.uid(),p_employee_id,p_employee_number,p_display_name,p_work_email,p_department_id,p_role,p_active,p_preferred_language,p_account_type
  );
  if not v_updated then raise exception 'employee not found'; end if;

  if v_existing.active and not p_active then
    v_auth_user_id := v_existing.auth_user_id;
    if v_auth_user_id is null then
      select i.auth_user_id into v_auth_user_id from public.sindhorn_employee_identities i
      where i.employee_id=v_existing.id order by i.created_at limit 1;
    end if;
    update sindhorn_private.activation_codes
      set revoked_at=coalesce(revoked_at,now()),claim_token_hash=null,claim_expires_at=null
    where employee_id=v_existing.id and consumed_at is null and revoked_at is null;
    if v_auth_user_id is not null then
      update auth.sessions set not_after=now(),updated_at=now()
      where user_id=v_auth_user_id and (not_after is null or not_after>now());
      update auth.refresh_tokens set revoked=true,updated_at=now()
      where user_id=v_auth_user_id::text and not revoked;
    end if;
  end if;

  select * into v_existing from public.sindhorn_employees where id=p_employee_id;
  return jsonb_build_object('ok',true,'employee',to_jsonb(v_existing));
end
$function$;

revoke all on function public.sindhorn_admin_update_employee_v2(uuid,text,text,text,uuid,text,boolean,text,text) from public,anon;
grant execute on function public.sindhorn_admin_update_employee_v2(uuid,text,text,text,uuid,text,boolean,text,text) to authenticated;
