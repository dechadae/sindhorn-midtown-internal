-- Phase 9 — contact-verified realtime OTP foundation.
-- Personal contact details are deliberately isolated from the public employee profile.
-- Only trusted service-role broker code can match an Employee ID + contact pair.

create table if not exists sindhorn_private.employee_contacts (
  employee_id uuid primary key references public.sindhorn_employees(id) on delete cascade,
  personal_email text,
  mobile_e164 text,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_employee_contacts_email_check check (
    personal_email is null or (
      personal_email = lower(btrim(personal_email))
      and length(personal_email) between 3 and 320
      and position('@' in personal_email) > 1
    )
  ),
  constraint sindhorn_employee_contacts_phone_check check (
    mobile_e164 is null or mobile_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint sindhorn_employee_contacts_some_contact_check check (
    personal_email is not null or mobile_e164 is not null
  )
);

create unique index if not exists sindhorn_employee_contacts_email_uniq
  on sindhorn_private.employee_contacts ((lower(personal_email)))
  where personal_email is not null;

create unique index if not exists sindhorn_employee_contacts_phone_uniq
  on sindhorn_private.employee_contacts (mobile_e164)
  where mobile_e164 is not null;

revoke all on sindhorn_private.employee_contacts from public, anon, authenticated;
grant select, insert, update, delete on sindhorn_private.employee_contacts to service_role;

-- Extend the canonical identity map for contact OTP sign-in methods.
alter table public.sindhorn_employee_identities
  drop constraint if exists sindhorn_employee_identities_method_check,
  drop constraint if exists sindhorn_employee_identities_provider_check,
  drop constraint if exists sindhorn_employee_identities_shape_check;

alter table public.sindhorn_employee_identities
  add constraint sindhorn_employee_identities_method_check
    check (login_method in ('employee_id','microsoft365','personal_phone','personal_email')),
  add constraint sindhorn_employee_identities_provider_check
    check (provider in ('internal','azure','phone','email')),
  add constraint sindhorn_employee_identities_shape_check
    check (
      (login_method='employee_id' and provider='internal') or
      (login_method='microsoft365' and provider='azure') or
      (login_method='personal_phone' and provider='phone') or
      (login_method='personal_email' and provider='email')
    );

-- This is the only contact-match primitive exposed to the broker. It returns no
-- row for an unknown employee, inactive employee, disabled channel, or mismatch.
create or replace function public.sindhorn_contact_login_lookup(
  p_employee_number text,
  p_channel text,
  p_contact text
)
returns table(
  employee_id uuid,
  auth_user_id uuid,
  preferred_language text,
  normalized_contact text,
  login_method text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    i.auth_user_id,
    e.preferred_language,
    case when p_channel='sms' then c.mobile_e164 else c.personal_email end,
    case when p_channel='sms' then 'personal_phone' else 'personal_email' end
  from public.sindhorn_employees e
  join sindhorn_private.employee_contacts c on c.employee_id=e.id
  left join public.sindhorn_employee_identities i
    on i.employee_id=e.id
   and i.login_method=case when p_channel='sms' then 'personal_phone' else 'personal_email' end
  where e.active
    and e.employee_number=btrim(p_employee_number)
    and p_channel in ('sms','email')
    and (
      (p_channel='sms' and c.sms_enabled and c.mobile_e164=p_contact)
      or
      (p_channel='email' and c.email_enabled and c.personal_email=lower(btrim(p_contact)))
    )
  limit 1
$$;

revoke all on function public.sindhorn_contact_login_lookup(text,text,text)
from public, anon, authenticated;
grant execute on function public.sindhorn_contact_login_lookup(text,text,text)
to service_role;

comment on table sindhorn_private.employee_contacts is
'Private personal email/mobile contacts used only for contact-matched OTP delivery. Not readable by browser roles.';
comment on function public.sindhorn_contact_login_lookup(text,text,text) is
'Service-role-only exact Employee ID + personal-contact matcher for realtime OTP login.';
