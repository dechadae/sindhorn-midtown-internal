# Phase 8 — Directional Live Bangkok Sky Calibration

**Status:** Production deployed; physical-device visual acceptance remains  
**Date:** 27 August 2026  
**Architecture authority:** `LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md`

## Objective

Make Sindhorn Midtown's rendered atmosphere visually track the Bangkok sky in near real time by combining directional public sky-camera evidence with the existing local Open-Meteo weather, astronomy and AirBKK pipeline.

The central user-approved rule is:

- **east-facing cameras dominate sunrise/dawn color calibration**;
- **west-facing cameras dominate sunset/dusk color calibration**;
- daytime/night use broader multi-camera consensus;
- camera analysis changes visual atmosphere only and never changes authoritative PM2.5, weather-code or sun/moon geometry.

## Production state — 27 August 2026

Phase 8 is now deployed to the production PWA and production Cloudflare sky Worker.

Production-stable components now include:

- hybrid Cloudflare shell + immutable Supabase UI packs;
- current-location Open-Meteo weather;
- local sun/moon astronomy;
- Atmosphere Tester renderer promoted to production;
- AirBKK PM2.5 / Thai AQI authority;
- Phase 6 Web Push backend;
- Phase 7 launch-hardening regression gate;
- Pack 37 active;
- `sindhorn-midtown-sky` scheduled Cloudflare Worker;
- directional east/west camera registry and source probing;
- Workers AI sky/horizon analysis with strict structured output;
- freshness/quality rejection, directional fusion and outlier reduction;
- 5–10 minute calibration smoothing;
- production `/calibration` fail-open API;
- PWA `sky-calibration.js` client;
- PWA `sky-color-renderer.js` full-viewport compositing layer;
- full-page capture parity for calibrated sky color;
- service-worker v21 precaching the Phase 8 clients.

The production release passed the Phase 8 calibration gate, Phase 8 sky-color-renderer gate, canonical Pages deployment and launch-hardening checks after merge.

The remaining Phase 8 acceptance item is **physical-device visual review**, especially sunrise/east weighting and sunset/west weighting on installed Android/iOS PWAs. This is a human/device acceptance gate rather than unfinished backend architecture.

---

## 8A — Camera discovery and registry — COMPLETE

Implemented:

- checked-in camera registry;
- direction (`east`, `west`, `central`, etc.);
- coordinates/source metadata;
- provider/source page;
- freshness/reliability metadata;
- enabled/automation mode;
- explicit east and west Bangkok sources.

Initial directional sources include public Bangkok East/West camera pairs around the Chao Phraya / Krung Thon Bridge area where the sky is usable.

Secondary skyline/camera sources remain references unless their access terms support automated transient analysis.

Acceptance achieved:

- at least one east and one west source resolve server-side;
- stale/offline sources are detected;
- the browser/PWA never fetches camera media directly.

---

## 8B — Camera-frame analyzer on Cloudflare — COMPLETE

Production stack:

- dedicated Cloudflare Worker;
- Workers AI vision;
- strict JSON-schema atmospheric output;
- post-inference validation/clamping;
- no raw frame returned by the public API.

Per-camera observation includes:

- `skyVisible`;
- `quality`;
- `confidence`;
- `zenithRgb`;
- `horizonRgb`;
- `luminance`;
- `saturation`;
- `warmth`;
- `cloudOpacity`;
- `cloudDarkness`;
- `haze`;
- `horizonContrast`;
- `sunGlow`;
- `stormConfidence`;
- frame timestamp/freshness.

Privacy/data handling:

- camera frames are transient analysis inputs;
- raw frames are not retained as application data;
- the system retains derived atmospheric values/source metadata only;
- the analysis prompt is restricted to sky/horizon atmospheric appearance and does not intentionally analyze people, vehicles or identifying street detail.

---

## 8C — Directional fusion engine — COMPLETE

Production fusion logic:

1. reject stale/low-quality sources;
2. compute solar altitude/azimuth;
3. boost east-facing sources around sunrise;
4. boost west-facing sources around sunset;
5. reduce outliers using cross-camera atmospheric medians;
6. aggregate colors and atmospheric values with confidence/freshness weighting;
7. smooth normal changes over approximately 5–10 minutes;
8. allow faster change when independent severe-weather evidence supports it;
9. publish one bounded calibration vector.

Production endpoint:

`GET /calibration`

The response contains derived JSON only: schema, observation/expiry timestamps, confidence, directional mode, source weights, solar metadata and the fused visual vector.

Fail-open behavior is mandatory and implemented: an expired or unusable calibration becomes zero influence rather than an invented atmospheric state.

---

## 8D — PWA calibration client — COMPLETE

`site/sky-calibration.js` is live and:

- requires no user permission;
- fetches the production sky Worker;
- caches only short-lived valid calibration;
- refreshes on the server cadence / pull-to-refresh;
- dispatches bounded calibration state to the renderer;
- applies conservative cloud opacity/contrast/edge-light calibration;
- falls back invisibly when the Worker/cameras are unavailable.

The installed PWA upgrades through the normal service-worker lifecycle. No reinstall is required.

---

## 8E — Live sky color rendering — COMPLETE

The production visual implementation uses a bounded **full-environment color compositor** rather than letting camera evidence replace physical weather rendering.

Layer order:

```text
physical WebGL weather / astronomy / PM2.5 atmosphere
→ structural atmosphere veil
→ live Bangkok sky color compositor
→ precipitation/storm optical layers
→ HTML UI
```

`site/sky-color-renderer.js` receives only the validated calibration vector and blends observed `zenithRgb` / `horizonRgb` across the full environment viewport.

Maximum color influence is intentionally conservative:

- sunrise-east / sunset-west: up to 46%;
- twilight: up to 34%;
- daytime consensus: up to 28%;
- night: up to 16%;
- actual influence is further multiplied by fused confidence.

This keeps Open-Meteo/astronomy physically authoritative underneath while allowing the rendered Bangkok sky to inherit the real observed color cast.

The compositor is redrawn only when calibration changes or the viewport resizes, so it does not add a second continuous animation loop.

### Capture parity

The same calibration gradient is applied to `SindhornEnvironment.renderExport()` output, so full-page saved images match the calibrated live atmosphere.

If calibration/export compositing fails, the original physical renderer output is returned unchanged.

### Future optional refinement

Explicit calibrated shader uniforms remain a possible optimization/refinement, but they are no longer required to complete Phase 8. The current compositor satisfies the approved authority boundaries, fail-open behavior, capture parity and full-viewport/no-panel requirements without destabilizing the validated physical shader.

---

## 8F — Multi-camera validation — AUTOMATED COMPLETE / PHYSICAL REVIEW PENDING

Automated release evidence covers:

- source discovery/probing;
- east/west directional selection logic;
- structured vision analysis;
- calibration fusion;
- freshness/confidence limits;
- preview Worker deployment;
- preview calibration endpoint/CORS;
- Pages branch preview;
- service-worker/client delivery;
- production Worker deployment;
- production Pages promotion;
- launch-hardening / Pack 37 integrity.

Required physical visual checks still to complete:

- Android installed PWA at/near sunrise;
- Android installed PWA at/near sunset;
- iOS/iPadOS installed PWA when available;
- compare the rendered horizon against real Bangkok visual conditions;
- verify current-location weather remains correct;
- verify no reinstall is required;
- verify full-page save carries the same calibrated sky appearance.

These are observation/acceptance checks; failure should lead to calibration-weight tuning, not replacement of the physical weather authority.

---

## 8G — Hyperlocal Sindhorn camera option — FUTURE OPTIONAL

Not required for Phase 8 production acceptance, but recommended as the highest-quality future source.

A hotel-owned roof camera aimed primarily at open sky/horizon would:

- remove third-party feed dependency;
- provide hyperlocal cloud/haze/sunset evidence;
- avoid provider licensing ambiguity;
- become the highest-confidence visual source;
- preserve public Bangkok cameras as wider-area consensus/outlier detection.

Preferred future arrangement if operationally feasible:

- east / northeast horizon for dawn/sunrise;
- west / southwest horizon for golden hour/sunset and incoming monsoon weather.

---

## Release evidence

Phase 8 used the standard consequential release discipline:

1. dedicated GitHub branch;
2. syntax/structural tests;
3. Worker dry-run;
4. live source-resolution test;
5. one real preview Workers AI evaluation;
6. Cloudflare Pages branch preview;
7. preview smoke test;
8. PR #37;
9. merge to `main`;
10. production sky Worker verification;
11. production Pages verification;
12. launch-hardening verification.

Later Web Push cache/recovery changes were independently revalidated and did not remove Phase 8; Phase 8 production workflows continued to pass on the current shell.

## Rollback

The feature remains fail-open and independently removable. Calibration influence can fall to zero / the client can be disabled without rolling back Open-Meteo, AirBKK, astronomy, the core WebGL renderer or the installed PWA identity.

## Phase completion definition

### Technical completion — ACHIEVED

- east and west cameras are automatically analyzed;
- directional weighting is live;
- the PWA consumes a bounded fused vector;
- the production sky receives real Bangkok camera-derived color calibration;
- weather/AirBKK/astronomy authority boundaries remain intact;
- stale/offline cameras are invisible to the user;
- automated regression/release gates pass.

### Product acceptance — PENDING PHYSICAL VISUAL REVIEW

Phase 8 is fully accepted after installed-device observation confirms that sunrise/east and sunset/west calibration improve realism without creating visible color mismatch or instability.
