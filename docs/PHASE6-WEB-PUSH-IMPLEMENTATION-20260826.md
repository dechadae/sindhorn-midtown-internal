# Phase 6 Web Push implementation — 26 August 2026

**Status:** implemented on `phase6-web-push`, not yet production-released.

This document records the concrete Phase 6 implementation under the authority of `AGENTS.md`, `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`, `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md` and `docs/NOTIFICATIONS-ARCHITECTURE.md`.

## Architecture

The Phase 6 path is:

```text
AirBKK + Open-Meteo
        ↓
Cloudflare scheduled Worker: sindhorn-midtown-alerts
        ↓
meaningful-change policy + deduplication
        ↓
Web Push / VAPID
        ↓
existing Sindhorn Midtown service worker
        ↓
iOS / Android installed PWA notification
```

The notification runtime remains Cloudflare-native. Supabase is used only for the versioned presentation surface that lets an employee explicitly opt in or out.

## Worker

`worker/src/index.js` implements:

- D1-backed `push_subscriptions` storage;
- D1-backed `monitor_state` for category/severity deduplication;
- `GET /health`;
- `GET /vapid-public-key`;
- `POST /subscribe`;
- `DELETE /subscribe`;
- scheduled AirBKK and Open-Meteo evaluation every ten minutes;
- removal of expired subscriptions after push-service HTTP 404/410;
- VAPID Web Push encryption/signing through `@block65/webcrypto-web-push`.

AirBKK remains authoritative for PM2.5 and Thai AQI. The scheduled backend uses the same preferred station sequence as the app: `114`, `139`, `65`.

Notifications are intentionally sparse. The backend notifies only when:

- air quality worsens across a category boundary into Moderate or worse;
- air quality recovers from Moderate-or-worse to Good/Very good;
- severe weather begins or worsens to a materially higher severity;
- AirBKK remains unavailable for more than one hour.

Small numeric movement inside the same air-quality category does not notify.

## PWA client

`site/push-client.js` is the explicit opt-in controller. It:

- feature-detects Service Worker, PushManager and Notifications APIs;
- never prompts for notification permission on first launch;
- requests permission only after the employee taps the alert control;
- obtains the VAPID public key from the Worker;
- creates a `userVisibleOnly` PushSubscription;
- registers and removes subscriptions through the Worker API;
- preserves denied/unsupported/unconfigured states without blocking the rest of the app.

`site/sw.js` already owned push reception. Phase 6 preserves its `push` and `notificationclick` handlers, adds the client files to the shell cache, and bumps the normal zero-reinstall service-worker cache version.

## Presentation pack

Supabase Pack 35 is staged but intentionally disabled until the backend and production shell are verified. It adds one compact `Environmental alerts / การแจ้งเตือนสภาพแวดล้อม` preference surface to Details.

Pack 35 validation before release:

- 8 files present;
- 8/8 content SHA-256 values valid;
- manifest `appPack` = 35;
- 7/7 declared resources match path, content type and SHA-256;
- alert control and alert CSS present;
- every Pack 35 row remains disabled while Phase 6 is staged.

Pack 34 remains the active known-good presentation pack until the production shell and backend pass.

## Cloudflare deployment gate

The existing GitHub `CLOUDFLARE_API_TOKEN` can deploy the Pages project but currently cannot create or edit Workers. Phase 6 run `32981375775` reached Wrangler successfully and failed at the Workers API with Cloudflare authentication error code `10000`.

The token used by GitHub Actions must therefore include the account permissions required by this phase:

- **Workers Scripts — Edit/Write**;
- **D1 — Edit/Write**;
- **Cloudflare Pages — Edit/Write** (preserve the existing Pages deployment capability).

Recommended diagnostic/read permissions for Wrangler are:

- **User Memberships — Read**;
- **User Details — Read**.

Scope the token to the Sindhorn Cloudflare account rather than all accounts when possible.

Do not store VAPID private material in the repository. The Phase 6 workflow creates stable VAPID secrets in Cloudflare only when they do not already exist.

## Release sequence

The phase is not complete until all of the following occur in order:

1. Phase 6 Pages branch preview passes without changing production.
2. The Cloudflare token has Worker/D1 permissions and the Phase 6 Worker workflow passes.
3. The Worker health endpoint confirms VAPID is configured and D1 is reachable.
4. The branch client is bound to the deployed Worker URL and branch smoke tests pass.
5. Open a PR from `phase6-web-push` to `main`.
6. Merge only after the branch gates pass.
7. Verify the normal production Pages workflow on the merged main commit.
8. Verify the Phase 6 main Worker workflow on the merged main commit.
9. Only then enable Supabase Pack 35.
10. Verify the production Details route can show the opt-in surface without regressing the rest of the app.

Physical notification delivery on at least one installed iOS/iPadOS Home Screen PWA and one installed Android PWA remains a Phase 7 launch-hardening acceptance test.
