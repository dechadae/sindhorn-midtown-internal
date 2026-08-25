# Sindhorn Midtown Internal — PWA / SPA Architecture

This specialist document is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Final architecture

The app is an installable PWA with a **persistent Cloudflare bootstrap shell** and a **Supabase Sindhorn UI pack**.

Persistent shell layers:

- logo/date/fullscreen header host;
- realtime WebGL atmosphere;
- AirBKK/Open-Meteo/astronomy state;
- device tilt state;
- SPA/router/bootstrap engine;
- bottom navigation/footer host;
- service-worker/PWA session.

Frequently edited route markup, header/footer presentation, UI CSS, typography/copy and atmosphere art-direction parameters come from the validated Supabase Sindhorn app pack.

## Routes

- `/` — live PM2.5 / Thai AQI report, current weather and full-page save action.
- `/guidance` — health guidance and Thailand AQI interpretation.
- `/details` — reading details, source, refresh/share and methodology.

Navigation uses the History API. Normal tab navigation must not reload the document or recreate Three.js.

Only the active route fragment is mounted in the route view. Header/footer/environment remain continuous.

## PWA identity

The installed application identity must be finalized before broad employee rollout and then treated as frozen:

- production origin;
- manifest `id`;
- scope;
- `start_url`;
- service-worker scope;
- name/icon identity.

If an official custom domain is desired long-term, migrate before broad installation.

## Zero-reinstall policy

Normal releases must never require employees to uninstall/reinstall.

- Routine UI/content/config changes update through the Supabase app pack.
- Rare bootstrap/router/WebGL/service-worker changes update through the service-worker lifecycle.
- Preserve push subscriptions, permissions, preferences and known-good cached UI.
- A normal release requiring reinstall is an architectural regression.

## Atomic remote UI updates

The bootstrap fetches a versioned pack manifest, downloads all pack resources, validates them, caches the complete known-good pack, then promotes it atomically. Failed/incomplete packs never replace the previous working pack.

The last known-good pack is available for offline boot.

## Native-app interaction

- Persistent safe-area-aware bottom navigation.
- Top utility is fullscreen, not a manual light/dark theme switch.
- App-owned pull-to-refresh works at scroll position 0 without destroying the persistent shell.
- Route transitions use transform/opacity only; no full-page blur/filter animation.
- Device tilt remains part of the realtime atmosphere where platform permissions allow it.

## Environment rule

There is no UI theme controlling physical conditions. Bangkok astronomy, real weather and PM2.5 independently determine the environment. The atmosphere persists continuously across all routes.
