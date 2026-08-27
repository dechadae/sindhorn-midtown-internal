-- Phase 9B — trusted activation broker database primitives.
-- Public-schema RPCs are used only because PostgREST exposes the public schema.
-- EXECUTE is revoked from public/anon/authenticated and granted only to service_role.

alter table sindhorn_private.activation_codes
  add column if not exists purpose text not null default 'activate',
  add column if not exists claim_token_hash text,
  add column if not exists claim_expires_at timestamptz;

alter table sindhorn_private.activation_codes
  drop constraint if exists sindhorn_activation_purpose_check;
alter table sindhorn_private.activation_codes
  add constraint sindhorn_activation_purpose_check check (purpose in ('activate','recovery'));

create index if not exists sindhorn_activation_claim_idx
  on sindhorn_private.activation_codes(employee_id,purpose,expires_at desc)
  where consumed_at is null and revoked_at is null;

create or replace function public.sindhorn_activation_prepare(
  p_employee_number text,
  p_code_hash text,
  p_claim_hash text,
  p_claim_ttl_seconds integer default 300
)
returns table(
  employee_id uuid,
  auth_user_id uuid,
  role text,
  preferred_language text,
  purpose text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.sindhorn_employees%rowtype;
  a sindhorn_private.activation_codes%rowtype;
  expected_purpose text;
  next_attempts integer;
begin
  if p_employee_number is null or length(btrim(p_employee_number)) = 0
     or p_code_hash is null or length(p_code_hash) < 32
     or p_claim_hash is null or length(p_claim_hash) < 32 then
    return;
  end if;

  select * into e
  from public.sindhorn_employees
  where employee_number = btrim(p_employee_number)
    and active
  for update;

  if not found then
    return;
  end if;

  expected_purpose := case when e.auth_user_id is null then 'activate' else 'recovery' end;

  select * into a
  from sindhorn_private.activation_codes
  where employee_id = e.id
    and purpose = expected_purpose
    and consumed_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if a.locked_until is not null and a.locked_until > now() then
    return;
  end if;

  if a.code_hash <> p_code_hash then
    next_attempts := a.attempt_count + 1;
    update sindhorn_private.activation_codes
      set attempt_count = next_attempts,
          locked_until = case when next_attempts >= 5 then now() + interval '15 minutes' else null end
    where id = a.id;
    return;
  end if;

  if a.claim_expires_at is not null and a.claim_expires_at > now()
     and a.claim_token_hash is distinct from p_claim_hash then
    return;
  end if;

  update sindhorn_private.activation_codes
    set claim_token_hash = p_claim_hash,
        claim_expires_at = now() + make_interval(secs => greatest(60, least(coalesce(p_claim_ttl_seconds,300),600)))
  where id = a.id;

  return query
  select e.id, e.auth_user_id, e.role, e.preferred_language, expected_purpose;
end
$$;

create or replace function public.sindhorn_activation_finalize(
  p_employee_id uuid,
  p_claim_hash text,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.sindhorn_employees%rowtype;
  a sindhorn_private.activation_codes%rowtype;
begin
  select * into e
  from public.sindhorn_employees
  where id = p_employee_id and active
  for update;
  if not found then return false; end if;

  select * into a
  from sindhorn_private.activation_codes
  where employee_id = e.id
    and claim_token_hash = p_claim_hash
    and claim_expires_at > now()
    and consumed_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if not found then return false; end if;

  if a.purpose = 'activate' then
    if e.auth_user_id is not null and e.auth_user_id <> p_auth_user_id then return false; end if;
    update public.sindhorn_employees
      set auth_user_id = p_auth_user_id,
          activated_at = coalesce(activated_at,now()),
          deactivated_at = null,
          updated_at = now()
    where id = e.id;
  elsif a.purpose = 'recovery' then
    if e.auth_user_id is null or e.auth_user_id <> p_auth_user_id then return false; end if;
  else
    return false;
  end if;

  update sindhorn_private.activation_codes
    set consumed_at = now(),
        attempt_count = 0,
        locked_until = null,
        claim_token_hash = null,
        claim_expires_at = null
  where id = a.id;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(p_auth_user_id,'activation_consumed','sindhorn_employees',e.id::text,jsonb_build_object('purpose',a.purpose));

  return true;
end
$$;

create or replace function public.sindhorn_activation_release_claim(
  p_employee_id uuid,
  p_claim_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update sindhorn_private.activation_codes
    set claim_token_hash = null,
        claim_expires_at = null
  where employee_id = p_employee_id
    and claim_token_hash = p_claim_hash
    and consumed_at is null
    and revoked_at is null;
  return found;
end
$$;

create or replace function public.sindhorn_issue_activation_code(
  p_employee_id uuid,
  p_code_hash text,
  p_expires_at timestamptz,
  p_purpose text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.sindhorn_employees%rowtype;
  new_id uuid;
begin
  if p_purpose not in ('activate','recovery') then
    raise exception 'invalid activation purpose';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '1 day' then
    raise exception 'invalid activation expiry';
  end if;
  if p_code_hash is null or length(p_code_hash) < 32 then
    raise exception 'invalid activation hash';
  end if;

  select * into e
  from public.sindhorn_employees
  where id = p_employee_id and active
  for update;
  if not found then raise exception 'employee not active'; end if;

  if p_purpose='activate' and e.auth_user_id is not null then
    raise exception 'employee already activated';
  end if;
  if p_purpose='recovery' and e.auth_user_id is null then
    raise exception 'employee has not been activated';
  end if;

  update sindhorn_private.activation_codes
    set revoked_at = now(), claim_token_hash = null, claim_expires_at = null
  where employee_id = e.id
    and purpose = p_purpose
    and consumed_at is null
    and revoked_at is null;

  insert into sindhorn_private.activation_codes(employee_id,code_hash,expires_at,purpose,created_by)
  values(e.id,p_code_hash,p_expires_at,p_purpose,p_actor_user_id)
  returning id into new_id;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(p_actor_user_id,'activation_code_issued','sindhorn_employees',e.id::text,
    jsonb_build_object('purpose',p_purpose,'expires_at',p_expires_at));

  return new_id;
end
$$;

revoke all on function public.sindhorn_activation_prepare(text,text,text,integer) from public,anon,authenticated;
revoke all on function public.sindhorn_activation_finalize(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.sindhorn_activation_release_claim(uuid,text) from public,anon,authenticated;
revoke all on function public.sindhorn_issue_activation_code(uuid,text,timestamptz,text,uuid) from public,anon,authenticated;

grant execute on function public.sindhorn_activation_prepare(text,text,text,integer) to service_role;
grant execute on function public.sindhorn_activation_finalize(uuid,text,uuid) to service_role;
grant execute on function public.sindhorn_activation_release_claim(uuid,text) to service_role;
grant execute on function public.sindhorn_issue_activation_code(uuid,text,timestamptz,text,uuid) to service_role;

comment on function public.sindhorn_activation_prepare(text,text,text,integer) is 'Service-role-only activation proof verification/claim. Never expose to browser credentials.';
comment on function public.sindhorn_activation_finalize(uuid,text,uuid) is 'Service-role-only employee/Auth binding and one-time activation consumption.';
comment on function public.sindhorn_issue_activation_code(uuid,text,timestamptz,text,uuid) is 'Service-role-only activation-code issuance. Accepts only a pre-HMACed code hash.';
