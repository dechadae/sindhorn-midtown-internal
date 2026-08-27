# Phase 9 — Supabase Manual-Code Employee Authentication

Date: 2026-08-27  
Status: APPROVED AND FIRST-LOGIN ACCEPTED

## Final runtime architecture

The Sindhorn Midtown Internal PWA uses a Supabase-only employee authentication path:

`Administrator issues one-time 6-digit code`
`→ employee enters Employee ID + code`
`→ Postgres SECURITY DEFINER RPC validates bcrypt hash / expiry / attempts`
`→ canonical Sindhorn employee is linked to one Supabase Auth user`
`→ Supabase Auth token hash is exchanged for a normal refreshable session`
`→ RLS and Sindhorn role helpers remain authorization authority`

Cloudflare Pages remains the static PWA host. The employee login runtime does **not** depend on a Cloudflare Auth Worker, Brevo, SMS, Turnstile, or Microsoft Entra.

Microsoft 365 identity support remains a future option but is disabled/hidden until appropriate corporate Entra administration is available.

## First-login acceptance

The first physical acceptance login for Employee ID `10639` completed successfully on the Phase 9 branch preview on 2026-08-27.

Post-login database verification confirmed:

- one canonical Sindhorn employee record;
- the employee remained active with `super_admin` role;
- one linked Supabase Auth user;
- one Sindhorn identity row, converted to `login_method=employee_id` / `provider=internal`;
- the one-time code was consumed exactly once with zero failed attempts;
- the Supabase Auth app metadata is bound to the canonical Sindhorn employee;
- a live Supabase Auth session exists.

The obsolete phone-test identity was converted in place rather than duplicated because `sindhorn_employee_identities` intentionally enforces one Sindhorn identity row per Auth user.

## One-time code rules

- six numeric digits;
- generated with cryptographic randomness;
- only a bcrypt-prefixed hash is stored;
- 15-minute expiry;
- single use;
- five failed attempts before temporary lock;
- issuing a new code invalidates the previous unconsumed code for the same purpose;
- codes are issued only through administrator-authorized RPCs;
- after activation, the same mechanism issues recovery codes.

## Invitation / QR fallback

Admin → Users may present the one-time code directly and may also generate a local QR/invitation URL.

The invitation encodes Employee ID and the one-time code in the URL fragment (`#...`). Browser fragments are not transmitted in the HTTP request. The login page reads the fragment, fills the fields, then immediately removes the fragment from the address bar with `history.replaceState`. The employee must still explicitly press **Sign in**.

QR generation is local in the PWA; no third-party QR service receives the code.

## Private employee contacts

`sindhorn_private.employee_contacts` remains private storage for administrator-maintained personal email/mobile data. Browser roles cannot query it directly.

Automated email and SMS login are retired. `email_enabled` and `sms_enabled` default to `false`, and private contacts are exposed only through role-gated administrator RPCs.

## Retired paths

The following are not part of the final employee authentication runtime:

- Brevo transactional email OTP;
- Cloudflare Turnstile for employee login;
- automated SMS OTP;
- Cloudflare Auth Worker activation/OTP endpoints;
- emergency first-admin bootstrap RPC;
- contact-matched login RPC;
- old activation prepare/finalize broker RPCs.

Historical migrations may remain in repository history because they were applied to the shared Supabase project. A later post-acceptance migration explicitly retires obsolete callable surfaces instead of rewriting migration history.

## Admin → Users

The approved Supabase-only admin surface includes:

- create employee;
- edit employee;
- department assignment when departments exist;
- role;
- account type;
- preferred language;
- active/inactive access;
- private personal email/mobile management through secure RPCs;
- first-login/recovery code generation;
- local invitation QR/link generation;
- revoke access and refreshable sessions.

The database remains authoritative for all role checks. Normal `admin` accounts cannot manage `admin`, `super_admin`, or developer accounts where the server rules prohibit it. Self-revocation is blocked.

## Product invariants preserved

- General PWA remains English-first with Thai immediately supporting it; login may honor the employee's preferred language.
- Every font/text treatment uses zero character tracking (`letter-spacing: 0`).
- Messages remains a primary footer destination.
- Phase 8.2 atmosphere, current location, Open-Meteo, AirBKK, Web Push, PWA identity and zero-reinstall behavior are not changed by this authentication decision.

## Release discipline

Phase 9 continues through:

`branch validation → Cloudflare Pages preview → authenticated smoke/acceptance → reconcile newest main → PR → merge → production workflow → production verification`

No production-live claim is valid until the production workflow and production endpoint verification both pass.
