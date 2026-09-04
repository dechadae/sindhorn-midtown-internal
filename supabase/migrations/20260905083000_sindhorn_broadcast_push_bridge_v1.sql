-- Broadcast -> Web Push bridge (r16b).
--
-- When a broadcast becomes published, one HTTPS request is queued through
-- pg_net to the alerts Worker, which fans it out to every subscribed device.
-- Push subscriptions are anonymous (a device, not an employee), so only a
-- broadcast sent to Everyone is pushed; a targeted broadcast reaches its
-- audience in Messages without a push. A sensitive broadcast pushes its title
-- alone - the text is read in the app.
--
-- This migration stores no endpoint and no credential. Provision both in
-- Supabase Vault before expecting a push:
--   sindhorn_broadcast_push_url     full production /broadcast-published URL
--   sindhorn_broadcast_push_token   the same bearer secret as the Worker's
--                                   BROADCAST_PUSH_TOKEN
-- Until both exist, publishing still commits and the ledger says not_configured.
--
-- A scheduled broadcast is released by pg_cron once its time comes: the row
-- flips to published (the stamp trigger keeps its publish_at), which is what
-- fires the push. sindhorn_broadcast_inbox_v1 already showed due scheduled
-- rows, so the inbox does not depend on the minute tick.

create table if not exists public.sindhorn_broadcast_push_events (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null unique references public.sindhorn_broadcasts(id) on delete cascade,
  request_id bigint,
  status text not null default 'not_configured'
    check (status in ('not_configured','skipped','queued','error')),
  reason text,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sindhorn_broadcast_push_events enable row level security;
revoke all on table public.sindhorn_broadcast_push_events from public, anon, authenticated;

comment on table public.sindhorn_broadcast_push_events is
  'Transport-only ledger for broadcast push dispatches. One row per broadcast; never holds the endpoint or the token.';

create or replace function public.sindhorn_broadcast_queue_push(
  p_broadcast_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.sindhorn_broadcasts%rowtype;
  v_reason text;
  v_event_id uuid;
  v_existing_status text;
  v_existing_request_id bigint;
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  select * into b from public.sindhorn_broadcasts where id = p_broadcast_id;
  if b.id is null then
    return jsonb_build_object('queued', false, 'reason', 'unknown_broadcast');
  end if;

  if b.status <> 'published' then v_reason := 'not_published';
  elsif not coalesce(b.push_enabled, false) then v_reason := 'push_disabled';
  elsif b.expires_at is not null and b.expires_at <= now() then v_reason := 'expired';
  elsif not exists (
    select 1 from public.sindhorn_broadcast_targets t
    where t.broadcast_id = b.id and t.target_type = 'everyone'
  ) then v_reason := 'targeted';
  end if;

  insert into public.sindhorn_broadcast_push_events(broadcast_id, status)
  values (b.id, 'not_configured')
  on conflict (broadcast_id) do nothing;

  select e.id, e.status, e.request_id
  into v_event_id, v_existing_status, v_existing_request_id
  from public.sindhorn_broadcast_push_events e
  where e.broadcast_id = b.id;

  if v_existing_status = 'queued' and not p_force then
    return jsonb_build_object('queued', true, 'duplicate', true, 'requestId', v_existing_request_id);
  end if;

  if v_reason is not null then
    update public.sindhorn_broadcast_push_events
    set status = 'skipped', reason = v_reason, request_id = null, queued_at = null, updated_at = now()
    where id = v_event_id;
    return jsonb_build_object('queued', false, 'reason', v_reason);
  end if;

  select nullif(btrim(v.decrypted_secret), '') into v_url
  from vault.decrypted_secrets v
  where v.name = 'sindhorn_broadcast_push_url'
  order by v.updated_at desc limit 1;

  select nullif(btrim(v.decrypted_secret), '') into v_token
  from vault.decrypted_secrets v
  where v.name = 'sindhorn_broadcast_push_token'
  order by v.updated_at desc limit 1;

  if v_url is null or v_token is null then
    update public.sindhorn_broadcast_push_events
    set status = 'not_configured', reason = null, request_id = null, queued_at = null, updated_at = now()
    where id = v_event_id;
    return jsonb_build_object('queued', false, 'reason', 'not_configured');
  end if;

  begin
    v_request_id := net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'id', b.id,
        'titleEn', left(b.title_en, 120),
        'bodyEn', case when coalesce(b.sensitive, false) then null else left(b.body_en, 240) end,
        'sensitive', coalesce(b.sensitive, false),
        'priority', b.priority,
        'category', b.category,
        'publishedAt', coalesce(b.published_at, b.publish_at, now())
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    update public.sindhorn_broadcast_push_events
    set status = 'error', reason = sqlstate, request_id = null, queued_at = null, updated_at = now()
    where id = v_event_id;
    return jsonb_build_object('queued', false, 'reason', 'queue_error');
  end;

  update public.sindhorn_broadcast_push_events
  set status = 'queued', reason = null, request_id = v_request_id, queued_at = now(), updated_at = now()
  where id = v_event_id;

  return jsonb_build_object('queued', true, 'duplicate', false, 'requestId', v_request_id);
end;
$$;

revoke all on function public.sindhorn_broadcast_queue_push(uuid, boolean) from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_queue_push(uuid, boolean) to service_role;

comment on function public.sindhorn_broadcast_queue_push(uuid, boolean) is
  'Queues one push for a published, push-enabled, Everyone broadcast through pg_net using the Vault URL/token. Controlled retry with p_force.';

create or replace function public.sindhorn_broadcast_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    begin
      perform public.sindhorn_broadcast_queue_push(new.id, false);
    exception when others then
      -- Publishing is the transaction that matters; transport must never block it.
      raise warning 'Broadcast push queue failed for % (SQLSTATE %)', new.id, sqlstate;
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.sindhorn_broadcast_push_trigger() from public, anon, authenticated;

drop trigger if exists sindhorn_broadcast_push on public.sindhorn_broadcasts;
create trigger sindhorn_broadcast_push
after insert or update of status on public.sindhorn_broadcasts
for each row
execute function public.sindhorn_broadcast_push_trigger();

-- Release due scheduled broadcasts. Runs from pg_cron every minute; the
-- stamp trigger keeps publish_at and records published_at, the push trigger
-- above then queues the push.
create or replace function public.sindhorn_broadcast_release_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sindhorn_broadcasts
  set status = 'published'
  where status = 'scheduled' and publish_at is not null and publish_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.sindhorn_broadcast_release_due() from public, anon, authenticated;
grant execute on function public.sindhorn_broadcast_release_due() to service_role;

select cron.schedule(
  'sindhorn-broadcast-release-due',
  '* * * * *',
  $$select public.sindhorn_broadcast_release_due()$$
);
