-- Daily Business Dashboard publication -> Web Push bridge.
--
-- This migration is intentionally data-free. It never stores hotel report values in the
-- notification ledger and it never embeds Worker URLs or credentials. Runtime endpoint/token
-- values must be provisioned separately in Supabase Vault as:
--   sindhorn_business_update_url
--   sindhorn_business_update_token
--
-- Release order matters: deploy the compatible alerts Worker first, provision both Vault
-- secrets, then apply this migration. Until both secrets exist, publication remains non-blocking
-- and notification events are recorded as not_configured rather than sent.

create table if not exists public.business_dashboard_notification_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.business_report_runs(id) on delete cascade,
  previous_run_id uuid references public.business_report_runs(id) on delete set null,
  business_date date not null,
  revision integer not null check (revision >= 1),
  domain text not null check (domain in ('fnb','rooms','both')),
  event_id text not null unique check (char_length(event_id) between 8 and 160),
  request_id bigint,
  status text not null default 'not_configured'
    check (status in ('not_configured','queued','error')),
  error_code text,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists business_dashboard_notification_events_run_idx
  on public.business_dashboard_notification_events(run_id);
create index if not exists business_dashboard_notification_events_date_idx
  on public.business_dashboard_notification_events(business_date desc, created_at desc);

alter table public.business_dashboard_notification_events enable row level security;
revoke all on table public.business_dashboard_notification_events from public, anon, authenticated;

create or replace function public.sindhorn_business_notification_domain(
  p_run_id uuid,
  p_previous_run_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_fnb text;
  v_current_rooms text;
  v_previous_fnb text;
  v_previous_rooms text;
  v_fnb_changed boolean;
  v_rooms_changed boolean;
begin
  if p_run_id is null then
    return null;
  end if;

  select
    max(s.sha256) filter (where s.source_type = 'fnb_xlsx'),
    max(s.sha256) filter (where s.source_type = 'rooms_pdf')
  into v_current_fnb, v_current_rooms
  from public.source_report_files s
  where s.run_id = p_run_id;

  if v_current_fnb is null and v_current_rooms is null then
    return null;
  end if;

  if p_previous_run_id is not null then
    select
      max(s.sha256) filter (where s.source_type = 'fnb_xlsx'),
      max(s.sha256) filter (where s.source_type = 'rooms_pdf')
    into v_previous_fnb, v_previous_rooms
    from public.source_report_files s
    where s.run_id = p_previous_run_id;
  end if;

  v_fnb_changed := v_current_fnb is distinct from v_previous_fnb;
  v_rooms_changed := v_current_rooms is distinct from v_previous_rooms;

  if v_fnb_changed and v_rooms_changed then return 'both'; end if;
  if v_fnb_changed then return 'fnb'; end if;
  if v_rooms_changed then return 'rooms'; end if;
  return null;
end;
$$;

revoke all on function public.sindhorn_business_notification_domain(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.sindhorn_business_notification_domain(uuid, uuid)
  to service_role;

create or replace function public.sindhorn_business_queue_notification(
  p_run_id uuid,
  p_previous_run_id uuid default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_date date;
  v_revision integer;
  v_status text;
  v_domain text;
  v_event_id text;
  v_summary text;
  v_event_row_id uuid;
  v_existing_status text;
  v_existing_request_id bigint;
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  select r.business_date, r.revision, r.status
  into v_business_date, v_revision, v_status
  from public.business_report_runs r
  where r.id = p_run_id;

  if v_business_date is null then
    return jsonb_build_object('queued', false, 'reason', 'unknown_run');
  end if;

  if v_status <> 'approved' then
    return jsonb_build_object('queued', false, 'reason', 'not_approved');
  end if;

  v_domain := public.sindhorn_business_notification_domain(p_run_id, p_previous_run_id);
  if v_domain is null then
    return jsonb_build_object('queued', false, 'reason', 'no_source_change');
  end if;

  v_event_id := 'business:' || to_char(v_business_date, 'YYYY-MM-DD') ||
    ':r' || v_revision::text || ':' || v_domain || ':' || p_run_id::text;

  v_summary := case v_domain
    when 'fnb' then 'F&B report updated. Tap to view Hotel Business.'
    when 'rooms' then 'Rooms report updated. Tap to view Hotel Business.'
    else 'Today business reports updated. Tap to view Hotel Business.'
  end;

  insert into public.business_dashboard_notification_events(
    run_id, previous_run_id, business_date, revision, domain, event_id, status
  ) values (
    p_run_id, p_previous_run_id, v_business_date, v_revision, v_domain, v_event_id, 'not_configured'
  )
  on conflict (event_id) do nothing;

  select e.id, e.status, e.request_id
  into v_event_row_id, v_existing_status, v_existing_request_id
  from public.business_dashboard_notification_events e
  where e.event_id = v_event_id;

  if v_event_row_id is null then
    return jsonb_build_object('queued', false, 'reason', 'event_reservation_failed');
  end if;

  if v_existing_status = 'queued' and not p_force then
    return jsonb_build_object(
      'queued', true,
      'duplicate', true,
      'eventId', v_event_id,
      'requestId', v_existing_request_id,
      'domain', v_domain
    );
  end if;

  select nullif(btrim(v.decrypted_secret), '')
  into v_url
  from vault.decrypted_secrets v
  where v.name = 'sindhorn_business_update_url'
  order by v.updated_at desc
  limit 1;

  select nullif(btrim(v.decrypted_secret), '')
  into v_token
  from vault.decrypted_secrets v
  where v.name = 'sindhorn_business_update_token'
  order by v.updated_at desc
  limit 1;

  if v_url is null or v_token is null then
    update public.business_dashboard_notification_events
    set status = 'not_configured', request_id = null, error_code = null, queued_at = null, updated_at = now()
    where id = v_event_row_id;
    return jsonb_build_object('queued', false, 'reason', 'not_configured', 'eventId', v_event_id, 'domain', v_domain);
  end if;

  begin
    v_request_id := net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'id', v_event_id,
        'domain', v_domain,
        'businessDate', v_business_date,
        'publishedAt', (
          select p.published_at
          from public.business_dashboard_publications p
          where p.run_id = p_run_id
          order by p.published_at desc
          limit 1
        ),
        'revision', v_revision,
        'summaryEn', v_summary
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    update public.business_dashboard_notification_events
    set status = 'error', request_id = null, error_code = sqlstate, queued_at = null, updated_at = now()
    where id = v_event_row_id;
    return jsonb_build_object('queued', false, 'reason', 'queue_error', 'eventId', v_event_id, 'domain', v_domain);
  end;

  update public.business_dashboard_notification_events
  set status = 'queued', request_id = v_request_id, error_code = null, queued_at = now(), updated_at = now()
  where id = v_event_row_id;

  return jsonb_build_object(
    'queued', true,
    'duplicate', false,
    'eventId', v_event_id,
    'requestId', v_request_id,
    'domain', v_domain
  );
end;
$$;

revoke all on function public.sindhorn_business_queue_notification(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.sindhorn_business_queue_notification(uuid, uuid, boolean)
  to service_role;

create or replace function public.sindhorn_business_publication_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_run_id uuid;
begin
  if tg_op = 'UPDATE' and new.run_id is not distinct from old.run_id then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_previous_run_id := old.run_id;
  else
    v_previous_run_id := new.supersedes_run_id;

    if v_previous_run_id is null then
      select p.run_id
      into v_previous_run_id
      from public.business_dashboard_publications p
      where p.run_id <> new.run_id
        and (
          p.business_date < new.business_date
          or (p.business_date = new.business_date and p.published_at < new.published_at)
        )
      order by p.business_date desc, p.published_at desc
      limit 1;
    end if;
  end if;

  begin
    perform public.sindhorn_business_queue_notification(new.run_id, v_previous_run_id, false);
  exception when others then
    -- Publication is the source-of-truth transaction. Notification transport must never block it.
    raise warning 'Business notification queue failed for run % (SQLSTATE %)', new.run_id, sqlstate;
  end;

  return new;
end;
$$;

revoke all on function public.sindhorn_business_publication_notification_trigger()
  from public, anon, authenticated;

drop trigger if exists business_dashboard_publication_notification
  on public.business_dashboard_publications;

create trigger business_dashboard_publication_notification
after insert or update of run_id on public.business_dashboard_publications
for each row
execute function public.sindhorn_business_publication_notification_trigger();

comment on table public.business_dashboard_notification_events is
  'Transport-only audit ledger for publication-triggered business update notifications. Contains no hotel report values.';
comment on function public.sindhorn_business_notification_domain(uuid, uuid) is
  'Classifies a publication as F&B, Rooms, both, or unchanged by comparing canonical source report hashes.';
comment on function public.sindhorn_business_queue_notification(uuid, uuid, boolean) is
  'Queues a generic, non-confidential business update notification through pg_net using URL/token from Supabase Vault.';
