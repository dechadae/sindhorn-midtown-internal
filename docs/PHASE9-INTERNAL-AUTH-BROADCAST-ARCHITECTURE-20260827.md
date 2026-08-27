# Phase 9 — Internal Employee Auth + Broadcast Architecture

**Status:** Approved architecture / Phase 9A security foundation applied to canonical Supabase  
**Date:** 27 August 2026  
**Repository:** `dechadae/sindhorn-midtown-internal`  
**Production:** `https://sindhorn-midtown-internal.pages.dev/`  
**Supabase:** `sjpvhgxacsiorrtijqua`

## 1. Product direction

Sindhorn Midtown Internal is evolving from an environmental PWA into a lightweight internal hotel employee platform. Environmental reporting remains a primary product capability, while authenticated employee information, hotel broadcasts and future internal modules are added behind a dedicated authorization boundary.

Phase 9 must preserve the installed PWA identity, current environmental experience, Web Push subscription continuity, Messages footer destination and zero-reinstall rule.

Another development track may modify Phase 8.2 seasonal atmosphere/cloud rendering in parallel. Phase 9 must avoid atmosphere-specific code and reconcile latest `main` before any shared-shell merge.

## 2. Human-friendly authentication

### Normal employee onboarding

The intended first-use flow is:

```text
pre-provisioned employee record
→ Employee ID + short one-time activation proof
→ trusted activation broker verifies proof
→ bind/create confirmed Supabase Auth identity
→ authenticated app session
→ offer passkey / device biometric convenience where supported
→ remain signed in for ordinary daily use
```

Do not use:

- a hotel-wide shared password;
- employee-number-only authentication;
- a permanent short PIN shared with the server;
- client-side role flags as authority;
- plaintext activation codes stored in Supabase.

The login/onboarding UI may place the employee's preferred language first when necessary for comprehension. This is an operational exception to the general English-first visual hierarchy, not a change to the application's bilingual policy.

### Passkeys

Supabase Passkey Auth is currently an experimental feature. It is appropriate as a post-activation convenience but is not the only recovery/bootstrap path.

Important current constraints:

- the user must already be a confirmed, non-anonymous Supabase Auth user before a passkey can be registered;
- WebAuthn depends on stable RP ID/origin configuration;
- SSO-authenticated users currently cannot register Supabase passkeys;
- a fallback activation/recovery path is mandatory while the feature is experimental.

Do not change the production origin/PWA identity as part of passkey rollout.

### Managers and administrators

Prefer existing hotel work-account identity/SSO when a suitable Microsoft 365, Google Workspace or other IdP is confirmed. Otherwise use strong Supabase Auth with MFA.

Privileged mutations require Authenticator Assurance Level 2 (`aal2`) at the database policy boundary, not only in the frontend.

## 3. Authorization roles

Canonical Sindhorn roles:

- `employee`
- `supervisor`
- `manager`
- `admin`
- `super_admin`

The database is authoritative. Never infer authorization from localStorage, JavaScript state, editable user metadata, URL parameters or department values supplied by the client.

An employee with `active=false` must lose access through RLS even if a previously issued access token has not yet expired.

## 4. Shared Supabase isolation

The canonical Supabase project is shared with other systems and already contains generic tables/functions such as `app_users`, `internal_messages`, `chat_messages`, `is_admin()` and `get_my_role()`.

Sindhorn must **not** reuse those generic authorization objects. They have unrelated role vocabularies and policies and would create authorization bleed between applications.

Phase 9 therefore uses:

- public API-facing tables prefixed `sindhorn_`;
- an unexposed `sindhorn_private` schema for activation secrets, audit records and SECURITY DEFINER authorization helpers.

## 5. Phase 9A canonical data model

### `public.sindhorn_departments`

Department metadata used for targeting and future internal modules.

### `public.sindhorn_employees`

Pre-provisioned employee directory and authorization source.

Important fields:

- employee number;
- display name;
- department;
- role;
- active/inactive state;
- preferred language;
- optional bound `auth_user_id`;
- activation/deactivation timestamps.

The employee row may exist before any Supabase Auth account is bound.

### `public.sindhorn_groups` / `public.sindhorn_group_members`

Optional explicit broadcast groups for cases that do not map cleanly to department or role.

### `public.sindhorn_broadcasts`

Central durable hotel message record.

Supported categories:

- hotel news;
- operations;
- safety;
- HR;
- event;
- environment.

Supported lifecycle:

```text
draft → scheduled/published → revoked
```

Revoked broadcasts are immutable. Published broadcasts cannot return to draft. Actor/timing fields are server-stamped by a database trigger.

### `public.sindhorn_broadcast_targets`

Normalized audience targeting. One target row represents one of:

- everyone;
- department;
- role;
- group;
- employee.

A client cannot turn arbitrary JSON into authorization. Target shape is constrained by the database.

### `public.sindhorn_broadcast_reads`

Cross-device read state keyed to the employee identity, not merely the browser installation.

### `sindhorn_private.activation_codes`

Trusted-server-only activation proofs.

Only a broker-generated hash is stored. Plaintext activation codes are never stored in Supabase and the table has no normal `anon` or `authenticated` table privileges.

### `sindhorn_private.audit_log`

Append-only privileged mutation evidence containing actor, action, entity, before/after state and timestamp. Normal authenticated users have no direct table privileges.

## 6. RLS / grants model

Defense in depth is mandatory:

```text
Postgres grants
+ RLS
+ private SECURITY DEFINER helpers
+ AAL2 for privileged writes
```

Rules established by Phase 9A:

- `anon` has no privileges on Phase 9 internal tables;
- only a bound, active Sindhorn employee satisfies normal access helpers;
- employees can read only their own employee profile;
- content administrators can inspect broadcast administration data;
- super admins with AAL2 can modify employee/department records through the Data API;
- admins/super admins with AAL2 can mutate broadcast/group/target records;
- employees can only create/update their own read receipts for broadcasts actually visible to them;
- activation codes and audit records remain private/server-only;
- generic shared-project `app_users` authorization is never consulted.

All public Phase 9 tables have RLS enabled.

## 7. Broadcast visibility

A broadcast is visible to an employee only when all of these are true:

1. employee is bound to the authenticated Supabase user and active;
2. broadcast is scheduled/published;
3. `publish_at` has arrived;
4. message has not expired;
5. at least one normalized target matches the employee:
   - everyone;
   - department;
   - role;
   - group membership;
   - employee identity.

This decision is server-enforced by a private SECURITY DEFINER helper used by RLS.

## 8. Messages evolution

The current `/messages` route remains intact during Phase 9A. Its existing IndexedDB notification history continues working.

Phase 9D will merge two logical streams:

```text
server-backed hotel broadcasts
+ existing environmental Web Push history
→ one chronological Messages inbox
```

Server broadcasts survive missed push delivery and synchronize across authenticated devices. Environmental notifications may continue using local history where appropriate.

## 9. Lock-screen privacy

Broadcasts have a `sensitive` flag.

Normal push may expose bilingual title/body on the device lock screen.

Sensitive push must use a generic payload such as:

**New internal message**  
**มีข้อความภายในใหม่**

The authenticated Messages route reveals the full content.

## 10. Account-aware Web Push

Existing Cloudflare D1 push subscriptions are currently device-only. Do not break them during auth rollout.

Phase 9C will add authenticated association:

```text
Supabase employee/auth identity
→ installed device
→ existing Web Push subscription
```

The server must verify the Supabase session before associating a subscription. Department/role targeting comes from the canonical employee record, never from client-submitted role strings.

Existing environmental alert delivery remains functional throughout migration.

## 11. Admin Broadcast Console

A later protected `/admin` interface will provide:

```text
Draft
→ Preview
→ Send test to myself
→ Schedule / Publish
→ Revoke / Expire
```

Fields include EN/TH title/body, category, audience, priority, schedule/expiry, push on/off, sensitive on/off and pinning.

The admin UI is not an authorization boundary. Database/server authorization remains authoritative.

## 12. Activation broker

The employee ID + activation code cannot be verified directly from browser SQL because the activation table is deliberately private.

Phase 9B will implement a trusted activation broker that:

1. rate-limits activation attempts;
2. verifies employee ID + hashed one-time code;
3. verifies employee is active and not already improperly bound;
4. creates/binds a confirmed Supabase Auth identity through server-side admin capabilities;
5. establishes a safe one-time bootstrap path to an authenticated session;
6. consumes/revokes the activation proof atomically;
7. records the employee binding/activation in the audit trail;
8. then offers passkey enrollment when supported.

The exact bootstrap credential mechanism must avoid permanent synthetic passwords exposed to users. Passkey remains optional/fallback-aware until Supabase's experimental implementation is mature enough to be the primary sign-in method.

## 13. Future internal modules

The role/department/group model is intended to support later authenticated modules without redesigning identity:

- SOP/reference;
- emergency contacts;
- staff events;
- shuttle/cafeteria information;
- directory;
- maintenance notices;
- training;
- forms.

Do not add these modules during the auth/broadcast foundation. A future More / เพิ่มเติม hub is preferred over indefinitely adding footer tabs. Messages remains a primary footer destination.

## 14. Phase sequence

### Phase 9A — security foundation

- dedicated Sindhorn schema/table isolation;
- employee/role/department model;
- normalized broadcast targeting;
- activation-code private store;
- immutable audit store;
- default-deny grants and RLS;
- AAL2 privileged-write policies.

**Status: applied and validated on canonical Supabase. No employee/broadcast/activation data was inserted.**

### Phase 9B — login/onboarding

- trusted activation broker;
- employee activation UX;
- persistent Supabase Auth session;
- optional passkey enrollment;
- recovery/fallback path;
- admin MFA flow.

### Phase 9C — account-aware push

- JWT-verified device association;
- preserve existing environmental subscriptions;
- targeted broadcast delivery.

### Phase 9D — server-backed Messages

- merge durable broadcasts with notification history;
- cross-device read state;
- offline cache;
- unread badge parity.

### Phase 9E — admin broadcast console

- protected `/admin`;
- draft/preview/test/schedule/publish/revoke;
- audience selection;
- sensitive lock-screen mode;
- audit review.

### Phase 9F — internal-module framework

- secure extensibility and More hub architecture only as required.

## 15. Parallel-development rule

Phase 8.2 atmosphere development is occurring separately. Before Phase 9 touches shared shell files or opens a merge PR:

1. fetch newest `main`;
2. reconcile Phase 8.2 changes;
3. do not overwrite atmosphere code;
4. keep shared-file modifications minimal;
5. re-run PWA/notification regression gates.

Phase 9A intentionally changes no production shell/UI files.
