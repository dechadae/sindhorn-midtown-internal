alter table public.sindhorn_employees
  add column if not exists pin_configured_at timestamptz;

create table if not exists sindhorn_private.employee_pin_credentials (
  employee_id uuid primary key references public.sindhorn_employees(id) on delete cascade,
  pin_hash text not null check (pin_hash like 'bcrypt:%'),
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on sindhorn_private.employee_pin_credentials from public, anon, authenticated;

create or replace function public.sindhorn_set_permanent_pin(p_plain_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id uuid;
  v_employee public.sindhorn_employees%rowtype;
  v_hash text;
begin
  if p_plain_pin is null or p_plain_pin !~ '^[0-9]{6}$' then
    raise exception 'invalid permanent pin';
  end if;

  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null or auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_employee
  from public.sindhorn_employees
  where id = v_employee_id
    and auth_user_id = auth.uid()
    and active
  for update;

  if not found then
    raise exception 'authentication required';
  end if;

  v_hash := 'bcrypt:' || extensions.crypt(p_plain_pin, extensions.gen_salt('bf', 12));

  insert into sindhorn_private.employee_pin_credentials(
    employee_id, pin_hash, failed_attempt_count, locked_until, created_at, updated_at
  ) values (
    v_employee.id, v_hash, 0, null, now(), now()
  )
  on conflict (employee_id) do update
    set pin_hash = excluded.pin_hash,
        failed_attempt_count = 0,
        locked_until = null,
        updated_at = now();

  update public.sindhorn_employees
  set pin_configured_at = now(), updated_at = now()
  where id = v_employee.id;

  insert into sindhorn_private.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'permanent_pin_set', 'sindhorn_employees', v_employee.id::text,
         jsonb_build_object('method','employee_self_service','digits',6));

  return jsonb_build_object('ok', true, 'pinConfigured', true);
end
$function$;

create or replace function public.sindhorn_pin_login(p_employee_number text, p_plain_pin text)
returns table(token_hash text, preferred_language text, purpose text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee public.sindhorn_employees%rowtype;
  v_credential sindhorn_private.employee_pin_credentials%rowtype;
  v_stored_hash text;
  v_attempts integer;
  v_email text;
  v_auth_response jsonb;
  v_token_hash text;
begin
  if p_employee_number is null
     or length(btrim(p_employee_number)) = 0
     or length(p_employee_number) > 64
     or p_plain_pin is null
     or p_plain_pin !~ '^[0-9]{6}$' then
    return;
  end if;

  select * into v_employee
  from public.sindhorn_employees
  where employee_number = btrim(p_employee_number)
    and active
    and auth_user_id is not null
    and pin_configured_at is not null
  for update;

  if not found then return; end if;

  select * into v_credential
  from sindhorn_private.employee_pin_credentials
  where employee_id = v_employee.id
  for update;

  if not found or v_credential.pin_hash not like 'bcrypt:%' then return; end if;

  if v_credential.locked_until is not null and v_credential.locked_until > now() then
    return;
  end if;

  if v_credential.locked_until is not null and v_credential.locked_until <= now() then
    update sindhorn_private.employee_pin_credentials
    set failed_attempt_count = 0, locked_until = null, updated_at = now()
    where employee_id = v_employee.id;
    v_credential.failed_attempt_count := 0;
    v_credential.locked_until := null;
  end if;

  v_stored_hash := substring(v_credential.pin_hash from 8);
  if v_stored_hash is null or extensions.crypt(p_plain_pin, v_stored_hash) <> v_stored_hash then
    v_attempts := v_credential.failed_attempt_count + 1;
    update sindhorn_private.employee_pin_credentials
    set failed_attempt_count = v_attempts,
        locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' else null end,
        updated_at = now()
    where employee_id = v_employee.id;
    return;
  end if;

  update sindhorn_private.employee_pin_credentials
  set failed_attempt_count = 0, locked_until = null, updated_at = now()
  where employee_id = v_employee.id;

  select u.email into v_email
  from auth.users u
  where u.id = v_employee.auth_user_id;

  if v_email is null or btrim(v_email) = '' then
    raise exception 'sign-in unavailable';
  end if;

  v_auth_response := sindhorn_private.auth_admin_post(
    '/auth/v1/admin/generate_link',
    jsonb_build_object('type','magiclink','email',v_email)
  );

  v_token_hash := coalesce(
    nullif(v_auth_response->>'hashed_token',''),
    nullif(v_auth_response->'properties'->>'hashed_token','')
  );

  if v_token_hash is null then raise exception 'sign-in unavailable'; end if;

  update public.sindhorn_employee_identities
  set last_used_at = now()
  where employee_id = v_employee.id
    and auth_user_id = v_employee.auth_user_id;

  insert into sindhorn_private.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  values(v_employee.auth_user_id, 'permanent_pin_verified', 'sindhorn_employees', v_employee.id::text,
         jsonb_build_object('method','employee_id_pin'));

  return query
  select v_token_hash,
         case when v_employee.preferred_language = 'en' then 'en' else 'th' end,
         'pin'::text;
exception
  when others then
    raise log 'sindhorn_pin_login internal error [%] %', sqlstate, sqlerrm;
    raise exception 'sign-in unavailable';
end
$function$;

create or replace function sindhorn_private.invalidate_pin_after_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.consumed_at is null and new.consumed_at is not null then
    delete from sindhorn_private.employee_pin_credentials
    where employee_id = new.employee_id;

    update public.sindhorn_employees
    set pin_configured_at = null, updated_at = now()
    where id = new.employee_id;
  end if;
  return new;
end
$function$;

drop trigger if exists sindhorn_activation_resets_permanent_pin on sindhorn_private.activation_codes;
create trigger sindhorn_activation_resets_permanent_pin
after update of consumed_at on sindhorn_private.activation_codes
for each row
execute function sindhorn_private.invalidate_pin_after_activation();

create or replace function sindhorn_private.invalidate_pin_after_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.active and not new.active then
    delete from sindhorn_private.employee_pin_credentials
    where employee_id = new.id;

    update public.sindhorn_employees
    set pin_configured_at = null, updated_at = now()
    where id = new.id;
  end if;
  return new;
end
$function$;

drop trigger if exists sindhorn_deactivation_resets_permanent_pin on public.sindhorn_employees;
create trigger sindhorn_deactivation_resets_permanent_pin
after update of active on public.sindhorn_employees
for each row
execute function sindhorn_private.invalidate_pin_after_deactivation();

revoke all on function public.sindhorn_set_permanent_pin(text) from public;
revoke all on function public.sindhorn_pin_login(text,text) from public;
grant execute on function public.sindhorn_set_permanent_pin(text) to authenticated;
grant execute on function public.sindhorn_pin_login(text,text) to anon, authenticated;
