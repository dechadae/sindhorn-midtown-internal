# AGENTS.md

## Project identity

This repository is the canonical **core-shell / engine** source for the Sindhorn Midtown internal environmental PWA.

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages project: `sindhorn-midtown-internal`
- Current production URL: `https://sindhorn-midtown-internal.pages.dev`
- Shared Supabase project: `sjpvhgxacsiorrtijqua`
- Canonical final plan: `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`

## Mandatory first read

Before consequential implementation work, read:

1. this `AGENTS.md`;
2. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

The final plan supersedes conflicting rules in older documents.

## Current state vs target architecture

The currently deployed application is still the GitHub/Cloudflare monolithic PWA through v14. The approved next architectural move is a **persistent Cloudflare bootstrap shell + Supabase Sindhorn UI pack**.

Do not confuse current implementation state with the final architecture target.

### Final ownership after migration

GitHub / Cloudflare owns stable executable core infrastructure:

- bootstrap shell;
- manifest/service worker/PWA identity;
- persistent Three.js/WebGL renderer engine;
- astronomy engine;
- SPA/bootstrap router;
- remote UI-pack loader;
- offline/recovery engine;
- pull-to-refresh gesture engine;
- full-page capture engine;
- push notification receiver;
- stable brand/font assets.

Supabase owns frequently edited presentation/configuration through a dedicated Sindhorn namespace/table, preferably `public.sindhorn_app_files`:

- Today / Guidance / Details route content;
- header/footer presentation;
- UI/component CSS;
- typography/layout/copy;
- buttons/glass/spacing;
- route transition configuration;
- atmosphere art-direction parameters.

Do **not** use Flipgazine `public.site_files` as the Sindhorn app's canonical content namespace.

AirBKK remains the direct PM2.5/Thai AQI source. Open-Meteo remains the direct weather source. Astronomy is calculated locally. Supabase is not the live environmental database.

## Highest visual-language rule

> **English typography is eminent. English defines the premium editorial composition; Thai guarantees operational understanding.**

Final typography authority:

- English / Latin UI and editorial copy: **Vignette Sans**.
- Thai: **Noto Sans Thai**.
- Official Sindhorn Midtown / Vignette lockup remains image artwork.
- The earlier v13 global Noto Sans English override is superseded and must not be treated as final authority.

English leads brand/editorial headings, navigation, section/data/weather/status labels and ordinary utility UI.

Thai appears first for health guidance, actionable instructions, warnings, errors/recovery, permissions, operational instructions and safety/medical disclaimers. Thai must always remain readable and critical comprehension must never require a language selector.

## CI / product styling

Use Flipgazine CI / Voice-page interaction grammar while preserving Sindhorn Midtown identity:

- Twilight `#2E273B` base;
- warm off-white `#FAF7F5` text;
- Sorbet `#E5ECBE` accent;
- fine hairlines;
- restrained frosted glass;
- premium typographic hierarchy;
- edge-to-edge Voice-style sticky footer/navigation;
- one parent glass layer where possible rather than nested expensive blur surfaces.

Header/footer/buttons/pull-refresh must feel like one coherent Sindhorn system, not generic dashboard cards.

## PWA / persistent-shell architecture

The final app is a full installable PWA with a single persistent shell.

Persistent across `/`, `/guidance`, `/details`:

- WebGL canvas;
- weather/AirBKK/astronomy state;
- device tilt state;
- app header host;
- app footer/navigation host;
- service-worker session.

Only the route content mounted in the route view changes.

Never force full document reloads for normal tab navigation. Do not recreate Three.js on route changes.

## Zero-reinstall release requirement

This is non-negotiable after employee rollout:

> **Normal releases must never require employees to uninstall and reinstall the PWA.**

Before broad launch, finalize/freeze the permanent production origin, manifest `id`, scope, `start_url`, service-worker scope and app identity. If a custom official production domain is desired, decide/migrate before broad installation.

Routine Supabase UI-pack changes hot-update in the existing installation. Rare shell/engine changes use the service-worker lifecycle. Preserve push subscriptions, permissions, local preferences and cached known-good app state.

A normal release requiring reinstall is an architectural regression.

## Realtime environment authority

The environment is a realtime simulation of three independent systems:

1. Bangkok astronomy → sun/moon/daylight position;
2. Open-Meteo weather → clouds/rain/storm/fog/wind/visibility/humidity;
3. AirBKK PM2.5/AQI → optical haze/extinction/scattering/contrast/saturation/particles.

Required rendering order:

```text
weather → sky → clouds → sun/moon → rain/storm/fog → PM2.5 optical layer → HTML UI
```

Weather and pollution remain independent. Example: clear noon + hazardous PM2.5 still has the real noon sun but through grey/desaturated haze.

Weather-code state must visibly agree with the atmosphere. Overcast may not look clear. Clouds must be a clearly visible rendering layer, not barely perceptible noise.

Do not animate through fake PM2.5/AQI numbers. Numeric readings crossfade directly; the atmosphere may interpolate visually.

## Rendering fidelity and performance

The user explicitly requires equivalent visual quality on mobile and desktop.

Do not improve mobile performance by lowering DPR, cloud complexity, visible animation cadence, sun/moon quality or tilt compared with desktop.

Performance improvements must remove waste instead:

- no full-page CSS `filter: blur()` route transitions;
- no giant filtered DOM layers over WebGL;
- minimize nested backdrop filters;
- use transform + opacity for route transitions;
- keep active route DOM small;
- stop environment rendering only when the document is hidden.

The environment must look like one uninterrupted sky with no square/rectangular/block renderer boundary.

## Mobile tilt

Tilt is always part of the atmosphere where the platform permits it.

- Android/device-orientation capable browsers: attach continuously.
- iOS/iPadOS: request DeviceOrientation permission from the first valid user gesture as required by the OS; once granted, keep it active.
- Tilt may affect cloud/celestial/haze parallax subtly, never tilt the HTML UI.

## Route transitions

Use only `transform` + `opacity` (and tiny scale if useful), approximately 260–340 ms with premium easing. Full-page CSS blur is prohibited because it causes costly rasterization while WebGL is active.

## Pull-to-refresh

Pull-to-refresh must work from scroll position 0 on every route in installed iOS and Android PWAs.

- Gesture engine belongs to stable shell.
- Visual material/config may come from Supabase.
- Pull indicator must use the same opacity/glass tokens as header/footer; never a visually solid pill.
- Refresh current route/environmental sources.

## Save full page

The old compact image concept is retired.

Save means full-length Today route capture with current atmosphere, excluding:

- header/masthead;
- sticky bottom navigation/footer;
- reference footer if present;
- Save button itself.

This is browser capture, not generative image creation.

## Notifications

Cross-platform standards-based Web Push remains the target for iOS/iPadOS Home Screen PWAs and Android installed PWAs.

Backend target:

- Cloudflare scheduled Worker;
- AirBKK/Open-Meteo checks;
- threshold/deduplication logic;
- D1 or KV push-subscription store;
- VAPID Web Push.

Do not add Supabase as the notification database unless explicitly approved later.

Notify meaningful category/severe-weather changes, not every numeric refresh. Critical notification copy is Thai-first with English support.

## Offline / atomic UI-pack rules

The future Supabase UI pack must be versioned and atomic.

- Download complete pack.
- Validate resource presence/type/hash/schema.
- Cache as a known-good version.
- Promote only after complete validation.
- If update fails, continue using previous known-good pack.
- Never expose users to mixed old/new pack resources.

The stable shell must boot cached UI offline and remain usable if Supabase, Open-Meteo, AirBKK or WebGL is temporarily unavailable.

## Deployment discipline

Current production deploys from `main` through `.github/workflows/deploy.yml` to Cloudflare Pages project `sindhorn-midtown-internal`.

Until the hybrid migration is complete, avoid repeated tiny `site/**` commits because each triggers a deployment.

For core-shell changes:

1. inspect current canonical repo/live state;
2. create one coherent branch;
3. implement the requested batch;
4. QA mobile + desktop + environmental fixtures;
5. merge once;
6. deploy once;
7. verify actual production URL before claiming live.

After migration, ordinary UI/content/art-direction edits should happen in the Supabase Sindhorn UI pack without Cloudflare deployment.

## Documentation authority

Authority order:

1. `AGENTS.md`
2. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
3. specialist docs where they do not conflict with the final plan

Update the final plan and this file whenever the actual live architecture materially changes so a fresh session can recover canonical state without relying on chat history.
