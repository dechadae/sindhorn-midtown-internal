-- Phase 9 manual activation: restore the Auth Admin header pattern that is
-- empirically verified to reach Supabase Auth for this project.
--
-- The Vault-held credential is a modern sb_secret_ key. The previous migration
-- removed Authorization after interpreting the generic key-migration guidance
-- too broadly; that prevented these direct Auth Admin calls from reaching the
-- Auth service. Keep both headers here to match the server-client behavior that
-- passed the project smoke test.

create or replace function sindhorn_private.auth_admin_request(
  p_method text,
  p_path text,
  p_body jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
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
  where name='sindhorn_auth_admin_key'
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
      extensions.http_header('apikey',v_key),
      extensions.http_header('Authorization','Bearer ' || v_key),
      extensions.http_header('Content-Type','application/json')
    ],
    'application/json',
    coalesce(p_body,'{}'::jsonb)::text
  )::extensions.http_request);

  if v_response.status < 200 or v_response.status >= 300 then
    raise exception 'supabase auth admin request failed';
  end if;

  return coalesce(nullif(v_response.content,'')::jsonb,'{}'::jsonb);
end
$$;

revoke all on function sindhorn_private.auth_admin_request(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function sindhorn_private.auth_admin_request(text,text,jsonb)
  to postgres;
