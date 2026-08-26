# Phase 6 Web Push Release — 26 August 2026

This document records the current Phase 6 release state. It is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md` and `docs/NOTIFICATIONS-ARCHITECTURE.md`.

## Current verified state

- The clean Web Push release is merged to `main` and deployed to production.
- Production Pages contains the current-location weather shell, `/push-client.js`, and service-worker v19 with `push` and `notificationclick` handlers.
- The Cloudflare Worker `sindhorn-midtown-alerts` is live at `https://sindhorn-midtown-alerts.decha-dae.workers.dev`.
- `/health` confirms VAPID is configured and scheduled AirBKK + Open-Meteo evaluation is healthy.
- Production-origin CORS for `/vapid-public-key` is valid; unapproved subscription origins are rejected.
- The push client does not call `Notification.requestPermission()` on launch. Browser subscription is entered only from the explicit Environmental Alerts action.
- Supabase UI Pack 37 is now the production presentation pack. Pack 36 is disabled.
- Pack 37 preserves the Today current-location weather line and adds the Environmental Alerts control to Details.
- Pack 37 declares seven presentation resources and all seven resource metadata hashes match the active rows.

## Superseded branch

The historical `phase6-web-push` branch diverged from current `main` after the location work and must not be used as a release source.

The clean release path was `phase6-web-push-release`, based on the then-current production main line. PR #35 merged that release into `main`.

## Production release contents

- `site/push-config.js`
- `site/push-client.js`
- `site/index.html` loading the push client
- service-worker cache update for push client/config while retaining push/click handlers
- `worker/src/index.js`
- `worker/package.json`
- `worker/wrangler.jsonc`
- release validation workflow
- notification architecture documentation

## Completed automated gates

1. JavaScript and Worker source validation.
2. Worker bundle dry-run.
3. Live Worker health, VAPID and CORS verification.
4. Cloudflare Pages branch preview deployment and smoke test.
5. Merge of the clean release into `main`.
6. Production Pages deployment and production smoke verification.
7. Independent production HTTP verification that current-location rendering and Web Push coexist.
8. Activation of Supabase Pack 37 after the production shell was proven capable of loading the push client.

## Remaining Phase 6 acceptance

Only native-device Web Push acceptance remains:

- Android installed PWA permission/subscription/delivery/deep-link test;
- iOS/iPadOS 16.4+ Home Screen PWA permission/subscription/delivery/deep-link test;
- confirmation that a normal shell upgrade does not require reinstalling the PWA or re-enabling notifications.

Those checks require real operating-system notification behavior and are tracked in `docs/PHASE7-LAUNCH-HARDENING-20260827.md`.
