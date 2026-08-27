# Phase 8 — Directional Live Bangkok Sky Calibration

**Status:** Active implementation phase  
**Date:** 27 August 2026  
**Architecture authority:** `LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md`

## Objective

Make Sindhorn Midtown's rendered atmosphere visually track the Bangkok sky in near real time by combining directional public sky-camera evidence with the existing local Open-Meteo weather, astronomy and AirBKK pipeline.

The central user-approved rule is:

- **east-facing cameras dominate sunrise/dawn color calibration**;
- **west-facing cameras dominate sunset/dusk color calibration**;
- daytime/night use broader multi-camera consensus;
- camera analysis changes visual atmosphere only and never changes authoritative PM2.5, weather-code or sun/moon geometry.

## Current starting state

Already production-stable:

- hybrid Cloudflare shell + immutable Supabase UI packs;
- current-location Open-Meteo weather;
- local sun/moon astronomy;
- Atmosphere Tester renderer promoted to production;
- AirBKK PM2.5 / Thai AQI authority;
- Phase 6 Web Push backend;
- Phase 7 launch-hardening regression gate;
- Pack 37 active.

Phase 8 must be additive and fail open to the current renderer.

---

## 8A — Camera discovery and registry

### Deliverables

- checked-in camera registry;
- direction (`east`, `west`, `central`, etc.);
- coordinates;
- expected azimuth where known;
- provider/source page;
- feed type;
- freshness target;
- rights/automation mode;
- enabled/disabled state;
- source reliability score.

### Initial preferred cameras

Use explicitly directional Bangkok public-feed cameras first, particularly East/West camera pairs around Krung Thon Bridge / Chao Phraya.

Initial known candidates:

- Bang Yi Khan East / Krung Thon Bridge, OpenCCTV camera `317138`;
- Bang Yi Khan West / Krung Thon Bridge / Chao Phraya, OpenCCTV camera `317474`;
- Bang Phlat East/West pairs discovered through the Bangkok camera index.

Secondary references:

- central Bangkok / Sathorn / Silom skyline livestream;
- SkylineWebcams Bangkok skyline;
- other reliable Bangkok public/official cameras with visible sky.

Secondary providers remain non-automated where terms or feed access do not permit transient analysis.

### Acceptance

- at least one east and one west source can be fetched or resolved server-side;
- stale/offline sources are detected;
- no browser/client fetches camera media directly.

---

## 8B — Camera-frame analyzer on Cloudflare

### Preferred stack

Dedicated Cloudflare Worker using Workers AI vision and JSON-schema output.

Use a vision model that supports structured output. The analyzer must validate and clamp every field after inference.

### Output schema

Minimum per-camera observation:

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

### Privacy/data handling

- process upper sky/horizon only where possible;
- never persist raw frames;
- retain derived values only;
- do not intentionally analyze people/vehicles/plates.

### Acceptance

- analyzer returns deterministic schema or fails safely;
- malformed model output cannot reach client/render config;
- no raw image returned by public API.

---

## 8C — Directional fusion engine

### Inputs

- camera observations;
- solar altitude/azimuth;
- current Open-Meteo weather;
- AirBKK PM2.5 only for downstream consistency checks;
- source freshness/reliability.

### Logic

1. filter stale/low-quality sources;
2. compute sun-relative direction weights;
3. boost east sources around sunrise and west around sunset;
4. reject/down-weight outliers;
5. robustly aggregate colors and atmospheric values;
6. smooth ordinary changes over 5–10 minutes;
7. permit faster change during genuine rapid weather transitions;
8. generate one public calibration vector.

### Public endpoint

Target:

`GET /calibration`

Returns derived JSON with `schema`, `observedAt`, `expiresAt`, `confidence`, `mode`, source weights and the fused visual vector.

### Acceptance

- stale endpoint payload automatically expires;
- confidence falls to zero rather than inventing values;
- sunrise mode demonstrably favors east sources;
- sunset mode demonstrably favors west sources.

---

## 8D — PWA calibration client

### Deliverables

- lightweight `sky-calibration.js` client module;
- no user permission request;
- cached last-known calibration with short TTL;
- polling/refresh aligned to approximately 5-minute server updates;
- refresh hook integrated with existing pull-to-refresh;
- diagnostic state available to the Atmosphere Tester / internal QA only.

### Renderer integration order

1. cloud opacity / contrast / darkness;
2. fog/haze appearance where consistent with local inputs;
3. dynamic zenith/horizon color;
4. directional sunrise/sunset glow;
5. interpolation between calibration vectors.

No full-page blur/filter solution. Long-term target is runtime shader uniforms.

### Acceptance

- camera system offline = current production rendering unchanged;
- old installed PWA updates without reinstall;
- no visible UI dependency on the calibration Worker.

---

## 8E — Renderer runtime-color support

The current renderer configuration contains day/golden/twilight/night colors, but runtime camera calibration needs explicit bounded dynamic inputs.

### Target uniforms

- calibrated zenith RGB;
- calibrated horizon RGB;
- calibration confidence;
- calibrated luminance/saturation;
- directional warm-glow vector/strength;
- cloud darkness multiplier;
- optional haze appearance multiplier.

### Composition rule

Camera calibration blends with the physically computed base sky; it never entirely replaces it.

Suggested maximum influence:

- high-confidence sunrise/sunset: up to ~65–75% color calibration influence;
- high-confidence daytime: up to ~35–50%;
- night: lower color influence, higher cloud/luminance confidence use;
- low confidence: smoothly approach zero.

### Acceptance

- current weather fixtures still pass;
- sun/moon position unchanged;
- rain/storm mechanics unchanged;
- PM2.5 remains downstream;
- no block/gradient seam introduced.

---

## 8F — Multi-camera validation

Build automated/manual test fixtures for:

- clear sunrise;
- hazy sunrise;
- cloudy sunrise;
- clear noon;
- monsoon overcast;
- rain arrival;
- golden-hour west sunset;
- stormy sunset;
- dusk;
- cloudy night.

Record source weights, fused vector and screenshot comparison in the test evidence.

### Required physical visual checks

- Android installed PWA;
- iOS/iPadOS installed PWA when available;
- desktop Chrome/Safari reference;
- current-location weather remains correct;
- no service-worker reinstall requirement.

---

## 8G — Hyperlocal Sindhorn camera option

Not required for the first release, but recommended as the final quality step.

A hotel-owned roof camera aimed primarily at open sky/horizon would:

- remove third-party feed dependency;
- provide hyperlocal cloud/haze/sunset evidence;
- avoid provider licensing ambiguity;
- become highest confidence source;
- preserve public Bangkok cameras as wider-area consensus/outlier detection.

Preferred future arrangement is two simple sky views if feasible:

- east / northeast horizon for dawn/sunrise;
- west / southwest horizon for golden hour/sunset and incoming monsoon weather.

---

## Release gates

Phase 8 is not a Supabase-only presentation edit. Use the standard consequential workflow:

1. dedicated GitHub branch;
2. syntax/structural tests;
3. Worker dry-run;
4. live source-resolution tests that do not persist frames;
5. branch Pages preview where client code changes;
6. Atmosphere Tester validation;
7. smoke test;
8. PR;
9. merge;
10. production workflow verification;
11. enable calibration influence gradually behind confidence/fallback gates.

## Rollback

The feature must be removable by setting calibration influence to zero or disabling the calibration endpoint/client. No PWA reinstall and no rollback of the core Open-Meteo/AirBKK renderer should be required.

## Phase completion definition

Phase 8 is complete when:

- east and west cameras are automatically analyzed;
- directional weighting is live;
- the PWA consumes a bounded fused vector;
- sunrise/sunset colors visibly follow real Bangkok evidence;
- weather/AirBKK/astronomy authorities remain intact;
- stale/offline cameras are invisible to the user;
- automated regression tests and physical-device visual tests pass.