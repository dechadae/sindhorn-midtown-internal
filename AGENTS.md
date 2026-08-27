# AGENTS.md

## Project identity

This repository is the canonical core-shell / engine source for the Sindhorn Midtown internal environmental PWA.

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages project: `sindhorn-midtown-internal`
- Production origin: `https://sindhorn-midtown-internal.pages.dev`
- Shared Supabase project: `sjpvhgxacsiorrtijqua`
- Dedicated presentation table: `public.sindhorn_app_files`
- Canonical architecture: `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
- Latest language-order override: `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`
- Live-sky architecture override: `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md`
- Active live-sky implementation plan: `docs/PHASE8-DIRECTIONAL-LIVE-BANGKOK-SKY-CALIBRATION-20260827.md`

Before consequential work, read this file and the final architecture plan. The language-order override is a later approved product decision and supersedes any older Thai-first clauses in the final plan or specialist documents. The live-sky architecture override is a later approved decision for the realtime atmosphere-input pipeline and supersedes the final plan only where camera-derived sky calibration is concerned.

## Current release state

Production is the v16 hybrid PWA with the later Web Push and launch-hardening additions:

- Cloudflare/GitHub = stable installed shell and executable engines.
- Supabase `public.sindhorn_app_files` = versioned presentation/configuration pack.
- Supabase Pack 37 = production presentation pack as of Phase 7.
- AirBKK = authoritative PM2.5 / Thai AQI.
- Open-Meteo = realtime weather at the resolved user location, with Sindhorn Midtown Bangkok fallback.
- Local astronomy = realtime sun/moon geometry.
- Cloudflare Worker + D1 = live Web Push backend.
- Phase 7 launch-hardening regression gate = production protection for PWA identity, offline/fallback behavior, push shell, current-location UI and active pack integrity.
- Phase 8 = active development of directional live Bangkok sky calibration.

The Atmosphere Tester rendering model was promoted to the live environment engine on 26 August 2026. Production `site/environment.js` uses the tester's sky/cloud/fog/heat/PM2.5 visual model, real local solar/lunar position, real WMO/Open-Meteo weather mapping, snow/hail/lightning overlays where physically applicable, and the existing persistent rain-on-glass system. The standalone `/atmosphere-tester.html` remains the manual weather-combination lab.

Do not use Flipgazine `public.site_files` as Sindhorn's canonical application source.

## Final bilingual rule — English first everywhere

This is the current highest language rule:

> **The app is fully bilingual, with English first throughout the entire experience and Thai immediately supporting it.**

This applies to every visible or announced app surface, including:

- brand/editorial copy;
- headings and labels;
- navigation and buttons;
- live status and weather;
- health guidance and actionable instructions;
- warnings, errors and recovery states;
- permissions and operational instructions;
- safety/medical disclaimers;
- pull-to-refresh;
- Save/Share feedback;
- Web Push notification titles and bodies.

English must precede Thai in DOM/read order where both are presented. Thai remains clearly readable and must not be reduced to tiny decorative caption text. No language selector is required for critical comprehension.

The official Sindhorn Midtown / Vignette lockup remains artwork. Follow the currently deployed presentation pack for app typography; do not reintroduce an older font split without checking the active pack first.

## Persistent hybrid architecture

GitHub / Cloudflare owns relatively stable executable infrastructure:

- thin bootstrap `index.html`;
- manifest/service worker/PWA identity;
- official assets/fonts/icons;
- Three.js dependency;
- persistent WebGL renderer;
- astronomy engine;
- router/bootstrap;
- Supabase UI-pack loader;
- pull-to-refresh gesture engine;
- full-page capture engine;
- offline/recovery shell;
- Web Push receiver;
- Cloudflare push backend;
- live-sky camera acquisition / analysis / fusion backend;
- bounded client calibration plumbing.

Supabase owns frequently edited presentation/configuration:

- Today / Guidance / Details markup;
- header/footer presentation;
- UI CSS;
- typography/layout/copy;
- spacing/glass/buttons;
- route-transition configuration;
- environment art-direction parameters.

The WebGL canvas, weather/AirBKK/astronomy state, live-sky calibration state, device tilt, header host and footer host stay alive while route fragments change.

## Atomic UI-pack rules

UI packs are versioned and atomic.

- Fetch manifest.
- Fetch all declared resources.
- Validate presence, content type, schema and SHA-256.
- Cache a complete known-good pack.
- Promote only after full validation.
- If anything fails, keep the previous known-good pack.
- Never expose a mixed old/new pack.
- Bundled fallback pack must allow first boot/offline recovery.

## Realtime environment authority

The physical and visual evidence order is now:

```text
DEVICE LOCATION + LOCAL TIME
→ OPEN-METEO LOCAL WEATHER
→ LOCAL SUN / MOON ASTRONOMY
→ DIRECTIONAL LIVE BANGKOK SKY CALIBRATION
→ SKY
→ CLOUDS
→ SUN / MOON PRESENTATION
→ RAIN / STORM / FOG / SNOW / HAIL
→ PM2.5 OPTICAL HAZE / PARTICLES
→ HTML UI
```

Weather, astronomy, camera evidence and PM2.5 have different authority boundaries and must not be collapsed into one mood value.

### Open-Meteo authority

Open-Meteo controls local weather mechanics: weather code, cloud baseline, precipitation, rain, showers, humidity, wind, visibility, temperature and severe-weather state.

### Astronomy authority

Local astronomy controls physical sun/moon altitude and azimuth. Camera analysis must never move the sun or moon.

### Directional live Bangkok sky calibration

Phase 8 adds camera-derived observed appearance. It may calibrate sky/horizon color, luminance, saturation, cloud darkness/opacity appearance, haze appearance, horizon contrast and sunrise/sunset glow.

The central direction rule is mandatory:

- east-facing cameras dominate visual evidence around dawn/sunrise;
- west-facing cameras dominate visual evidence around golden hour/sunset/dusk;
- midday/night use broader quality/freshness/geographic consensus;
- weighting follows actual solar altitude and azimuth, not fixed clock hours.

Camera evidence is an enhancement layer only. If cameras are unavailable, stale, low-confidence or legally unavailable for automation, confidence goes to zero and the current Open-Meteo + astronomy + AirBKK renderer continues without user-visible failure.

Do not persist raw camera frames. Prefer transient server-side sky/horizon analysis and retain only derived calibration vectors/source metadata. Do not intentionally analyze faces, licence plates or street-level identity information.

Use only provider-supported/public access that permits the intended automated use. A public page or embed does not override provider terms. Sources that cannot be automated lawfully remain manual QA references until permission/direct official access exists.

### PM2.5 authority

AirBKK remains authoritative for PM2.5 / Thai AQI. Camera haze may affect visual confidence but may never invent or alter PM2.5/AQI. PM2.5 optics are applied after weather/camera sky appearance is established.

### Live weather mapping

Do not drive production from tester presets. Production derives its atmosphere from live inputs:

- cloud cover / temperature / humidity / visibility / wind / precipitation / rain / showers / snowfall / WMO weather code from Open-Meteo;
- PM2.5 / Thai AQI from AirBKK;
- real local solar and lunar position locally;
- directional Bangkok sky appearance from the Phase 8 calibration backend when confidence is valid;
- fog from WMO fog codes plus visibility;
- storm/lightning/hail from WMO thunderstorm codes;
- heat shimmer from actual temperature;
- rain-on-glass from the existing persistent rain layer.

The standalone Atmosphere Tester may still combine physically unusual states for QA, but those manual controls must never leak into production state.

## Live-sky camera rules

- Maintain a checked-in camera registry with source ID, coordinates, facing/azimuth, provider, freshness target, feed type, reliability and rights mode.
- Prefer explicit directional East/West public Bangkok cameras for sunrise/sunset calibration.
- Use server-side analysis; the PWA must not depend directly on third-party camera media.
- Vision/AI output must be validated against a strict bounded schema before use.
- Reject stale/offline/low-sky/overexposed/low-confidence frames.
- Use robust aggregation/outlier rejection, then 5–10 minute smoothing for ordinary changes.
- Permit faster response only when independent weather/astronomy evidence supports rapid change.
- Public calibration API returns derived numeric/color values only, never raw frames.
- Long-term renderer target is explicit runtime shader uniforms for calibrated zenith/horizon/glow, not a full-page CSS blur/filter workaround.
- A future Sindhorn-owned east/west roof sky camera becomes the highest-confidence source if installed.

## Rendering / mobile rules

Mobile must visually match desktop.

Do not lower mobile DPR, cloud complexity, frame cadence, celestial quality or tilt. Improve performance by removing waste:

- no full-page CSS blur transitions;
- no giant filtered DOM layers;
- minimize nested backdrop filters;
- use opacity/translate3d/tiny scale only for routes;
- keep only active route DOM mounted;
- stop WebGL only when the document is hidden.

With HTML hidden, the atmosphere must be one uninterrupted sky with no square/rectangular tonal boundary.

## Tilt

- Android/device-orientation capable browsers: attach continuously.
- iOS/iPadOS: request DeviceOrientation permission from the first valid user gesture.
- Once approved, keep it active.
- Tilt clouds/celestial/haze subtly, never HTML UI.

## Pull-to-refresh

Installed iOS and Android PWAs must support pull-to-refresh at scroll top.

- Same glass material family as header/footer.
- Pull → Release → Refreshing.
- Refresh AirBKK, Open-Meteo, UI pack and live-sky calibration in place when Phase 8 client integration is active.
- Never reload/destroy the persistent shell for normal refresh.

## Save full page

`SAVE FULL PAGE` captures the full Today route with current atmosphere while excluding:

- masthead/header;
- sticky footer/navigation;
- reference footer;
- Save button itself.

This is browser capture, never image generation.

## Zero-reinstall rule

After employee rollout, normal releases must never require uninstall/reinstall.

Freeze production origin, manifest id/scope/start_url, service-worker scope and app identity before broad installation. Routine Supabase pack changes hot-update. Rare shell changes use the normal service-worker lifecycle while preserving installation, push permission/subscription, preferences and cached known-good pack.

Phase 8 must follow the same zero-reinstall rule.

## Notifications

The Web Push backend is live:

Cloudflare scheduled Worker → AirBKK/Open-Meteo → meaningful threshold/category-change policy → Web Push → installed iOS/Android PWA.

Subscriptions are stored in Cloudflare D1. VAPID is configured. Notification titles/bodies are English first, Thai second.

Physical native-device acceptance remains required for final Android/iOS subscription/delivery confirmation.

## Deployment discipline

Production deploys from `main`.

For consequential shell/renderer/backend changes:

1. create a dedicated branch;
2. run syntax and structural validation;
3. deploy the branch preview or backend candidate as appropriate;
4. smoke-test the actual preview/backend endpoint;
5. merge through a PR only after the preview gate passes;
6. verify the production `main` workflow after merge before claiming live.

Routine visual/content/art-direction edits should remain Supabase-only when executable changes are not required.

Phase 8 camera acquisition, Workers AI analysis, fusion and runtime renderer calibration are consequential executable/backend changes and therefore use the full branch/validation/PR discipline.

## Documentation authority

Use this order:

1. `AGENTS.md`
2. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md` for language-order conflicts
3. `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md` for realtime camera/sky-calibration conflicts
4. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
5. phase/specialist docs where they do not conflict, including `docs/PHASE8-DIRECTIONAL-LIVE-BANGKOK-SKY-CALIBRATION-20260827.md`

Update canonical documentation when the live architecture materially changes.
