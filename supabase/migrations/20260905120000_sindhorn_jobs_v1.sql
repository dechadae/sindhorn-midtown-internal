-- Sindhorn jobs: the Jobs tab's own table and RPC surface (r21, 5 Sep 2026).
-- Every employee keeps their own list of what was asked of them - the task,
-- who sent it and when, the deadline, where it stands. This is the Sindhorn
-- counterpart of the Flipgazine job board, with the cards as rows instead of
-- one HTML blob; it shares nothing with the job_tracking_* tables, which
-- belong to another project on this database and are not touched.
--
-- Access model, following the accepted capability pattern
-- (sindhorn_settings_capability_authority, 29 Aug 2026): the table is not
-- granted to authenticated at all - RLS is enabled with no policies - and
-- every read and write goes through a security-definer RPC that checks the
-- caller's capability and scopes strictly to the caller's own employee row.
-- jobs.read shows the tab, jobs.manage allows add / edit / status / archive.
-- Both are granted to everyone (plus the developer account type and the
-- super_admin role, as the other everyone-capabilities are), so each
-- employee gets a tracker of their own. Nothing is ever deleted: a job is
-- archived and drops out of the list.

create table if not exists public.sindhorn_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_employee_id uuid not null references public.sindhorn_employees(id) on delete cascade,
  job_key text not null check (job_key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  sender_name text not null default '' check (length(sender_name) <= 160),
  sender_role text not null default '' check (length(sender_role) <= 160),
  received_on date,
  deadline_on date,
  deadline_note text not null default '' check (length(deadline_note) <= 200),
  status text not null default 'not-started' check (status in ('not-started','working','stuck','done')),
  sort_order integer not null default 0,
  source text not null default 'manual' check (source in ('manual','inbox-run','flipgazine-import')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_employee_id, job_key)
);
create index if not exists sindhorn_jobs_owner_active_idx on public.sindhorn_jobs (owner_employee_id, sort_order, created_at desc) where archived_at is null;
alter table public.sindhorn_jobs enable row level security;
revoke all on public.sindhorn_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.sindhorn_jobs to service_role;

-- Capabilities: two keys, granted the way the other everyone-keys are.
insert into public.sindhorn_capabilities (key, label, description, active, sort_order) values
  ('jobs.read',   'Jobs: see own tracker',    'See the Jobs tab and the jobs on your own list.', true, 170),
  ('jobs.manage', 'Jobs: manage own tracker', 'Add, edit, move and archive jobs on your own list.', true, 171)
on conflict (key) do update set label = excluded.label, description = excluded.description, active = true;
insert into public.sindhorn_capability_grants (subject_type, subject_key, capability_key, allowed, active)
select s.subject_type, s.subject_key, c.key, true, true
from (values ('everyone','*'), ('account_type','developer'), ('role','super_admin')) as s(subject_type, subject_key)
cross join (values ('jobs.read'), ('jobs.manage')) as c(key)
where not exists (
  select 1 from public.sindhorn_capability_grants g
  where g.subject_type = s.subject_type and g.subject_key = s.subject_key and g.capability_key = c.key
);

-- ---------------------------------------------------------------------------
-- Helpers (private)
-- ---------------------------------------------------------------------------
create or replace function sindhorn_private.require_jobs(p_capability text)
returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare v_employee_id uuid := sindhorn_private.current_employee_id();
begin
  if v_employee_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not public.sindhorn_has_capability(p_capability) then raise exception 'capability required: %', p_capability using errcode='42501'; end if;
  return v_employee_id;
end $$;
revoke all on function sindhorn_private.require_jobs(text) from public, anon, authenticated;

create or replace function sindhorn_private.job_json(j public.sindhorn_jobs)
returns jsonb
language sql immutable set search_path=''
as $$
  select jsonb_build_object(
    'id', j.id, 'key', j.job_key,
    'title', j.title, 'description', j.description,
    'senderName', j.sender_name, 'senderRole', j.sender_role,
    'receivedOn', j.received_on, 'deadlineOn', j.deadline_on, 'deadlineNote', j.deadline_note,
    'status', j.status, 'sortOrder', j.sort_order, 'source', j.source,
    'createdAt', j.created_at, 'updatedAt', j.updated_at
  );
$$;
revoke all on function sindhorn_private.job_json(public.sindhorn_jobs) from public, anon, authenticated;

-- A key from a title, the way the Flipgazine cards were keyed; a numeric
-- suffix keeps it unique within the owner's list.
create or replace function sindhorn_private.job_key_for(p_owner uuid, p_title text)
returns text
language plpgsql stable set search_path=''
as $$
declare
  v_base text := left(regexp_replace(regexp_replace(lower(coalesce(p_title,'')), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), 60);
  v_key text; v_n int := 1;
begin
  if v_base = '' or v_base !~ '^[a-z0-9]' then v_base := 'job-' || to_char(now(), 'yyyymmdd'); end if;
  v_key := v_base;
  while exists (select 1 from public.sindhorn_jobs where owner_employee_id = p_owner and job_key = v_key) loop
    v_n := v_n + 1; v_key := v_base || '-' || v_n;
  end loop;
  return v_key;
end $$;
revoke all on function sindhorn_private.job_key_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (public, security definer, capability-gated, owner-scoped)
-- ---------------------------------------------------------------------------
create or replace function public.sindhorn_jobs_list_v1()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_owner uuid := sindhorn_private.require_jobs('jobs.read');
begin
  return jsonb_build_object(
    'ok', true,
    'canManage', public.sindhorn_has_capability('jobs.manage'),
    'updatedAt', (select max(updated_at) from public.sindhorn_jobs where owner_employee_id = v_owner),
    'jobs', coalesce((
      select jsonb_agg(sindhorn_private.job_json(j) order by j.sort_order, j.created_at desc)
      from public.sindhorn_jobs j
      where j.owner_employee_id = v_owner and j.archived_at is null
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.sindhorn_jobs_list_v1() from public, anon, authenticated;
grant execute on function public.sindhorn_jobs_list_v1() to authenticated;

-- Create (p_id null) or edit one job. Status is not set here: see set_status.
create or replace function public.sindhorn_jobs_save_v1(
  p_id uuid, p_title text, p_description text, p_sender_name text, p_sender_role text,
  p_received_on date, p_deadline_on date, p_deadline_note text
)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_owner uuid := sindhorn_private.require_jobs('jobs.manage'); v_row public.sindhorn_jobs;
begin
  if p_id is null then
    insert into public.sindhorn_jobs (owner_employee_id, job_key, title, description, sender_name, sender_role, received_on, deadline_on, deadline_note, sort_order, source)
    values (
      v_owner, sindhorn_private.job_key_for(v_owner, p_title), btrim(p_title), coalesce(btrim(p_description),''),
      coalesce(btrim(p_sender_name),''), coalesce(btrim(p_sender_role),''), coalesce(p_received_on, current_date), p_deadline_on, coalesce(btrim(p_deadline_note),''),
      coalesce((select min(sort_order) from public.sindhorn_jobs where owner_employee_id = v_owner), 1) - 1, 'manual'
    ) returning * into v_row;
  else
    update public.sindhorn_jobs set
      title = btrim(p_title), description = coalesce(btrim(p_description),''),
      sender_name = coalesce(btrim(p_sender_name),''), sender_role = coalesce(btrim(p_sender_role),''),
      received_on = p_received_on, deadline_on = p_deadline_on, deadline_note = coalesce(btrim(p_deadline_note),''),
      updated_at = now()
    where id = p_id and owner_employee_id = v_owner and archived_at is null
    returning * into v_row;
    if v_row.id is null then raise exception 'job not found' using errcode='P0002'; end if;
  end if;
  return jsonb_build_object('ok', true, 'job', sindhorn_private.job_json(v_row));
end $$;
revoke all on function public.sindhorn_jobs_save_v1(uuid,text,text,text,text,date,date,text) from public, anon, authenticated;
grant execute on function public.sindhorn_jobs_save_v1(uuid,text,text,text,text,date,date,text) to authenticated;

create or replace function public.sindhorn_jobs_set_status_v1(p_id uuid, p_status text)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_owner uuid := sindhorn_private.require_jobs('jobs.manage'); v_row public.sindhorn_jobs;
begin
  update public.sindhorn_jobs set status = p_status, updated_at = now()
  where id = p_id and owner_employee_id = v_owner and archived_at is null
  returning * into v_row;
  if v_row.id is null then raise exception 'job not found' using errcode='P0002'; end if;
  return jsonb_build_object('ok', true, 'job', sindhorn_private.job_json(v_row));
end $$;
revoke all on function public.sindhorn_jobs_set_status_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.sindhorn_jobs_set_status_v1(uuid,text) to authenticated;

-- The whole active list in the order given; ids not owned are ignored.
-- Reordering is not a change to a job, so updated_at stays.
create or replace function public.sindhorn_jobs_reorder_v1(p_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_owner uuid := sindhorn_private.require_jobs('jobs.manage'); v_count int;
begin
  update public.sindhorn_jobs j set sort_order = o.ord
  from unnest(coalesce(p_ids,'{}'::uuid[])) with ordinality as o(id, ord)
  where j.id = o.id and j.owner_employee_id = v_owner and j.archived_at is null;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'moved', v_count);
end $$;
revoke all on function public.sindhorn_jobs_reorder_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.sindhorn_jobs_reorder_v1(uuid[]) to authenticated;

create or replace function public.sindhorn_jobs_archive_v1(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_owner uuid := sindhorn_private.require_jobs('jobs.manage'); v_count int;
begin
  update public.sindhorn_jobs set archived_at = now(), updated_at = now()
  where id = p_id and owner_employee_id = v_owner and archived_at is null;
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'job not found' using errcode='P0002'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sindhorn_jobs_archive_v1(uuid) from public, anon, authenticated;
grant execute on function public.sindhorn_jobs_archive_v1(uuid) to authenticated;
