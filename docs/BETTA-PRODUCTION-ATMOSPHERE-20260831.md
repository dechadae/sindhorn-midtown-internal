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

The Betta renderer must not use TMD station observations, MET Norway model fields, Open-Meteo, AirBKK, device geolocation, device orientation, calculated astronomy, local clock time, microphone, camera or other device sensors as live visual inputs.

Its satellite controls are derived from JMA Himawari-9 HA1 B13 infrared, B08 water-vapour and B03 visible imagery, including consecutive-frame cloud-field change/motion, image structure, visible spectral bias and a deterministic observation fingerprint.

Procedural GLSL noise is the organism's internal continuous motion between satellite observations and is not represented as external evidence.

## Weather and air-quality remain data/UI

The existing production authorities continue unchanged for operational information:

- TMD AWS current weather through `sindhorn-weather-core`;
- MET Norway supporting cloud/forecast fields through that weather core;
- `sindhorn-rain-now` for current rain authority/data;
- AirBKK for PM2.5/AQI.

`site/betta-environment.js` continues to render the Today weather card through the existing legacy fetch contract intercepted by `site/location.js`; those values never enter the Betta shader.

## Legacy background code — retained intentionally

The previous weather-driven background is not deleted.

- `site/environment.js` remains the full Bangkok seasonal/weather WebGL renderer and rollback reference.
- `site/atmosphere-shader.js` remains its weather/sky shader.
- `site/seasonal-sky.js` remains its seasonal Bangkok sky profile.
- `site/rain-layer-legacy-weather.js` preserves the previous rain overlay implementation verbatim.
- `site/rain-layer.js` is now a compatibility no-op so ground/model rain cannot alter the active Betta visual.

These legacy files are not the default visual runtime. They may be used for rollback/research only and must not be silently re-enabled alongside Betta because two persistent WebGL/weather visual systems would waste GPU/battery and violate the satellite-only visual contract.

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

## Rollback

A renderer rollback can switch bootstrap back from `./betta-environment.js` to `./environment.js` and restore the legacy rain-layer entry point. Weather-data authority does not need to change for that rollback because it remains operational throughout this release.
