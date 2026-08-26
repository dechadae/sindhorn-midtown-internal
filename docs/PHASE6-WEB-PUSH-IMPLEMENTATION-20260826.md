# Phase 6 Web Push Release — 26 August 2026

This document records the current Phase 6 release state. It is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md` and `docs/NOTIFICATIONS-ARCHITECTURE.md`.

## Current verified state

- Production Pages already contains the current-location weather shell and service-worker update.
- The Cloudflare Worker `sindhorn-midtown-alerts` is live at `https://sindhorn-midtown-alerts.decha-dae.workers.dev`.
- `/health` returns healthy AirBKK and Open-Meteo evaluation state and confirms VAPID is configured.
- Production-origin CORS for `/vapid-public-key` is valid; an unapproved origin is rejected by `/subscribe` with HTTP 403.
- The existing service worker already contains `push` and `notificationclick` handlers.
- Supabase UI Pack 36 is the current production presentation pack.
- Supabase UI Pack 37 is staged disabled. It is derived from Pack 36, preserves the current-location weather line, and adds the explicit Environmental Alerts control to Details. Its manifest has 7/7 matching resource hashes.

## Superseded branch

The historical `phase6-web-push` branch diverged from current `main` after the location work. Do not merge that branch directly.

`phase6-web-push-release` is the clean release branch based on current `main`. It ports only the Web Push client/backend source required for Phase 6 and therefore preserves the current-location implementation.

## Release candidate contents

- `site/push-config.js`
- `site/push-client.js`
- `site/index.html` loading the push client
- service-worker cache update for push client/config while retaining push/click handlers
- `worker/src/index.js`
- `worker/package.json`
- `worker/wrangler.jsonc`
- release validation workflow
- notification architecture documentation

The client never prompts for notifications on launch. Subscription is possible only through the explicit Details-route button.

## Release gate

1. Validate JS syntax and Worker bundle.
2. Verify live Worker health, VAPID public key and CORS.
3. Deploy and smoke-test the `phase6-web-push-release` Pages preview.
4. Merge the clean release branch into `main` only after the preview gate passes.
5. Verify production Pages and production Worker after merge.
6. Enable Supabase Pack 37 only after the production shell can load `push-client.js` and communicate with the Worker.
7. Perform native-device acceptance on installed Android and iOS/iPadOS PWAs. This is the first point that genuinely requires human device interaction.

Do not enable Pack 35. Pack 36 is already production-active and the bootstrap rejects pack downgrades; Pack 37 is the correct Phase 6 presentation release.
