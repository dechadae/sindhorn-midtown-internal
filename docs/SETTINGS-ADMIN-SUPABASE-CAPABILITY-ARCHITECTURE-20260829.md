# Sindhorn Midtown Internal — Unified Settings/Admin + Supabase Capability Architecture

**Status:** Approved product architecture  
**Date:** 29 August 2026

## Product decision

The existing `/account` and `/admin` experiences are to be consolidated into one authenticated in-shell **Settings** experience.

The Settings redesign uses the proven F&B visual/component language: persistent WebGL atmosphere, dark Vignette glass surfaces, Sorbet accent, restrained type hierarchy, thin dividers, compact fact grids, shared shell footers, and prepaint rendering that avoids layout shifts.

The implementation rule is explicit: **reuse/clone existing working app components before creating new equivalents.** Visual similarity by approximation is not sufficient when a proven component already exists.

## Hard architecture invariant

**Routine Settings/Admin operations must not require a Cloudflare redeploy.**

The split is:

- **Supabase = application authority**
  - employee profile and account type
  - roles
  - capability definitions and grants
  - effective capability resolution
  - Settings section manifest/configuration
  - employee, department and group data
  - F&B read/write authorization
  - broadcasts
  - audit data
  - system settings and feature flags
  - server-side authorization for every privileged mutation
- **GitHub / Cloudflare Pages = reusable renderer**
  - persistent SPA shell
  - WebGL atmosphere
  - generic Settings/F&B components
  - visual presentation and interaction
  - route mounting
  - client adapters that consume Supabase manifests/data

After the generic renderer is deployed, role/capability/section/configuration changes should be achievable in Supabase alone.

A Cloudflare deploy is required only when the renderer itself needs a new interaction/component type that does not already exist.

## Canonical capability model

Do not scatter role checks across the client.

The client consumes effective capabilities from Supabase. Supabase is also the enforcement boundary for writes.

Initial product policy:

- `account_type = developer` => full administrative capabilities
- `role = super_admin` => full administrative capabilities
- all other active authenticated employees => standard employee capabilities

Initial standard employee behavior:

- can access Settings/account information
- can read F&B
- cannot mutate F&B
- cannot manage employees/departments/groups/broadcasts/system/audit unless later granted a capability

Initial privileged capability set:

- `settings.read`
- `account.read`
- `fnb.read`
- `fnb.edit`
- `people.read`
- `people.manage`
- `departments.manage`
- `groups.manage`
- `broadcasts.manage`
- `audit.read`
- `system.manage`

The model must support adding future roles without changing Cloudflare code. Examples: F&B editor, communications admin, department admin, auditor, manager-scoped permissions.

## Server-side enforcement

UI hiding is never authorization.

Every privileged RPC/write path must call a Supabase capability check. Direct browser/RPC attempts by an employee without the capability must fail even if the user manually invokes the endpoint.

Known legacy rules to migrate:

- employee-admin RPCs currently depend on old `admin/super_admin` role checks;
- F&B artwork status write currently has a hard-coded employee-number authorization exception.

These are transitional debt and must be replaced by the central capability resolver.

## Supabase configuration model

Supabase should expose an authenticated `settings_manifest` RPC containing:

- profile summary
- effective capabilities
- enabled Settings sections
- section labels/order
- renderer/component identifiers
- safe non-secret section configuration
- manifest/config version

The manifest is presentation configuration, not executable code.

Settings sections are data-driven and capability-gated. Initial logical sections:

1. **Account** — standard employee account/preferences/security/status/sign-out
2. **People** — employees + departments + groups; requires privileged capability
3. **Comms** — broadcasts; requires privileged capability
4. **System** — audit + administrative settings; requires privileged capability

An ordinary employee should not see empty privileged tabs.

## Unified Settings route

Create `/settings` as the canonical destination.

- global footer `Settings` => `/settings`
- header/avatar => `/settings`
- `/account` => compatibility alias/redirect into Settings Account
- `/admin` => compatibility alias/redirect into the first permitted privileged Settings section
- no standalone authenticated HTML document
- persistent shell/header/footer/atmosphere/auth session remain mounted

## Settings visual system

Settings must port the existing F&B design system rather than invent a separate admin aesthetic:

- atmosphere visible through route
- dark Twilight glass
- Sorbet accents
- same glass blur/saturation recipe
- same compact control family where applicable
- thin dividers
- lightweight large page title
- compact uppercase section labels
- 4-column shell secondary rail for privileged Settings: `Account / People / Comms / System`
- mobile-first
- desktop expands the same composition rather than switching to a separate dashboard aesthetic

Remove the current duplicated hotel-logo admin header, large cream account sheet, large cream admin panel treatment, `App` button, and separate Admin link mental model.

## Account section

Use an F&B-style fact grid:

- Employee ID
- Role
- Preferred language
- Account status
- Account type when relevant
- Permanent-code/security status

Sign out is a quiet secondary action near the end of Account.

## People section

Combine Employees, Departments and Groups.

Employee rows/cards use compact glass cards. Whole-card interaction opens the editor.

Search and Add employee use existing app control geometry.

The current business/auth RPC logic should be preserved while authorization is migrated to capability checks.

## Employee editor

Use one reusable mobile-first glass sheet/dialog component with grouped sections:

- Employee — ID, display name, work email
- Organisation — department, role, account type
- Preferences & access — language, active state
- Private contact — personal email, mobile
- Security — issue first-login/recovery code, revoke access/sessions

Dangerous actions remain visually separated.

The one-time-code/QR flow reuses the same sheet component and preserves current security behavior.

## F&B authorization

F&B remains one page for everyone.

Standard employee:

- full read-only promotion experience
- Brief/Copy/Artwork views
- artwork-folder links where already permitted
- Share
- no mutation controls

Developer/Super Admin:

- same F&B page
- editing/management controls exposed by `fnb.edit`

No separate F&B admin application.

## No-layout-shift invariant

Settings follows the same prepaint rule established for F&B:

- profile resolves before reveal
- manifest/capabilities resolve before privileged navigation appears
- controls reserve their final geometry
- no late buttons/timestamps/tabs causing visible reflow
- dialogs/sheets initialize without moving visible content

## Migration stages

### Stage A — Supabase authority + Settings shell

1. add capability definitions/grants and Settings section configuration in Supabase;
2. add effective-capability resolver and authenticated Settings manifest RPC;
3. migrate privileged F&B and admin authorization to capability checks without weakening security;
4. create generic `/settings` in-shell renderer using F&B component language;
5. migrate current Account presentation into Settings;
6. preserve `/account` and `/admin` as compatibility aliases.

### Stage B — Admin consolidation

1. migrate Employees into People;
2. bring Departments/Groups into the same section;
3. migrate employee editor and invite/QR flow into glass sheets;
4. implement capability-driven secondary Settings rail;
5. expose unfinished sections only when they have real data/functionality.

### Stage C — F&B capability integration

1. audit every F&B mutation path;
2. enforce `fnb.edit` server-side;
3. add privileged editing controls to the same F&B interface;
4. verify standard employee read-only behavior and direct-RPC rejection.

## Release discipline

Executable renderer work:

`dedicated GitHub branch -> deterministic validation -> Cloudflare branch preview -> mobile review -> PR -> merge -> production verification`

Routine Supabase role/capability/config changes after release do not require Cloudflare deployment.

Database migrations that establish or change authorization must be additive, reviewed, tested against current authenticated behavior, and must never expose privileged data to the publishable client key.

## Acceptance criteria

The redesign is complete only when:

- Settings and Admin feel like the same product as F&B;
- Account/Admin are one Settings experience;
- Developer or Super Admin receives full admin capabilities;
- standard employees receive normal Settings + read-only F&B;
- Supabase, not Cloudflare/client JS, is the capability authority;
- direct unauthorized writes are rejected server-side;
- future role/capability changes can be made in Supabase without redeploying Cloudflare;
- no authenticated navigation reloads the document;
- no visible content jumps during capability/profile load;
- existing auth/session/private-contact protections remain intact.
