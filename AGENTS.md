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
- Phase 8 production/acceptance record: `docs/PHASE8-DIRECTIONAL-LIVE-BANGKOK-SKY-CALIBRATION-20260827.md`
- Phase 8 renderer implementation record: `docs/PHASE8-SKY-COLOR-RENDERER-IMPLEMENTATION-20260827.md`

Before consequential work, read this file and the final architecture plan. The language-order override is a later approved product decision and supersedes any older Thai-first clauses in the final plan or specialist documents. The live-sky architecture override is a later approved decision for the realtime atmosphere-input pipeline and supersedes the final plan only where camera-derived sky calibration is concerned.

## Current release state

Production is the v16 hybrid PWA with later Web Push, launch-hardening and Phase 8 live-sky additions:

- Cloudflare/GitHub = stable installed shell and executable engines.
- Supabase `public.sindhorn_app_files` = versioned presentation/configuration pack.
- Supabase Pack 37 = production presentation pack.
- AirBKK = authoritative PM2.5 / Thai AQI.
- Open-Meteo = realtime weather at the resolved user location, with Sindhorn Midtown Bangkok fallback.
- Local astronomy = realtime sun/moon geometry.
- Cloudflare Worker + D1 = live Web Push backend.
- Phase 7 launch-hardening regression gate = production protection for PWA identity, offline/fallback behavior, push shell, current-location UI and active pack integrity.
- Phase 8 directional Bangkok sky calibration = **production live** through `sindhorn-midtown-sky`, `site/sky-calibration.js` and `site/sky-color-renderer.js`.
- Service-worker shell = v21 live-sky calibration family.
- Environmental Alerts client = cache-busted `push-client.js?v=2` with explicit service-worker preparation, bounded timeout and Retry recovery.

The Atmosphere Tester rendering model was promoted to the live environment engine on 26 August 2026. Production `site/environment.js` uses the tester's sky/cloud/fog/heat/PM2.5 visual model, real local solar/lunar position, real WMO/Open-Meteo weather mapping, snow/hail/lightning overlays where physically applicable, and the existing persistent rain-on-glass system. Phase 8 now adds bounded observed Bangkok zenith/horizon color calibration over that physical renderer. The standalone `/atmosphere-tester.html` remains the manual weather-combination lab.

Phase 8 technical deployment is complete. Physical installed-device visual acceptance around sunrise/east weighting and sunset/west weighting remains a human QA gate.

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
- bounded client calibration plumbing;
- full-environment live-sky color compositor.

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

### Phase 8 production rendering implementation

The production camera-color path is intentionally separated from the physical WebGL shader:

```text
physical WebGL weather / astronomy / PM2.5 atmosphere
→ structural atmosphere veil
→ live Bangkok sky color compositor
→ precipitation / storm optical layers
→ HTML UI
```

`site/sky-color-renderer.js` receives only validated numeric/color calibration. It blends observed zenith/horizon color across the full environment viewport with confidence-bounded influence. It does not display camera imagery and does not decide physical weather state.

Current maximum color influence:

- sunrise-east / sunset-west: 46%;
- twilight: 34%;
- daytime consensus: 28%;
- night: 16%;
- actual influence is multiplied by calibration confidence.

The compositor redraws only on calibration/resize, not every animation frame. Full-page capture receives the same calibration through the wrapped environment export. If calibration or export composition fails, the physical renderer remains intact.

Explicit shader uniforms remain an optional future refinement, not a blocker for Phase 8 acceptance.

### PM2.5 authority

AirBKK remains authoritative for PM2.5 / Thai AQI. Camera haze may affect visual confidence but may never invent or alter PM2.5/AQI. PM2.5 optics remain part of the physical atmosphere and camera calibration may not overwrite the underlying numeric authority.

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
- The production color compositor must remain bounded, full-viewport and fail-open; no full-page CSS blur/filter workaround.
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
- Refresh AirBKK, Open-Meteo, UI pack and live-sky calibration in place.
- Never reload/destroy the persistent shell for normal refresh.

## Save full page

`SAVE FULL PAGE` captures the full Today route with current atmosphere while excluding:

- masthead/header;
- sticky footer/navigation;
- reference footer;
- Save button itself.

Phase 8 calibrated sky color must be included in the saved atmosphere when valid. This is browser capture, never image generation.

## Zero-reinstall rule

After employee rollout, normal releases must never require uninstall/reinstall.

Freeze production origin, manifest id/scope/start_url, service-worker scope and app identity before broad installation. Routine Supabase pack changes hot-update. Rare shell changes use the normal service-worker lifecycle while preserving installation, push permission/subscription, preferences and cached known-good pack.

Phase 8 and later shell changes must follow the same zero-reinstall rule. Use explicit module cache-busting when a service-worker-cached client must be guaranteed on the next normal reopen.

## Notifications

The Web Push backend is live:

Cloudflare scheduled Worker → AirBKK/Open-Meteo → meaningful threshold/category-change policy → Web Push → installed iOS/Android PWA.

Subscriptions are stored in Cloudflare D1. VAPID is configured. Notification titles/bodies are English first, Thai second.

The installed client must never remain indefinitely in a disabled “Preparing alerts” state. `push-client.js?v=2` explicitly registers the root service worker, uses bounded preparation/API timeouts, and exposes a Retry recovery state. The actual `PushManager.subscribe()` call remains directly attached to the employee’s explicit Turn alerts on gesture.

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

Live-sky camera acquisition, Workers AI analysis, fusion and runtime renderer calibration are consequential executable/backend changes and therefore use the full branch/validation/PR discipline.

## Documentation authority

Use this order:

1. `AGENTS.md`
2. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md` for language-order conflicts
3. `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md` for realtime camera/sky-calibration conflicts
4. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
5. phase/specialist docs where they do not conflict, including `docs/PHASE8-DIRECTIONAL-LIVE-BANGKOK-SKY-CALIBRATION-20260827.md` and `docs/PHASE8-SKY-COLOR-RENDERER-IMPLEMENTATION-20260827.md`

Update canonical documentation when the live architecture materially changes.
