# Phase 8.2 — Bangkok Seasonal Cloud Morphology Implementation

Date: 2026-08-27

## Scope

This implementation executes Step 2/3 of the approved Bangkok seasonal atmosphere architecture without changing the product UI/layout.

The production dependency chain becomes:

- current Open-Meteo weather at the resolved device/fallback location;
- actual local solar and lunar geometry;
- a continuous Bangkok annual visual prior;
- three weather-driven procedural cloud depth families;
- AirBKK PM2.5 optical extinction/desaturation;
- existing rain, storm, capture, navigation, Messages, offline and Web Push systems.

## A. Camera / Workers AI isolation

Production no longer loads `site/sky-calibration.js` or `site/sky-color-renderer.js`. The service worker no longer pre-caches either module. Consequently the PWA does not poll the sky Worker and camera-derived colour/cloud values cannot alter production rendering.

The camera/AI source is deliberately retained for future rooftop/360-camera adaptation.

The production sky Worker cron is removed from `sky-worker/wrangler.jsonc`. Its HTTP/research source remains deployable, but there is no scheduled five-minute AI evaluation and therefore no normal daily Workers AI consumption.

The previous Phase 8 camera workflows become manual-only research archive checks. They no longer deploy/evaluate camera AI on normal `main` or site changes.

## B. Continuous Bangkok seasonal profile

`site/seasonal-sky.js` now contains 12 monthly Bangkok control points and continuously interpolates between them in `Asia/Bangkok` time. There are no hard seasonal date jumps.

The profile encodes bounded priors for:

- daylight zenith/horizon colour;
- dawn colour;
- sunset colour;
- twilight colour;
- cloud ambient/base/warm colour;
- heat/haze tendency;
- pink potential;
- violet potential;
- cirrus tendency;
- convective tendency;
- cloud-base darkness;
- post-sunset colour persistence.

Weather is not inferred from the profile. A clear Open-Meteo state cannot gain decorative clouds simply because a seasonal control point has a high cirrus/convective tendency.

## C. Weather-first cloud morphology

`cloudMorphologyForWeather()` converts the current WMO/weather state into explicit occupancy controls for:

- high veil;
- mid broken cloud;
- low convective/monsoon cloud;
- connected-deck strength;
- cloud darkness;
- edge-light response.

Behavioral invariants:

- clear + zero reported cloud returns zero high/mid/low cloud;
- partly cloudy retains a non-connected mid layer and open sky gaps;
- overcast forces a connected mid deck;
- rain/showers increase low-cloud mass;
- thunderstorms force dominant low convective mass and high base darkness;
- season only reshapes cloud that weather already supports.

## D. Shared GPU atmosphere shader

`site/atmosphere-shader.js` is shared by the production renderer and the full cloud customization tester.

One fragment pass renders:

1. high elongated veil/cirrus;
2. mid multi-scale broken cloud;
3. low broad convective/monsoon mass.

Low-sun cloud lighting uses actual solar altitude plus `uSun.x`, which is projected from actual solar azimuth. High cloud warms first; mid cloud can take bounded seasonal underside colour; low monsoon cloud receives only selective rim/horizon light leakage rather than a whole-sky orange wash.

PM2.5 optics are applied after weather/cloud composition and therefore cannot fabricate cloud geometry.

The shared shader now renders a real solar disc from authoritative solar altitude/azimuth. The disc is visible only while the sun is above the horizon, attenuates progressively through high/mid/low cloud optical depth, and disappears below the horizon while seasonal twilight colour continues. The cloud tester uses this exact shared behavior rather than a tester-only approximation.

### Rendering / performance review

The Phase 8.2 performance pass reduces redundant GPU/CPU work without reducing visual quality:

- production DPR remains fixed at **2** on desktop and mobile;
- the full-screen live WebGL context disables unnecessary multisample antialiasing;
- the live renderer does not use `preserveDrawingBuffer`; only the one-shot export renderer preserves its buffer for PNG capture;
- expensive per-fragment multi-octave hash FBM is replaced with a small deterministic repeatable RGBA noise texture sampled in the shared shader; the three cloud depth families remain present;
- snow and hail DPR-2 overlay canvases are allocated lazily only when those weather states actually occur;
- the legacy `storm-effects.js` full-screen compositor is no longer loaded in production, eliminating its second animation/compositing loop and pixel readback while storm darkening and lightning remain in the shared renderer;
- the renderer still runs at normal requestAnimationFrame cadence while visible and pauses only when the document is hidden.

`site/phase8-2-browser-smoke.mjs` renders the deployed candidate in Chromium at desktop and mobile sizes, moves the sun above the horizon, checks DPR/context attributes and shared-renderer identity, captures screenshots, and records frame pacing. Headless SwiftShader metrics are treated as a regression smoke rather than a physical-device benchmark.

Export uses the same shader/uniform state at requested capture resolution.

## E. Deterministic acceptance fixtures

`site/phase8-2-fixtures.js` contains 11 frozen Bangkok-local fixtures:

| Key | Local condition |
|---|---|
| `jan15-sunrise-clear` | Jan 15 clear sunrise |
| `jan15-sunset-partly` | Jan 15 partly-cloudy sunset |
| `jan15-civil-partly` | Jan 15 partly-cloudy civil twilight |
| `jan15-sunset-overcast` | Jan 15 overcast sunset |
| `apr15-sunset-clear-hazy` | Apr 15 clear/hazy sunset |
| `apr15-sunset-partly` | Apr 15 partly-cloudy sunset |
| `aug27-day-overcast` | Aug 27 monsoon overcast daytime |
| `aug27-sunset-partly` | Aug 27 monsoon partly-cloudy sunset |
| `aug27-sunset-thunderstorm` | Aug 27 sunset thunderstorm |
| `sep15-sunset-heavy-cloud` | Sep 15 heavy cloud / localized warm horizon |
| `oct15-post-shower-sunset` | Oct 15 post-shower clearing sunset |

The deterministic fixture file is the frozen acceptance source. The full cloud tester is separately shareable through query-string state and uses the production shader for visual tuning.

Automated tests additionally enforce month-boundary continuity and weather-wins rules such as winter overcast suppressing seasonal pink potential.

## Release gates

Phase 8.2 release workflow:

1. Node syntax validation.
2. Deterministic fixture/model test.
3. Static contract checks for three cloud families and no production camera modules.
4. Dry-run of the preserved sky Worker with cron absent.
5. Cloudflare Pages branch preview.
6. Preview smoke checks.
7. Browser-rendered desktop/mobile screenshots plus frame-pacing/context evidence.
8. Human visual review when realism/art direction requires judgment.
9. PR and merge only after the visual gate.
10. Main deployment and production smoke verification.
11. One-time deployment of the sky Worker configuration without a cron trigger.
12. Launch-hardening verifies PWA identity, Messages, Web Push, Alerts Worker and live Supabase Pack 38 integrity.

No production claim is valid until the `main` workflows and production endpoint checks pass.
