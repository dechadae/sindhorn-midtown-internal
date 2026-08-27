-- Phase 9 — one-time emergency bootstrap activation path.
-- This exists only to initialize the first administrator when no already-authenticated
-- administrator can issue the normal HMAC activation code yet.
--
-- Security properties:
-- - browser roles cannot execute this RPC;
-- - it accepts only 6 numeric digits;
-- - it works only against a live activation_codes row whose hash is explicitly
--   prefixed with bcrypt: by a privileged database operator;
-- - normal activation rows remain HMAC-only and are unaffected;
-- - the same attempt lock / expiry / single-use claim mechanics apply;
-- - once consumed, the bootstrap row is unusable.

create or replace function public.sindhorn_bootstrap_activation_prepare(
  p_employee_number text,
  p_plain_code text,
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
  stored_hash text;
  next_attempts integer;
begin
  if p_employee_number is null or length(btrim(p_employee_number)) = 0
     or p_plain_code is null or p_plain_code !~ '^[0-9]{6}$'
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

  if not found or a.code_hash not like 'bcrypt:%' then
    return;
  end if;

  if a.locked_until is not null and a.locked_until > now() then
    return;
  end if;

  stored_hash := substring(a.code_hash from 8);
  if stored_hash is null
     or extensions.crypt(p_plain_code, stored_hash) <> stored_hash then
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

revoke all on function public.sindhorn_bootstrap_activation_prepare(text,text,text,integer)
from public,anon,authenticated;
grant execute on function public.sindhorn_bootstrap_activation_prepare(text,text,text,integer)
to service_role;

comment on function public.sindhorn_bootstrap_activation_prepare(text,text,text,integer) is
'Service-role-only emergency first-admin activation verifier for explicitly bcrypt-prefixed one-time rows. Browser roles cannot execute it.';
