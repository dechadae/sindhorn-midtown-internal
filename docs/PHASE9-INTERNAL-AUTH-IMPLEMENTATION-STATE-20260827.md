# Phase 9 — Internal Auth + Admin Implementation State

Date: 2026-08-27
Branch: `phase9-internal-auth-broadcast`
Status: PREVIEW READY / MICROSOFT ENTRA CONFIGURATION REQUIRED

## Implemented

- Dedicated Sindhorn employee directory and authorization model in Supabase.
- Employee ID + one-time activation/recovery code login architecture.
- Microsoft 365 dual-login architecture for pre-provisioned work-email employees.
- Multi-identity map so both login methods resolve to one canonical employee record.
- Server-enforced roles and RLS.
- Trusted Cloudflare Auth/Admin Worker with production and preview configurations.
- Preview Worker secrets configured and runtime health verified.
- Identity-aware authorization helpers and broadcast visibility.
- Service-role-only employee create/update RPCs with authenticated admin actor audit attribution.
- Protected admin APIs for listing users, creating/updating users and issuing activation codes.
- Bilingual standalone `/login.html` employee sign-in UI.
- Standalone protected `/admin.html` employee-management UI.
- Isolated Cloudflare Pages Phase 9 branch preview and smoke-test workflow.
- Initial canonical super-admin directory profile provisioned in Supabase.

## Initial administrator

- Employee ID: `10639`
- Display name: `Decha Kokaew`
- Work email: `decha.kokaew@ihg.com`
- Preferred language: English
- Account type: developer
- Authorization role: super_admin
- Status: active
- Authentication identities: none yet

The profile does not gain an authentication identity until the employee signs in successfully. The preferred first bootstrap is Microsoft 365 because the work email is already provisioned.

## Preview

Pages preview alias:

`https://phase9-internal-auth-broadca.sindhorn-midtown-internal.pages.dev`

Review surfaces:

- `/login.html`
- `/admin.html`

Auth Worker preview:

`https://sindhorn-midtown-auth-preview.decha-dae.workers.dev`

The Pages preview smoke test and Auth Worker health/configuration checks pass.

## Security invariants

- `@ihg.com` ownership alone never grants access.
- Microsoft 365 identity linking requires a verified Azure identity whose normalized email matches an already-provisioned active Sindhorn employee `work_email`.
- Employee roles and status are server-authoritative in Supabase.
- Browser clients cannot insert/update/delete authentication identity mappings.
- Browser clients cannot execute privileged employee-management RPCs.
- Service-role broker access to the identity map is explicit.
- Admin writes require an authenticated admin/super-admin session and AAL2.
- Ordinary admins cannot manage admin/super-admin or developer accounts.
- Super-admin cannot remove their own admin access through the ordinary update flow.
- Secrets remain Worker-side only.

## Current human configuration gate

Microsoft Entra + Supabase Azure provider configuration is required before Microsoft 365 login can be accepted.

Microsoft Entra app registration should be single-tenant for the hotel/corporate directory unless corporate identity policy requires otherwise.

Supabase OAuth callback URI to register in Entra:

`https://sjpvhgxacsiorrtijqua.supabase.co/auth/v1/callback`

Supabase Auth Redirect URL required for current Phase 9 preview:

`https://phase9-internal-auth-broadca.sindhorn-midtown-internal.pages.dev/login.html`

Production redirect is not required for the preview acceptance gate and should be enabled when Phase 9 is approved for merge.

## Next after Entra configuration

1. Sign in to the Phase 9 preview with the pre-provisioned Microsoft 365 account.
2. Verify the Worker links the Azure identity to employee `10639` rather than creating a second employee profile.
3. Verify `/admin.html` reads the single canonical employee record.
4. Add the admin MFA/AAL2 enrollment/challenge surface.
5. Verify employee create/update and activation-code issuance with AAL2.
6. Add server-backed Messages/broadcast admin implementation.
7. Rebase on latest `main` after Phase 8.2 lands, inspect shared-file conflicts, then proceed through PR/production release gates.
