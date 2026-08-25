# AGENTS.md

## Project identity

This repository is the canonical frontend source for the Sindhorn Midtown internal web app.

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages project: `sindhorn-midtown-internal`
- Production URL: `https://sindhorn-midtown-internal.pages.dev`
- Existing shared Supabase project: `sjpvhgxacsiorrtijqua`

## Source-of-truth rules

1. GitHub is canonical for this app's frontend source.
2. Deploy the built/static app directly to the Cloudflare Pages project with Wrangler from GitHub Actions.
3. Do not duplicate this app into Flipgazine `public.site_files`.
4. Supabase may be reused for approved shared brand assets, data, storage, or backend services only.
5. Never print, commit, expose, or request secret values. GitHub Actions deployment secrets are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Current approved PM2.5 baseline

The existing production PM2.5 page at `https://flipgazine.pages.dev/sindhornmidtown/pm25.html` is the approved visual/functional baseline as of v5. It must be migrated before major redesign work. Preserve its bilingual content, AirBKK behavior, caching, accessibility, and readability improvements unless the user explicitly changes them. The user has explicitly removed the UI theme system in favor of a realtime environment plus fullscreen app control.

## PWA / SPA architecture

- This app is a full installable PWA with a single persistent HTML/WebGL shell.
- Use History API client-side routes for `/`, `/guidance`, and `/details`; never force a full page reload for in-app navigation.
- `manifest.webmanifest`, `sw.js`, `app.js`, and `pwa.css` are part of the canonical app shell.
- The official Sindhorn Midtown / Vignette hotel lockup is the app icon artwork.
- The top-right utility control is fullscreen, not a light/dark theme switch.
- Day/night appearance is driven by realtime Bangkok astronomy and weather, never by a UI theme preference.
- Service-worker navigation fallback must keep direct SPA routes and cached/offline use functional.

## Real-time environment architecture

The next product phase will add a premium WebGL/Three.js environmental scene. It must represent three independent real-world systems:

- Bangkok local time / astronomy → sun, moon, daylight angle.
- Real weather → cloud cover, rain, storm state, wind, visibility, humidity.
- AirBKK PM2.5 / Thai AQI → haze, atmospheric extinction, Mie scattering, sun diffusion, saturation and contrast loss.

Critical rules:

- Weather and pollution are independent. Clear weather with hazardous PM2.5 must still show the sun in its real position but through a grey/hazy atmosphere rather than a clean blue sky.
- UI light/dark preference must not change physical day/night conditions.
- Never animate through fake numeric PM2.5/AQI readings. Values replace/crossfade directly; only the visual atmosphere may interpolate.
- WebGL is progressive enhancement. HTML data and controls must remain fully usable if WebGL, weather data, or animation is unavailable.
- Respect `prefers-reduced-motion` and mobile performance constraints.
- Stop or heavily throttle rendering when hidden or offscreen.

## Deployment

Production deploys from `main` through `.github/workflows/deploy.yml`.

The workflow must:

1. Check out the repository.
2. Deploy `site/` with Wrangler.
3. Target `--project-name=sindhorn-midtown-internal --branch=main`.
4. Use only the repository Actions secrets listed above.

## Change discipline

- Inspect the current canonical repository state before consequential edits.
- Make the smallest coherent change that solves the task.
- Do not alter the existing Flipgazine production page unless the user explicitly asks.
- Keep experimental WebGL work isolated from the approved baseline until it is verified.
- Verify mobile first, especially 320–390 px wide viewports.
