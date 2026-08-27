# Phase 9 — Free First-Login Email OTP Decision

Date: 2026-08-27
Status: APPROVED PRODUCT DECISION

## Final first-login model

Primary first login is free email OTP:

`Employee ID + matching personal email -> Cloudflare Auth Worker -> private contact match -> Brevo transactional email -> 6-digit OTP -> verified Supabase session`

Fallback remains an administrator-generated one-time invitation/QR code for employees who cannot use personal email.

Automated SMS is not part of the normal first-login path because carrier delivery is paid. Microsoft 365 remains future-ready but dormant until corporate Entra access exists.

## Security invariants

- Personal email is stored only in `sindhorn_private.employee_contacts` and is not exposed to browser roles.
- Unknown Employee ID / email combinations receive the same neutral response as a valid combination.
- OTP is generated cryptographically by the trusted Auth Worker.
- Plaintext OTP is never stored. D1 stores only an HMAC derived from `ACTIVATION_PEPPER`.
- OTP validity: 5 minutes.
- OTP verification attempts: maximum 5 per issued code.
- Request cooldown: 60 seconds for the same employee/contact challenge.
- Per-IP + employee request throttling remains in D1.
- A new OTP invalidates the prior OTP for that employee/contact.
- Successful OTP is single-use.
- Cloudflare Turnstile protects the Send Code action; production must use a real sitekey/secret pair and server-side Siteverify validation.
- Preview uses Cloudflare's official dummy Turnstile keys only; production must never use dummy keys.
- Brevo API key remains Worker-side only.
- Brevo sender address must be verified in Brevo.
- Supabase service/secret key remains Worker-side only.

## Supabase session handoff

Brevo is only the OTP delivery provider. It does not become the identity authority.

After OTP verification, the broker resolves/creates a dedicated `personal_email` Supabase Auth identity mapped to the canonical `sindhorn_employees` record. The broker then creates a one-use Supabase magic-link token without sending a Supabase email. The browser exchanges that token through Supabase Auth and receives the normal refreshable authenticated session.

This keeps authorization anchored to Supabase RLS while avoiding global Supabase SMTP configuration in the shared project.

## Privacy

Personal email is used only for authentication/recovery delivery. It must not be copied into the public employee profile or returned from the employee directory API. Identity metadata should use a non-reversible contact fingerprint instead of storing the personal address.

## Delivery provider

Brevo transactional API endpoint:

`POST https://api.brevo.com/v3/smtp/email`

Required Worker configuration:

- `BREVO_API_KEY` — encrypted Worker secret
- `BREVO_SENDER_EMAIL` — verified Brevo sender address
- `BREVO_SENDER_NAME` — non-secret display name, default `Sindhorn Midtown Internal`

## Turnstile

Production requires:

- public sitekey in the PWA public auth config
- `TURNSTILE_SECRET_KEY` as an encrypted Worker secret

Preview may use Cloudflare's documented always-pass dummy test pair for automated acceptance only.

## Employee experience

1. Enter Employee ID.
2. Enter personal email.
3. Complete Turnstile check.
4. Tap **Send code**.
5. Receive a 6-digit code by email.
6. Enter code within 5 minutes.
7. App establishes the normal Supabase session and keeps the employee signed in.

The app never reveals whether the Employee ID, email, or both were the mismatch.

## Fallback

`Use an invitation code instead` remains collapsed below the email OTP flow. This supports employees without personal email and controlled recovery while the email delivery service is unavailable.

## Future options

- Automated SMS can be enabled later as a paid optional channel without redesigning the employee directory.
- Microsoft 365 can be enabled later after corporate Entra configuration.
- Passkey enrollment remains a later convenience/security enhancement after successful first activation.
