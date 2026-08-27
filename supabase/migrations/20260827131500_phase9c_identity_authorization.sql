-- Phase 9C — authorize all login methods through the canonical employee identity map.
-- This preserves the legacy auth_user_id path during migration while allowing
-- Microsoft 365 and employee-ID identities to resolve to one employee record.

create or replace function sindhorn_private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.sindhorn_employees e
  where e.active
    and (
      e.auth_user_id = (select auth.uid())
      or exists (
        select 1
        from public.sindhorn_employee_identities i
        where i.employee_id = e.id
          and i.auth_user_id = (select auth.uid())
      )
    )
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
  where e.id = (select sindhorn_private.current_employee_id())
  limit 1
$$;

create or replace function sindhorn_private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select sindhorn_private.current_employee_id()) is not null
$$;

create or replace function sindhorn_private.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sindhorn_private.current_role()) in ('admin','super_admin'), false)
$$;

create or replace function sindhorn_private.can_manage_people()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sindhorn_private.current_role()) in ('admin','super_admin'), false)
$$;

create or replace function sindhorn_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sindhorn_private.current_role()) = 'super_admin', false)
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
      on e.id = (select sindhorn_private.current_employee_id())
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

-- A linked Microsoft identity must be able to read the same employee profile.
drop policy if exists sindhorn_employees_select on public.sindhorn_employees;
create policy sindhorn_employees_select on public.sindhorn_employees
for select to authenticated
using (
  (id = (select sindhorn_private.current_employee_id()) and active)
  or (select sindhorn_private.can_manage_people())
);

-- Employees can inspect their own login methods. Admins can inspect identity
-- metadata for user-management status but cannot mutate identity rows directly.
drop policy if exists sindhorn_employee_identities_select_own on public.sindhorn_employee_identities;
drop policy if exists sindhorn_employee_identities_select on public.sindhorn_employee_identities;
create policy sindhorn_employee_identities_select
on public.sindhorn_employee_identities
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select sindhorn_private.can_manage_people())
);

comment on table public.sindhorn_employee_identities is
  'Trusted mapping from Supabase Auth identities to one canonical Sindhorn employee. Browser clients have read-only RLS access; linking is broker-only.';
