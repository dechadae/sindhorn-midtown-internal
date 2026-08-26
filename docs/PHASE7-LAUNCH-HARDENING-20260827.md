# Phase 7 Launch Hardening — 27 August 2026

This document records the launch-hardening state after the clean Phase 6 Web Push production release. It is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Production state entering Phase 7

- Production origin remains `https://sindhorn-midtown-internal.pages.dev`.
- PWA identity is frozen as `id: /`, `start_url: /`, `scope: /`, `display: standalone`.
- Shell version is 16 and the fallback presentation pack requires shell 16.
- Service worker version is `sindhorn-midtown-internal-pwa-v19-web-push-location-fixtures-current-location` and remains registered at root scope.
- Production contains the current-location weather renderer, Web Push client, push handler and notification-click deep-link handler.
- Cloudflare alert Worker health confirms VAPID configuration plus successful AirBKK and Open-Meteo scheduled evaluation.
- Supabase UI Pack 37 is production-active. Pack 36 is disabled. Pack 37 preserves the Today current-location weather line and adds the explicit Environmental Alerts control to Details.
- Pack 37 has seven manifest resources and all seven metadata hashes match their active rows.

## Automated launch-hardening gate

`.github/workflows/launch-hardening.yml` now guards the non-visual launch invariants:

1. frozen manifest identity/scope/start URL;
2. shell/fallback minimum-version parity;
3. cached-pack-first and fallback boot path;
4. app-pack downgrade rejection;
5. root-scope service-worker registration;
6. service-worker retention of the UI-pack cache during shell upgrades;
7. offline fallback assets in service-worker precache;
8. pull-to-refresh and fullscreen mechanics;
9. Web Push opt-in without a direct `Notification.requestPermission()` launch prompt;
10. production Pages smoke checks;
11. live Cloudflare Worker health/VAPID/source checks;
12. active Supabase Pack 37 integrity, alert control, current-location presentation and four-sided safe-area styling.

These checks intentionally avoid changing the approved visual composition.

## Remaining human acceptance

The remaining Phase 6/7 gates require real mobile operating-system behavior and cannot be proven by HTTP or static CI alone:

### Android installed PWA

- install/open the production PWA;
- confirm current location still updates weather;
- open Details and turn Environmental Alerts on;
- approve the Android notification permission prompt;
- confirm the device subscription reaches the Cloudflare Worker/D1 store;
- receive a real test/threshold notification on the lock screen;
- tap the notification and confirm the intended route opens;
- close/reopen the PWA and confirm alerts remain enabled;
- accept a later shell update without reinstalling or re-enabling notifications.

### iOS/iPadOS 16.4+

Repeat the same acceptance from a Home Screen-installed PWA. Confirm notification permission is requested only after the explicit alert action and that notification delivery/deep links survive a normal shell update.

## Release rule

Do not broaden hotel-wide installation until at least one supported Android device and one supported iOS/iPadOS device pass the physical notification and no-reinstall acceptance above. Routine Supabase presentation-pack changes remain allowed without reinstall, provided the manifest identity, origin and service-worker scope stay frozen.
