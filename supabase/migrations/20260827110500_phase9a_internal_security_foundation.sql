-- Phase 9A — Sindhorn Midtown internal employee security foundation
-- Additive/default-deny migration. No employee rows, activation codes, broadcasts,
-- or privileged accounts are created by this migration.

create schema if not exists sindhorn_private;
revoke all on schema sindhorn_private from public, anon, authenticated;

create table if not exists public.sindhorn_departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_th text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_departments_code_check check (code ~ '^[a-z0-9][a-z0-9_-]{1,48}$')
);

create table if not exists public.sindhorn_employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  display_name text,
  department_id uuid references public.sindhorn_departments(id) on delete set null,
  role text not null default 'employee',
  active boolean not null default true,
  preferred_language text not null default 'th',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_employees_number_check check (length(btrim(employee_number)) between 1 and 64),
  constraint sindhorn_employees_role_check check (role in ('employee','supervisor','manager','admin','super_admin')),
  constraint sindhorn_employees_language_check check (preferred_language in ('en','th')),
  constraint sindhorn_employees_deactivation_check check ((active and deactivated_at is null) or not active)
);

create index if not exists sindhorn_employees_department_idx on public.sindhorn_employees(department_id);
create index if not exists sindhorn_employees_role_idx on public.sindhorn_employees(role) where active;
create index if not exists sindhorn_employees_auth_user_idx on public.sindhorn_employees(auth_user_id) where auth_user_id is not null;

create table if not exists public.sindhorn_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_th text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_groups_code_check check (code ~ '^[a-z0-9][a-z0-9_-]{1,48}$')
);

create table if not exists public.sindhorn_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.sindhorn_groups(id) on delete cascade,
  employee_id uuid not null references public.sindhorn_employees(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(group_id, employee_id)
);

create index if not exists sindhorn_group_members_employee_idx on public.sindhorn_group_members(employee_id);

create table if not exists public.sindhorn_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_th text,
  body_en text not null,
  body_th text,
  category text not null default 'hotel_news',
  priority text not null default 'normal',
  status text not null default 'draft',
  sensitive boolean not null default false,
  pinned boolean not null default false,
  push_enabled boolean not null default true,
  route text not null default '/messages',
  publish_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  revoked_at timestamptz,
  constraint sindhorn_broadcasts_category_check check (category in ('hotel_news','operations','safety','hr','event','environment')),
  constraint sindhorn_broadcasts_priority_check check (priority in ('normal','high','urgent')),
  constraint sindhorn_broadcasts_status_check check (status in ('draft','scheduled','published','revoked')),
  constraint sindhorn_broadcasts_title_en_check check (length(btrim(title_en)) between 1 and 180),
  constraint sindhorn_broadcasts_body_en_check check (length(btrim(body_en)) between 1 and 12000),
  constraint sindhorn_broadcasts_route_check check (route like '/%'),
  constraint sindhorn_broadcasts_publish_time_check check (status not in ('scheduled','published') or publish_at is not null),
  constraint sindhorn_broadcasts_expiry_check check (expires_at is null or publish_at is null or expires_at > publish_at)
);

create index if not exists sindhorn_broadcasts_delivery_idx on public.sindhorn_broadcasts(status, publish_at desc, expires_at);
create index if not exists sindhorn_broadcasts_pinned_idx on public.sindhorn_broadcasts(pinned, publish_at desc) where status in ('scheduled','published');

create table if not exists public.sindhorn_broadcast_targets (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.sindhorn_broadcasts(id) on delete cascade,
  target_type text not null,
  department_id uuid references public.sindhorn_departments(id) on delete cascade,
  role text,
  group_id uuid references public.sindhorn_groups(id) on delete cascade,
  employee_id uuid references public.sindhorn_employees(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sindhorn_broadcast_targets_type_check check (target_type in ('everyone','department','role','group','employee')),
  constraint sindhorn_broadcast_targets_role_check check (role is null or role in ('employee','supervisor','manager','admin','super_admin')),
  constraint sindhorn_broadcast_targets_shape_check check (
    (target_type='everyone' and department_id is null and role is null and group_id is null and employee_id is null) or
    (target_type='department' and department_id is not null and role is null and group_id is null and employee_id is null) or
    (target_type='role' and department_id is null and role is not null and group_id is null and employee_id is null) or
    (target_type='group' and department_id is null and role is null and group_id is not null and employee_id is null) or
    (target_type='employee' and department_id is null and role is null and group_id is null and employee_id is not null)
  )
);

create unique index if not exists sindhorn_broadcast_target_everyone_uniq on public.sindhorn_broadcast_targets(broadcast_id) where target_type='everyone';
create unique index if not exists sindhorn_broadcast_target_department_uniq on public.sindhorn_broadcast_targets(broadcast_id,department_id) where target_type='department';
create unique index if not exists sindhorn_broadcast_target_role_uniq on public.sindhorn_broadcast_targets(broadcast_id,role) where target_type='role';
create unique index if not exists sindhorn_broadcast_target_group_uniq on public.sindhorn_broadcast_targets(broadcast_id,group_id) where target_type='group';
create unique index if not exists sindhorn_broadcast_target_employee_uniq on public.sindhorn_broadcast_targets(broadcast_id,employee_id) where target_type='employee';
create index if not exists sindhorn_broadcast_targets_lookup_idx on public.sindhorn_broadcast_targets(broadcast_id,target_type);

create table if not exists public.sindhorn_broadcast_reads (
  broadcast_id uuid not null references public.sindhorn_broadcasts(id) on delete cascade,
  employee_id uuid not null references public.sindhorn_employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (broadcast_id, employee_id)
);

create index if not exists sindhorn_broadcast_reads_employee_idx on public.sindhorn_broadcast_reads(employee_id,read_at desc);

create table if not exists sindhorn_private.activation_codes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.sindhorn_employees(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  attempt_count integer not null default 0,
  locked_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sindhorn_activation_attempt_count_check check (attempt_count >= 0),
  constraint sindhorn_activation_expiry_check check (expires_at > created_at)
);

create index if not exists sindhorn_activation_employee_idx on sindhorn_private.activation_codes(employee_id,expires_at desc);

create table if not exists sindhorn_private.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sindhorn_audit_entity_idx on sindhorn_private.audit_log(entity_type,entity_id,created_at desc);
create index if not exists sindhorn_audit_actor_idx on sindhorn_private.audit_log(actor_user_id,created_at desc);

-- Private authorization helpers. These intentionally read the dedicated Sindhorn
-- employee table rather than generic shared-project app_users/role helpers.
create or replace function sindhorn_private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.sindhorn_employees e
  where e.auth_user_id = (select auth.uid())
    and e.active
  limit 1
$$;

create or replace function sindhorn_private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.sindhorn_employees e
  where e.auth_user_id = (select auth.uid())
    and e.active
  limit 1
$$;

create or replace function sindhorn_private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.sindhorn_employees e
    where e.auth_user_id = (select auth.uid())
      and e.active
  )
$$;

create or replace function sindhorn_private.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.role in ('admin','super_admin')
    from public.sindhorn_employees e
    where e.auth_user_id = (select auth.uid())
      and e.active
    limit 1
  ), false)
$$;

create or replace function sindhorn_private.can_manage_people()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.role in ('admin','super_admin')
    from public.sindhorn_employees e
    where e.auth_user_id = (select auth.uid())
      and e.active
    limit 1
  ), false)
$$;

create or replace function sindhorn_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.role = 'super_admin'
    from public.sindhorn_employees e
    where e.auth_user_id = (select auth.uid())
      and e.active
    limit 1
  ), false)
$$;

create or replace function sindhorn_private.has_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
$$;

create or replace function sindhorn_private.broadcast_visible_to_me(p_broadcast_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.sindhorn_broadcasts b
    join public.sindhorn_employees e
      on e.auth_user_id = (select auth.uid())
     and e.active
    where b.id = p_broadcast_id
      and b.status in ('scheduled','published')
      and b.publish_at is not null
      and b.publish_at <= now()
      and (b.expires_at is null or b.expires_at > now())
      and exists(
        select 1
        from public.sindhorn_broadcast_targets t
        where t.broadcast_id = b.id
          and (
            t.target_type = 'everyone'
            or (t.target_type = 'department' and t.department_id = e.department_id)
            or (t.target_type = 'role' and t.role = e.role)
            or (t.target_type = 'employee' and t.employee_id = e.id)
            or (t.target_type = 'group' and exists(
              select 1
              from public.sindhorn_group_members gm
              join public.sindhorn_groups g on g.id = gm.group_id and g.active
              where gm.group_id = t.group_id
                and gm.employee_id = e.id
            ))
          )
      )
  )
$$;

-- Stamp broadcast actor/timing fields and enforce irreversible revoke semantics.
create or replace function sindhorn_private.stamp_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.status = 'revoked' then
      raise exception 'A broadcast cannot be created already revoked';
    end if;
    new.created_at := now();
    new.updated_at := now();
    new.created_by := actor;
    new.updated_by := actor;
    new.revoked_at := null;
    new.revoked_by := null;
    if new.status = 'published' then
      new.publish_at := coalesce(new.publish_at, now());
      new.published_at := now();
      new.published_by := actor;
    elsif new.status = 'scheduled' then
      if new.publish_at is null or new.publish_at <= now() then
        raise exception 'Scheduled broadcasts require a future publish_at';
      end if;
      new.published_at := null;
      new.published_by := null;
    else
      new.published_at := null;
      new.published_by := null;
    end if;
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor;

  if old.status = 'revoked' then
    raise exception 'Revoked broadcasts are immutable';
  end if;
  if old.status = 'published' and new.status not in ('published','revoked') then
    raise exception 'Published broadcasts may only remain published or be revoked';
  end if;

  if new.status = 'scheduled' and old.status <> 'scheduled' then
    if new.publish_at is null or new.publish_at <= now() then
      raise exception 'Scheduled broadcasts require a future publish_at';
    end if;
  end if;

  if new.status = 'published' and old.status <> 'published' then
    new.publish_at := coalesce(new.publish_at, now());
    new.published_at := now();
    new.published_by := actor;
  elsif old.status = 'published' then
    new.publish_at := old.publish_at;
    new.published_at := old.published_at;
    new.published_by := old.published_by;
  end if;

  if new.status = 'revoked' then
    new.revoked_at := now();
    new.revoked_by := actor;
  else
    new.revoked_at := old.revoked_at;
    new.revoked_by := old.revoked_by;
  end if;

  return new;
end
$$;

create or replace function sindhorn_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  old_data jsonb;
  new_data jsonb;
  row_id text;
begin
  if tg_op = 'INSERT' then
    old_data := null;
    new_data := to_jsonb(new);
    row_id := new_data->>'id';
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    row_id := coalesce(new_data->>'id', old_data->>'id');
  else
    old_data := to_jsonb(old);
    new_data := null;
    row_id := old_data->>'id';
  end if;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,before_json,after_json)
  values(actor,lower(tg_op),tg_table_name,row_id,old_data,new_data);
  return coalesce(new, old);
end
$$;

-- Trigger ordering: the BEFORE trigger stamps trusted actor/timestamps; AFTER trigger
-- records the resulting row in the immutable private audit log.
drop trigger if exists sindhorn_broadcast_stamp on public.sindhorn_broadcasts;
create trigger sindhorn_broadcast_stamp
before insert or update on public.sindhorn_broadcasts
for each row execute function sindhorn_private.stamp_broadcast();

drop trigger if exists sindhorn_departments_audit on public.sindhorn_departments;
create trigger sindhorn_departments_audit after insert or update or delete on public.sindhorn_departments for each row execute function sindhorn_private.audit_row_change();
drop trigger if exists sindhorn_employees_audit on public.sindhorn_employees;
create trigger sindhorn_employees_audit after insert or update or delete on public.sindhorn_employees for each row execute function sindhorn_private.audit_row_change();
drop trigger if exists sindhorn_groups_audit on public.sindhorn_groups;
create trigger sindhorn_groups_audit after insert or update or delete on public.sindhorn_groups for each row execute function sindhorn_private.audit_row_change();
drop trigger if exists sindhorn_group_members_audit on public.sindhorn_group_members;
create trigger sindhorn_group_members_audit after insert or update or delete on public.sindhorn_group_members for each row execute function sindhorn_private.audit_row_change();
drop trigger if exists sindhorn_broadcasts_audit on public.sindhorn_broadcasts;
create trigger sindhorn_broadcasts_audit after insert or update or delete on public.sindhorn_broadcasts for each row execute function sindhorn_private.audit_row_change();
drop trigger if exists sindhorn_broadcast_targets_audit on public.sindhorn_broadcast_targets;
create trigger sindhorn_broadcast_targets_audit after insert or update or delete on public.sindhorn_broadcast_targets for each row execute function sindhorn_private.audit_row_change();

-- RLS is mandatory on every public Sindhorn internal table.
alter table public.sindhorn_departments enable row level security;
alter table public.sindhorn_employees enable row level security;
alter table public.sindhorn_groups enable row level security;
alter table public.sindhorn_group_members enable row level security;
alter table public.sindhorn_broadcasts enable row level security;
alter table public.sindhorn_broadcast_targets enable row level security;
alter table public.sindhorn_broadcast_reads enable row level security;

-- Explicit privileges. Anonymous users receive no internal-data privileges.
revoke all on table public.sindhorn_departments, public.sindhorn_employees, public.sindhorn_groups,
  public.sindhorn_group_members, public.sindhorn_broadcasts, public.sindhorn_broadcast_targets,
  public.sindhorn_broadcast_reads from anon;
revoke all on table public.sindhorn_departments, public.sindhorn_employees, public.sindhorn_groups,
  public.sindhorn_group_members, public.sindhorn_broadcasts, public.sindhorn_broadcast_targets,
  public.sindhorn_broadcast_reads from authenticated;

grant select,insert,update on public.sindhorn_departments to authenticated;
grant select,insert,update on public.sindhorn_employees to authenticated;
grant select,insert,update,delete on public.sindhorn_groups to authenticated;
grant select,insert,update,delete on public.sindhorn_group_members to authenticated;
grant select,insert,update on public.sindhorn_broadcasts to authenticated;
grant select,insert,update,delete on public.sindhorn_broadcast_targets to authenticated;
grant select,insert,update on public.sindhorn_broadcast_reads to authenticated;

grant select,insert,update,delete on public.sindhorn_departments, public.sindhorn_employees,
  public.sindhorn_groups, public.sindhorn_group_members, public.sindhorn_broadcasts,
  public.sindhorn_broadcast_targets, public.sindhorn_broadcast_reads to service_role;

-- Private data never goes through normal client access.
revoke all on all tables in schema sindhorn_private from public, anon, authenticated;
revoke all on all sequences in schema sindhorn_private from public, anon, authenticated;
revoke all on all functions in schema sindhorn_private from public, anon, authenticated;
grant usage on schema sindhorn_private to authenticated, service_role;
grant execute on function sindhorn_private.current_employee_id() to authenticated;
grant execute on function sindhorn_private.current_role() to authenticated;
grant execute on function sindhorn_private.is_active() to authenticated;
grant execute on function sindhorn_private.can_manage_content() to authenticated;
grant execute on function sindhorn_private.can_manage_people() to authenticated;
grant execute on function sindhorn_private.is_super_admin() to authenticated;
grant execute on function sindhorn_private.has_aal2() to authenticated;
grant execute on function sindhorn_private.broadcast_visible_to_me(uuid) to authenticated;
grant select,insert,update,delete on all tables in schema sindhorn_private to service_role;
grant usage,select on all sequences in schema sindhorn_private to service_role;
grant execute on all functions in schema sindhorn_private to service_role;

-- Policies: active, bound Sindhorn employees only. Authorization does not depend on
-- the shared project's generic app_users tables or user-controlled metadata.
drop policy if exists sindhorn_departments_select on public.sindhorn_departments;
create policy sindhorn_departments_select on public.sindhorn_departments
for select to authenticated
using ((active and (select sindhorn_private.is_active())) or (select sindhorn_private.can_manage_content()));

drop policy if exists sindhorn_departments_insert on public.sindhorn_departments;
create policy sindhorn_departments_insert on public.sindhorn_departments
for insert to authenticated
with check ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_departments_update on public.sindhorn_departments;
create policy sindhorn_departments_update on public.sindhorn_departments
for update to authenticated
using ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_employees_select on public.sindhorn_employees;
create policy sindhorn_employees_select on public.sindhorn_employees
for select to authenticated
using (
  ((select auth.uid()) is not null and auth_user_id = (select auth.uid()) and active)
  or (select sindhorn_private.can_manage_people())
);

drop policy if exists sindhorn_employees_insert on public.sindhorn_employees;
create policy sindhorn_employees_insert on public.sindhorn_employees
for insert to authenticated
with check ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_employees_update on public.sindhorn_employees;
create policy sindhorn_employees_update on public.sindhorn_employees
for update to authenticated
using ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.is_super_admin()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_groups_select on public.sindhorn_groups;
create policy sindhorn_groups_select on public.sindhorn_groups
for select to authenticated
using ((select sindhorn_private.can_manage_content()));

drop policy if exists sindhorn_groups_write on public.sindhorn_groups;
create policy sindhorn_groups_write on public.sindhorn_groups
for all to authenticated
using ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_group_members_select on public.sindhorn_group_members;
create policy sindhorn_group_members_select on public.sindhorn_group_members
for select to authenticated
using ((select sindhorn_private.can_manage_content()));

drop policy if exists sindhorn_group_members_write on public.sindhorn_group_members;
create policy sindhorn_group_members_write on public.sindhorn_group_members
for all to authenticated
using ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_broadcasts_select on public.sindhorn_broadcasts;
create policy sindhorn_broadcasts_select on public.sindhorn_broadcasts
for select to authenticated
using (
  (select sindhorn_private.can_manage_content())
  or (select sindhorn_private.broadcast_visible_to_me(id))
);

drop policy if exists sindhorn_broadcasts_insert on public.sindhorn_broadcasts;
create policy sindhorn_broadcasts_insert on public.sindhorn_broadcasts
for insert to authenticated
with check ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_broadcasts_update on public.sindhorn_broadcasts;
create policy sindhorn_broadcasts_update on public.sindhorn_broadcasts
for update to authenticated
using ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_broadcast_targets_select on public.sindhorn_broadcast_targets;
create policy sindhorn_broadcast_targets_select on public.sindhorn_broadcast_targets
for select to authenticated
using ((select sindhorn_private.can_manage_content()));

drop policy if exists sindhorn_broadcast_targets_write on public.sindhorn_broadcast_targets;
create policy sindhorn_broadcast_targets_write on public.sindhorn_broadcast_targets
for all to authenticated
using ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()))
with check ((select sindhorn_private.can_manage_content()) and (select sindhorn_private.has_aal2()));

drop policy if exists sindhorn_broadcast_reads_select on public.sindhorn_broadcast_reads;
create policy sindhorn_broadcast_reads_select on public.sindhorn_broadcast_reads
for select to authenticated
using (employee_id = (select sindhorn_private.current_employee_id()));

drop policy if exists sindhorn_broadcast_reads_insert on public.sindhorn_broadcast_reads;
create policy sindhorn_broadcast_reads_insert on public.sindhorn_broadcast_reads
for insert to authenticated
with check (
  employee_id = (select sindhorn_private.current_employee_id())
  and (select sindhorn_private.broadcast_visible_to_me(broadcast_id))
);

drop policy if exists sindhorn_broadcast_reads_update on public.sindhorn_broadcast_reads;
create policy sindhorn_broadcast_reads_update on public.sindhorn_broadcast_reads
for update to authenticated
using (employee_id = (select sindhorn_private.current_employee_id()))
with check (
  employee_id = (select sindhorn_private.current_employee_id())
  and (select sindhorn_private.broadcast_visible_to_me(broadcast_id))
);

comment on schema sindhorn_private is 'Private Sindhorn Midtown auth/activation/audit helpers; never expose through the Data API.';
comment on table public.sindhorn_employees is 'Pre-provisioned Sindhorn employee directory and authorization source. auth_user_id is bound only after trusted activation.';
comment on table sindhorn_private.activation_codes is 'One-time activation proofs. Store broker-generated hashes only; never store plaintext codes.';
comment on table sindhorn_private.audit_log is 'Append-only privileged-action audit trail; no normal client write/update/delete access.';
comment on table public.sindhorn_broadcasts is 'Central hotel broadcast messages for the authenticated Messages inbox.';
