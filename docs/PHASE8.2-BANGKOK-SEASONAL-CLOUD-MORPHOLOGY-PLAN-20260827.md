# Phase 8.2 — Bangkok Seasonal Cloud Morphology Plan

**Status:** Approved implementation plan  
**Date:** 27 August 2026  
**Repository:** `dechadae/sindhorn-midtown-internal`  
**Architecture authority:** `docs/BANGKOK-SEASONAL-SKY-AND-CLOUD-ARCHITECTURE-OVERRIDE-20260827.md`

## 1. Objective

Replace live-camera/Workers-AI sky calibration as a production dependency with a deterministic Bangkok seasonal sky model and upgrade the procedural cloud renderer so current Bangkok weather produces more credible local cloud structure, seasonal sunrise/sunset color and monsoon depth.

This phase must preserve:

- current UI/layout except for separately approved product changes;
- Pack 38 / Messages presentation state unless a separate Supabase change is required;
- current-location weather behavior;
- AirBKK PM2.5 / Thai AQI authority;
- Open-Meteo physical weather authority;
- local astronomy geometry;
- Web Push + Messages;
- zero-reinstall PWA identity.

**Product override — 27 August 2026:** the visible **Save Full Page** action is removed from active Pack 38 and the offline fallback. It is no longer an acceptance requirement and must not be restored without a new explicit decision. Internal capture/export code may remain as non-visible infrastructure.

## 2. Production transition strategy

### 2.1 Disable camera influence first

Before seasonal renderer promotion, ensure the live-camera calibration path cannot alter production appearance.

Acceptable implementation choices:

- remove `sky-color-renderer.js` from production bootstrap/cache while preserving code in repository history; or
- leave the module loaded but force its production influence to zero; or
- gate it behind a future/disabled feature flag.

Preferred result: no scheduled Workers AI call is required for normal production atmosphere.

### 2.2 Preserve future adaptation

Do not delete the camera architecture research. Mark it deferred and retain enough code/docs to reintroduce a future rooftop 360° camera cleanly.

The existing poor bridge/river cameras must not remain an active production calibration source.

## 3. Seasonal sky profile implementation

Create a deterministic annual Bangkok profile with continuous interpolation by day-of-year.

Suggested representation:

```js
{
  month: 1,
  dawn: {...},
  day: {...},
  sunset: {...},
  twilight: {...},
  cloudLight: {...},
  hazePrior: {...}
}
```

or equivalent compact control curves.

Minimum controls:

- zenith daylight color tendency;
- horizon daylight color tendency;
- dawn lavender/rose potential;
- sunset amber/peach intensity;
- sunset rose/magenta potential;
- twilight lilac/violet potential;
- post-sunset persistence;
- haze desaturation prior;
- seasonal cloud-light tint;
- monsoon cloud-base darkness prior.

Do not hard-switch on month boundaries. Interpolate across adjacent control points using day-of-year.

## 4. Approved seasonal targets

### Cool/dry — November to February

Target visual family:

- pastel lavender/rose sunrise;
- blue/cream daylight depending on weather/haze;
- amber/peach low sun;
- rose/magenta/lilac/violet potential from sunset through civil twilight;
- broken mid/high cloud can hold pink/purple underside color;
- soft aerosol horizon.

This family is especially important for December–February Bangkok.

### Hot/dry — March to April

Target:

- pale warm blue / cream;
- apricot dawn;
- amber/orange/copper/dusty rose sunset;
- lower purple potential than cool season;
- stronger heat/haze softening.

### Monsoon onset — May to June

Target:

- cooler gray-blue atmospheric base;
- growing convective structures;
- selective peach/gold horizon openings;
- increasing humidity softness.

### Wet monsoon — July to September

Target:

- slate/blue-gray/violet-gray cloud mass;
- dark low cloud bases;
- localized coral/gold light below/through cloud near sunrise/sunset;
- dramatic structure without turning the entire sky orange or uniformly muddy.

### Transition — October

Target:

- gradually cleaner contrast after rain;
- pastel peach/pink dawn potential;
- gold → rose/violet sunset after clearing storms.

## 5. Cloud morphology upgrade

The current cloud system should be reworked into three conceptual procedural layers while keeping performance bounded.

### Layer A — high veil

- broad thin noise;
- low opacity;
- slow motion;
- early/late solar color response;
- capable of soft winter pink/lilac.

### Layer B — mid broken cloud

- main visible cloud bodies;
- open sky gaps controlled by real cloud cover;
- multiple frequencies for body/edge detail;
- directional sun-light response;
- seasonal underside tint.

### Layer C — low convective / monsoon

- thicker connected masses;
- darker bases;
- stronger depth/parallax;
- more active in showers/thunderstorm/high-cloud-cover wet-season states;
- selective bright rim/light leak near low sun.

Do not implement billboard sprite clouds or generic fluffy icons.

## 6. Weather mapping

Create explicit mapping from Open-Meteo/WMO state to layer occupancy and structure.

Minimum fixtures:

1. clear;
2. mainly clear;
3. partly cloudy;
4. overcast;
5. fog;
6. light rain;
7. moderate/heavy rain;
8. showers;
9. thunderstorm;
10. high humidity / low visibility without rain.

For each state define:

- high-layer amount;
- mid-layer amount;
- low-layer amount;
- base darkness;
- edge contrast;
- vertical/depth scale;
- opacity;
- lighting response;
- precipitation interaction.

## 7. Solar lighting model

Cloud color must respond continuously to actual solar altitude and azimuth.

At minimum implement:

- directional warm edge/underside term for low sun;
- cooler ambient fill on non-sun-facing cloud regions;
- progressive sunset/twilight tint tied to seasonal profile;
- post-sunset violet/blue ambient transition;
- bounded halo/rim response so clouds do not glow like neon.

Use actual sun geometry already present in the environment engine.

## 8. Haze, humidity and PM2.5 interaction

Apply current physical conditions after basic seasonal/weather structure:

- humidity softens distant/horizon cloud contrast;
- low visibility increases atmospheric veil;
- AirBKK PM2.5 reduces blue saturation and increases diffusion/extinction;
- PM2.5 must not create cloud bodies;
- seasonal haze prior only biases appearance and must be bounded by current live values.

## 9. Test matrix

Add deterministic tester fixtures for date/time + weather combinations.

Required visual fixtures include:

### Cool season

- 15 January, sunrise, clear;
- 15 January, sunset, partly cloudy;
- 15 January, civil twilight, partly cloudy;
- 15 January, sunset, overcast — must NOT force pink clear sky.

### Hot season

- 15 April, sunset, clear/hazy;
- 15 April, sunset, partly cloudy.

### Monsoon

- 27 August, daytime, overcast;
- 27 August, sunset, partly cloudy;
- 27 August, sunset, thunderstorm;
- 15 September, sunset, heavy cloud with warm horizon break.

### Transition

- 15 October, sunset after showers.

For every fixture inspect both portrait/mobile and desktop aspect ratios.

## 10. Acceptance criteria

Phase 8.2 is accepted when:

1. camera/Workers-AI availability cannot change production sky;
2. no daily Cloudflare AI allocation is required for normal atmosphere;
3. December–February sunset can credibly produce rose/magenta/lilac/violet when weather supports it;
4. winter sunrise is softer pastel lavender/rose rather than merely reversed orange sunset;
5. rainy-season skies show large structured dark cloud masses and selective warm breaks;
6. partly cloudy weather preserves real open sky gaps;
7. overcast is visibly connected and dense;
8. current rain/storm/fog state still visibly agrees with Open-Meteo;
9. AirBKK haze remains downstream and numerically authoritative;
10. mobile visual quality matches desktop;
11. the visible Save Full Page button/action bar remains absent online and in the offline fallback;
12. existing navigation, Messages, alerts, location and PWA identity are regression-clean.

## 11. Implementation sequence

### Step 1 — reconcile canonical state

- read `AGENTS.md`;
- read the new seasonal architecture override;
- verify current `main` SHA and production deployment;
- verify active Supabase pack and current service-worker version;
- inspect current `site/environment.js`, `site/sky-calibration.js`, `site/sky-color-renderer.js`, atmosphere tester and relevant workflows.

### Step 2 — isolate live-camera production dependency

- create dedicated implementation branch;
- disable camera color influence / Workers AI requirement in production path;
- preserve future-adaptation research code/documentation.

### Step 3 — build seasonal profile

- implement annual control points + day-of-year interpolation;
- integrate with solar altitude/azimuth;
- add deterministic fixtures.

### Step 4 — upgrade cloud morphology

- implement high/mid/low procedural layers;
- map WMO/cloud cover to layer composition;
- add directional solar lighting and seasonal tint.

### Step 5 — integrate haze/PM2.5

- preserve current AirBKK optics;
- tune humidity/visibility/horizon softness;
- prevent double haze.

### Step 6 — preview QA

- syntax/structural tests;
- fixture tests;
- Cloudflare branch preview;
- compare required seasonal fixtures;
- mobile + desktop smoke;
- verify the Save Full Page control is absent in live and offline presentation.

### Step 7 — release

- PR only after preview passes;
- merge to `main`;
- verify canonical production deployment and launch-hardening gates;
- no reinstall;
- perform physical Android/iOS visual checks.

## 12. Do not do

- do not generate static background images;
- do not depend on live camera feeds for current release;
- do not depend on Workers AI quota;
- do not force one pretty palette regardless of weather;
- do not make every winter sunset purple;
- do not make monsoon sky a flat gray overlay;
- do not degrade mobile rendering quality;
- do not change UI/layout while doing the atmosphere phase unless required for a genuine bug or separately approved product decision;
- do not restore the Save Full Page action without a new explicit decision;
- do not enable/disable Supabase packs for a renderer-only change unless presentation resources truly changed.

## 13. Future adaptation

Keep a future task for a Sindhorn-controlled rooftop 360° camera. When available, use known camera geometry and deterministic sky-pixel analysis to calibrate the seasonal renderer. It must remain optional and fail-open.