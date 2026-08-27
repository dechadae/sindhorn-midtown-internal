create or replace function sindhorn_private.auth_admin_request(p_method text, p_path text, p_body jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_key text;
  v_response extensions.http_response;
  v_url text;
  v_method text;
begin
  v_method := upper(coalesce(p_method,''));
  if v_method not in ('POST','PUT') then
    raise exception 'invalid auth admin method';
  end if;
  if p_path is null or p_path !~ '^/auth/v1/admin/' then
    raise exception 'invalid auth admin path';
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'sindhorn_auth_admin_key'
  limit 1;

  if v_key is null or length(v_key) < 32 then
    raise exception 'auth admin key unavailable';
  end if;

  v_url := 'https://sjpvhgxacsiorrtijqua.supabase.co' || p_path;

  select * into v_response
  from extensions.http((
    v_method,
    v_url,
    array[
      extensions.http_header('apikey', v_key),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    coalesce(p_body, '{}'::jsonb)::text
  )::extensions.http_request);

  if v_response.status < 200 or v_response.status >= 300 then
    raise exception 'supabase auth admin request failed';
  end if;

  return coalesce(nullif(v_response.content,'')::jsonb, '{}'::jsonb);
end
$$;

revoke all on function sindhorn_private.auth_admin_request(text,text,jsonb) from public, anon, authenticated;
grant execute on function sindhorn_private.auth_admin_request(text,text,jsonb) to postgres;

create or replace function sindhorn_private.auth_admin_post(p_path text, p_body jsonb)
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select sindhorn_private.auth_admin_request('POST', p_path, p_body)
$$;

revoke all on function sindhorn_private.auth_admin_post(text,jsonb) from public, anon, authenticated;
grant execute on function sindhorn_private.auth_admin_post(text,jsonb) to postgres;

create or replace function public.sindhorn_manual_activate(p_employee_number text, p_plain_code text)
returns table(token_hash text, preferred_language text, purpose text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  e public.sindhorn_employees%rowtype;
  a sindhorn_private.activation_codes%rowtype;
  v_expected_purpose text;
  v_stored_hash text;
  v_next_attempts integer;
  v_email text;
  v_user_id uuid;
  v_existing_meta jsonb;
  v_auth_response jsonb;
  v_token_hash text;
  v_identity_id uuid;
begin
  if p_employee_number is null
     or length(btrim(p_employee_number)) = 0
     or p_plain_code is null
     or p_plain_code !~ '^[0-9]{6}$' then
    return;
  end if;

  select * into e
  from public.sindhorn_employees
  where employee_number = btrim(p_employee_number)
    and active
  for update;

  if not found then return; end if;

  v_expected_purpose := case when e.auth_user_id is null then 'activate' else 'recovery' end;

  select * into a
  from sindhorn_private.activation_codes
  where employee_id = e.id
    and purpose = v_expected_purpose
    and consumed_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found or a.code_hash not like 'bcrypt:%' then return; end if;
  if a.locked_until is not null and a.locked_until > now() then return; end if;

  v_stored_hash := substring(a.code_hash from 8);
  if v_stored_hash is null or extensions.crypt(p_plain_code, v_stored_hash) <> v_stored_hash then
    v_next_attempts := a.attempt_count + 1;
    update sindhorn_private.activation_codes
      set attempt_count = v_next_attempts,
          locked_until = case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end
    where id = a.id;
    return;
  end if;

  if e.auth_user_id is not null then
    v_user_id := e.auth_user_id;
  else
    select i.auth_user_id into v_user_id
    from public.sindhorn_employee_identities i
    where i.employee_id = e.id
      and i.auth_user_id is not null
    order by case when i.login_method='employee_id' then 0 else 1 end, i.created_at
    limit 1;
  end if;

  if v_user_id is not null then
    select u.email, u.raw_app_meta_data into v_email, v_existing_meta
    from auth.users u
    where u.id = v_user_id;

    if not found then
      v_user_id := null;
    elsif coalesce(v_existing_meta->>'sindhorn_employee_id','') not in ('', e.id::text) then
      raise exception 'activation unavailable';
    end if;
  end if;

  if v_user_id is null then
    v_email := 'smi-' || replace(e.id::text, '-', '') || '@auth.invalid';
    v_auth_response := sindhorn_private.auth_admin_post(
      '/auth/v1/admin/users',
      jsonb_build_object(
        'email', v_email,
        'email_confirm', true,
        'app_metadata', jsonb_build_object(
          'sindhorn_employee_id', e.id,
          'sindhorn_internal', true,
          'login_method', 'employee_id'
        )
      )
    );
    v_user_id := coalesce(
      nullif(v_auth_response->>'id','')::uuid,
      nullif(v_auth_response->'user'->>'id','')::uuid
    );
    if v_user_id is null then raise exception 'activation unavailable'; end if;
  else
    if v_email is null or btrim(v_email) = '' then
      v_email := 'smi-' || replace(e.id::text, '-', '') || '@auth.invalid';
      v_auth_response := sindhorn_private.auth_admin_request(
        'PUT',
        '/auth/v1/admin/users/' || v_user_id::text,
        jsonb_build_object(
          'email', v_email,
          'email_confirm', true,
          'app_metadata', coalesce(v_existing_meta, '{}'::jsonb) || jsonb_build_object(
            'sindhorn_employee_id', e.id,
            'sindhorn_internal', true
          )
        )
      );
    end if;
  end if;

  v_auth_response := sindhorn_private.auth_admin_post(
    '/auth/v1/admin/generate_link',
    jsonb_build_object('type','magiclink','email',v_email)
  );

  v_token_hash := coalesce(
    nullif(v_auth_response->>'hashed_token',''),
    nullif(v_auth_response->'properties'->>'hashed_token','')
  );

  if v_token_hash is null then raise exception 'activation unavailable'; end if;

  update public.sindhorn_employees
  set auth_user_id = v_user_id,
      activated_at = coalesce(activated_at, now()),
      deactivated_at = null,
      updated_at = now()
  where id = e.id;

  select i.id into v_identity_id
  from public.sindhorn_employee_identities i
  where i.employee_id = e.id
    and i.login_method = 'employee_id'
  limit 1
  for update;

  if v_identity_id is null then
    insert into public.sindhorn_employee_identities(
      employee_id, auth_user_id, login_method, provider,
      provider_subject, email, last_used_at
    ) values (
      e.id, v_user_id, 'employee_id', 'internal',
      v_user_id::text, v_email, now()
    );
  else
    update public.sindhorn_employee_identities
    set auth_user_id = v_user_id,
        provider = 'internal',
        provider_subject = v_user_id::text,
        email = v_email,
        last_used_at = now()
    where id = v_identity_id;
  end if;

  update sindhorn_private.activation_codes
  set consumed_at = now(),
      attempt_count = 0,
      locked_until = null,
      claim_token_hash = null,
      claim_expires_at = null
  where id = a.id;

  insert into sindhorn_private.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  values(v_user_id, 'activation_consumed', 'sindhorn_employees', e.id::text,
         jsonb_build_object('purpose',v_expected_purpose,'method','manual_admin_code'));

  return query
  select v_token_hash,
         case when e.preferred_language = 'en' then 'en' else 'th' end,
         v_expected_purpose;
exception
  when others then
    raise exception 'activation unavailable';
end
$$;

revoke all on function public.sindhorn_manual_activate(text,text) from public;
grant execute on function public.sindhorn_manual_activate(text,text) to anon, authenticated, service_role;
