# Phase 9 — Dual Login and Admin Identity Decision

Date: 2026-08-27
Status: APPROVED

## Product decision

Sindhorn Midtown Internal will support two employee login paths where a hotel work email has been provisioned:

1. Employee ID + one-time activation/recovery code.
2. Microsoft 365 sign-in through the employee's pre-provisioned hotel work email.

Employees without a provisioned hotel work email use the Employee ID path only.

Both login methods resolve to one canonical `public.sindhorn_employees` record. Roles, department membership, broadcast access, read state and all authorization are attached to the employee record, not to the login method.

## Identity model

`public.sindhorn_employees` is the canonical staff directory record and now includes:

- `employee_number`
- `display_name`
- `work_email` (optional, normalized lowercase, unique case-insensitively)
- `account_type`
- `department_id`
- `role`
- `active`
- `preferred_language`

`public.sindhorn_employee_identities` maps one employee to one or more authentication identities. Supported login methods are initially:

- `employee_id` / provider `internal`
- `microsoft365` / provider `azure`

The identity table allows a staff member to use either login method without duplicating their hotel employee profile or broadcast state.

## Security rules

- Possessing an `@ihg.com` address alone does not grant access.
- Microsoft 365 login is accepted only when the verified Microsoft identity matches a work email already provisioned on an active Sindhorn employee record.
- Roles are never inferred from email domain, client storage or OAuth claims alone.
- `super_admin`, `admin`, department and employee status remain server-authoritative in Supabase.
- Authentication identities may not be inserted, updated or deleted directly by ordinary authenticated clients.
- Microsoft identities must be linked through the trusted Auth/Admin broker after provider verification.
- Employee-ID activation remains rate-limited, one-time-code based and broker mediated.

## First administrator

The first canonical administrator profile is pre-provisioned directly in Supabase so the Admin console can subsequently become the normal user-management interface.

Current initial profile:

- Employee ID: 10639
- Display name: Decha Kokaew
- Work email: decha.kokaew@ihg.com
- Preferred language: English
- Account type: developer
- Authorization role: super_admin

The profile is currently a staff-directory record only until an authentication identity is linked. The preferred bootstrap path is Microsoft 365 sign-in against the pre-provisioned work email, followed by trusted broker linking to the existing employee record. Once authenticated, this super-admin can manage employees and issue activation codes through `/admin`.

## Admin console direction

`/admin` becomes the operational management surface for:

- Users
- Departments & Groups
- Broadcasts
- Audit Log
- Settings

Normal user-management actions should not require direct Supabase dashboard access after bootstrap.

## Supersession

This decision supersedes any Phase 9 assumption that one `auth_user_id` stored directly on `sindhorn_employees` is sufficient for all future login methods. The existing column may remain temporarily for migration compatibility, but the multi-identity mapping is the target authorization architecture for dual login.
