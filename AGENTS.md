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

Before consequential work, read this file and the final architecture plan. The language-order override is a later approved product decision and supersedes any older Thai-first clauses in the final plan or specialist documents.

## Current release state

Production is the v16 hybrid PWA:

- Cloudflare/GitHub = stable installed shell and executable engines.
- Supabase `public.sindhorn_app_files` = versioned presentation/configuration pack.
- AirBKK = authoritative PM2.5 / Thai AQI.
- Open-Meteo = realtime weather.
- Bangkok sun/moon = local astronomy.
- Cloudflare Worker + D1/KV = future Web Push backend.

The Atmosphere Tester rendering model was promoted to the live environment engine on 26 August 2026. Production `site/environment.js` now uses the tester's sky/cloud/fog/heat/PM2.5 visual model, real Bangkok solar/lunar position, real WMO/Open-Meteo weather mapping, snow/hail/lightning overlays where physically applicable, and the existing persistent rain-on-glass system. The standalone `/atmosphere-tester.html` remains the manual weather-combination lab.

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
- Web Push receiver.

Supabase owns frequently edited presentation/configuration:

- Today / Guidance / Details markup;
- header/footer presentation;
- UI/component CSS;
- typography/layout/copy;
- spacing/glass/buttons;
- route-transition configuration;
- environment art-direction parameters.

The WebGL canvas, weather/AirBKK/astronomy state, device tilt, header host and footer host stay alive while route fragments change.

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

Required order:

```text
REAL WEATHER
→ SKY
→ CLOUDS
→ SUN / MOON
→ RAIN / STORM / FOG / SNOW / HAIL
→ PM2.5 OPTICAL HAZE / PARTICLES
→ HTML UI
```

Weather and PM2.5 remain independent. Overcast must visibly look overcast. Clear weather plus hazardous PM2.5 still retains the physical sun through pollution haze.

The production renderer is the promoted Atmosphere Tester core adapted to live data. The standalone tester controls are not part of the guest UI. Art-direction parameters may remain Supabase-configurable; executable shader/renderer code stays in GitHub/Cloudflare.

### Live weather mapping

Do not drive production from tester presets. Production derives its atmosphere from live inputs:

- cloud cover / temperature / humidity / visibility / wind / precipitation / rain / showers / snowfall / WMO weather code from Open-Meteo;
- PM2.5 / Thai AQI from AirBKK;
- real Bangkok solar and lunar position locally;
- fog from WMO fog codes plus visibility;
- storm/lightning/hail from WMO thunderstorm codes;
- heat shimmer from actual temperature;
- rain-on-glass from the existing persistent rain layer.

The standalone Atmosphere Tester may still combine physically unusual states for QA, but those manual controls must never leak into production state.

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
- Refresh AirBKK, Open-Meteo and UI pack in place.
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

## Notifications

Target:

Cloudflare scheduled Worker → AirBKK/Open-Meteo → meaningful threshold/category-change policy → Web Push → installed iOS/Android PWA.

Store subscriptions in Cloudflare D1 or KV, use VAPID, and do not use Supabase as notification storage unless explicitly approved later.

Notification titles/bodies are English first, Thai second.

## Deployment discipline

Production deploys from `main`.

For consequential shell/renderer changes:

1. create a dedicated branch;
2. run syntax and structural validation;
3. deploy the branch preview;
4. smoke-test the actual preview alias;
5. merge through a PR only after the preview gate passes;
6. verify the production `main` workflow after merge before claiming live.

Routine visual/content/art-direction edits should remain Supabase-only when executable changes are not required.

## Documentation authority

Use this order:

1. `AGENTS.md`
2. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md` for language-order conflicts
3. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
4. specialist docs where they do not conflict

Update canonical documentation when the live architecture materially changes.
