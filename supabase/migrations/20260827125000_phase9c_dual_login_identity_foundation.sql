-- Phase 9C — dual login identity foundation
-- Employees with a provisioned hotel work email may authenticate through
-- Microsoft 365 in addition to the employee-ID activation flow.
-- Authorization remains anchored to the canonical Sindhorn employee record.

alter table public.sindhorn_employees
  add column if not exists work_email text,
  add column if not exists account_type text not null default 'employee';

alter table public.sindhorn_employees
  drop constraint if exists sindhorn_employees_account_type_check;

alter table public.sindhorn_employees
  add constraint sindhorn_employees_account_type_check
  check (account_type in ('employee','developer','contractor','service'));

alter table public.sindhorn_employees
  drop constraint if exists sindhorn_employees_work_email_check;

alter table public.sindhorn_employees
  add constraint sindhorn_employees_work_email_check
  check (
    work_email is null or (
      work_email = lower(btrim(work_email))
      and length(work_email) between 3 and 320
      and position('@' in work_email) > 1
    )
  );

create unique index if not exists sindhorn_employees_work_email_uniq
  on public.sindhorn_employees ((lower(work_email)))
  where work_email is not null;

create table if not exists public.sindhorn_employee_identities (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.sindhorn_employees(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  login_method text not null,
  provider text not null,
  provider_subject text,
  email text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint sindhorn_employee_identities_method_check
    check (login_method in ('employee_id','microsoft365')),
  constraint sindhorn_employee_identities_provider_check
    check (provider in ('internal','azure')),
  constraint sindhorn_employee_identities_shape_check
    check (
      (login_method='employee_id' and provider='internal') or
      (login_method='microsoft365' and provider='azure')
    ),
  unique(employee_id, login_method)
);

create index if not exists sindhorn_employee_identities_employee_idx
  on public.sindhorn_employee_identities(employee_id);
create index if not exists sindhorn_employee_identities_email_idx
  on public.sindhorn_employee_identities((lower(email)))
  where email is not null;

alter table public.sindhorn_employee_identities enable row level security;
revoke all on public.sindhorn_employee_identities from anon;
revoke insert, update, delete on public.sindhorn_employee_identities from authenticated;
grant select on public.sindhorn_employee_identities to authenticated;

create policy sindhorn_employee_identities_select_own
on public.sindhorn_employee_identities
for select
to authenticated
using (auth_user_id = (select auth.uid()));
