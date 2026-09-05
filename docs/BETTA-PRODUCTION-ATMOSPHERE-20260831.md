# Sindhorn Betta Production Atmosphere — 2026-08-31

Status: approved production architecture.

## Decision

The persistent app background is now the Sindhorn Betta procedural WebGL organism approved in the `betta-fin-lab` visual review. The active visual's only real-time environmental authority is current JMA Himawari-9 High-Resolution Asia 1 satellite imagery over Bangkok.

Weather and air-quality systems remain operational data/UI systems. They do not drive Betta form or colour.

## Active visual authority

`site/betta-environment.js` owns the persistent `#environmentCanvas` and uses:

- `site/betta-fin-presets.js` — eight real-Betta-inspired biological colour/morph baselines;
- `site/betta-fin-shader.js` — radial membrane deformation and material shader;
- `site/betta-satellite.js` — Bangkok Himawari image analysis;
- `site/_worker.js` + `site/_routes.json` — locked-down same-origin JMA HA1 proxy.

The eight canonical baselines are:

1. Royal Blue Halfmoon
2. Super Red Halfmoon
3. Mustard Gas
4. Black Orchid
5. Copper Metallic
6. Turquoise Metallic
7. Nemo Galaxy Koi
8. Red Snow Dragon

Royal Blue Halfmoon is the production default. Satellite observations continuously bias morphology, large-scale motion, membrane lighting, iridescence and restrained colour response while preserving the biological colour family.

## Satellite-only live influence

The Betta renderer must not use TMD station observations, MET Norway model fields, Open-Meteo, AirBKK, device geolocation, device orientation, calculated astronomy, microphone, camera or other device sensors as live visual inputs.

Its satellite controls are derived from JMA Himawari-9 HA1 B13 infrared, B08 water-vapour and B03 visible imagery, including consecutive-frame cloud-field change/motion, image structure, visible spectral bias and a deterministic observation fingerprint.

Procedural GLSL noise is the organism's internal continuous motion between satellite observations and is not represented as external evidence.

## Day cycle and period styles — amended 5 September 2026

Since the Bangkok day cycle was promoted (#135), `site/betta-day-periods.js` names eight periods of the hotel day and `betta-environment.js` cross-fades between their baselines on hotel time. The clock is a schedule, not a sensor: it chooses which configured fish is on screen and never modulates the render.

Each period may carry a style (r29a): the output of `site/betta-random.js`, a verbatim port of the Mac Betta Metal Lab randomizer (SplitMix64; colours and fin form only; camera and composition are never randomized). Styles are chosen and judged on the Readability Test (`#readability`, developer account only) and are configuration: the runtime reads them at boot (`localStorage` in r29a, the server from r29b) and `setBettaStyle` / `setBettaStyles` / `saveBettaStyles` are the only writers. A period without a style renders its bundled baseline.

`sampleBettaFrame(width)` renders the live `scene` and `camera` once through a second, 64px-wide `THREE.WebGLRenderer` (same colour space, tone mapping and exposure as the stage; `preserveDrawingBuffer:true`) and reads its pixels back. The main renderer stays `preserveDrawingBuffer:false`. The sampler exists only while the Readability Test is mounted (`disposeBettaSampler()` on unmount) and is the one place the app reads the Betta's pixels.

## Weather and air-quality remain data/UI

The existing production authorities continue unchanged for operational information:

- TMD AWS current weather through `sindhorn-weather-core`;
- MET Norway supporting cloud/forecast fields through that weather core;
- `sindhorn-rain-now` for current rain authority/data;
- AirBKK for PM2.5/AQI.

`site/betta-environment.js` continues to render the Today weather card through the existing legacy fetch contract intercepted by `site/location.js`; those values never enter the Betta shader.

## Legacy weather WebGL — retired from the app

On 2026-08-31 the product owner explicitly removed the previous weather-driven WebGL stack from the deployed application. It is no longer a rollback path inside `site/`.

Before deletion, Supabase copied the exact source bytes from immutable Git commit `29b0c99941163582b84d376982e459fdf6ead85b` into private table `private.legacy_weather_webgl_archive`, archive key `legacy-weather-webgl-20260831`. The archive contains 13 files / 1,169,050 bytes and has no `anon` or `authenticated` table grants.

Operational weather and current-rain data remain active UI/data services. Only the retired weather/seasonal visual renderer and its visual compatibility/research files were removed. The Sindhorn Betta renderer remains the sole persistent WebGL visual.

## Compatibility surface

The active renderer preserves `window.SindhornEnvironment` for existing app consumers, including:

- `refreshWeather()`
- `renderExport(width,height)`
- `getState()`
- `applyConfig()` compatibility no-op

`getState().renderer` is `sindhorn-betta-satellite-v1` and `getState().inputMode` is `satellite-only`.

## Performance contract

- one persistent WebGL canvas;
- fixed DPR 2;
- `antialias:false`;
- `preserveDrawingBuffer:false` for live rendering;
- visibility pause/resume;
- 1–2 major membrane draws for current baselines;
- zero WebGL image textures for the Betta itself;
- no post-processing chain, video, GIF or prerendered animation.

The JMA images are temporary CPU analysis inputs and are never displayed or uploaded as WebGL textures.

## Recovery

The retired weather WebGL is recoverable only from Supabase archive `legacy-weather-webgl-20260831` or immutable Git history at `29b0c99941163582b84d376982e459fdf6ead85b`. Reintroducing it into the app requires a new explicit product decision and a new preview/validation cycle.
