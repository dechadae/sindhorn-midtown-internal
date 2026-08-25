# Realtime Environment Plan

This specialist document is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Product direction

The Sindhorn Midtown app should feel like a premium environmental utility rather than a dashboard. The WebGL atmosphere is the persistent visual surface across the entire app while HTML remains the functional/information layer.

## Persistent-shell rule

The Three.js/WebGL engine belongs to the stable Cloudflare bootstrap shell and is created once per app session. Today / Guidance / Details content may change from the Supabase Sindhorn UI pack without restarting the renderer.

Atmosphere **art-direction parameters** should be remotely configurable through the validated Supabase app pack wherever practical. Core shader/renderer executable code stays in GitHub/Cloudflare.

## UI rule for the WebGL environment

- The atmosphere is the background of the entire app.
- PM2.5, AQI, status, guidance, controls and supporting information sit above it as HTML.
- Do not use opaque dashboard cards behind PM2.5, AQI or status merely to hide rendering problems.
- Use typography, spacing and fine translucent rules for hierarchy.
- Preserve accessible contrast with restrained scrims/glass only where necessary.
- WebGL remains progressive enhancement; HTML data and controls must remain usable if WebGL fails.

## Independent realtime inputs

The visual environment is the result of three independent real-world systems.

### 1. Bangkok astronomy

Use Sindhorn Midtown's Bangkok coordinates and local time to calculate:

- solar altitude;
- solar azimuth;
- day / twilight / night state;
- lunar altitude/azimuth;
- approximate lunar phase/illumination.

Pollution must never change the physical position of the sun or moon.

### 2. Weather

Open-Meteo supplies weather fields that materially affect the scene:

- weather code;
- cloud cover;
- precipitation/rain/showers;
- humidity;
- wind speed;
- wind direction;
- gusts where useful;
- visibility;
- temperature/apparent temperature;
- observation day/night state.

Weather is resolved **before** pollution optics.

Weather-code state must visibly agree with the rendered scene:

- clear = genuinely clear unless haze reduces clarity;
- partly cloudy = visible moving cloud masses plus open sky;
- overcast = dense connected cloud deck, never visually clear;
- rain = cloud structure plus visible precipitation;
- thunderstorm = dense/darker cloud field with restrained illumination;
- fog = low-contrast weather veil distinct from PM2.5 haze.

If weather data is unavailable and there is no valid cache, do not invent weather. Fall back to astronomy + PM2.5 optics only.

### 3. Air quality

AirBKK remains authoritative for PM2.5 / Thai AQI. Pollution affects atmospheric optics rather than inventing weather:

- haze / extinction;
- Mie-like sun/moon diffusion;
- blue-sky saturation loss;
- horizon visibility;
- distant contrast;
- pollution tint;
- suspended particulate.

Example: clear weather at noon with hazardous PM2.5 still shows the real high noon sun, but through a grey/desaturated polluted atmosphere rather than a clean blue sky.

## Required rendering stack

```text
REAL WEATHER
    ↓
SKY
    ↓
CLOUDS
    ↓
SUN / MOON
    ↓
RAIN / STORM / FOG
    ↓
PM2.5 OPTICAL HAZE + PARTICLES
    ↓
HTML UI
```

PM2.5 is always the final atmospheric modifier, never the weather generator.

## Cloud authority

Clouds must be a clearly visible rendering layer rather than subtle background noise.

Use multiple procedural depth scales where practical:

- broad low-frequency cloud bodies;
- mid-scale shape variation;
- fine edge structure;
- different movement rates for depth;
- wind-driven direction/speed;
- cloud-cover-driven occupied sky area;
- sun/moon edge illumination;
- sufficient night luminance contrast.

Overcast should produce broad connected structure rather than sparse isolated cloud sprites.

## Celestial authority

- high-precision anti-aliased sun/moon edges;
- no pixelated sprite appearance;
- halo/diffusion responds to humidity and PM2.5;
- clouds may occlude/diffuse celestial bodies;
- clear sky yields a crisper disc;
- overcast can substantially obscure it.

## Block/banding prohibition

The renderer must look like one uninterrupted sky with no square/rectangular atmosphere region, tonal panel or visible compositing boundary.

QA must inspect:

- canvas dimensions vs viewport;
- aspect-ratio math;
- screen-coordinate gradients;
- large-scale procedural tiling;
- CSS canvas transforms;
- fixed-layer compositing;
- interaction with translucent UI surfaces.

## Data-transition rule

Never animate through fabricated PM2.5/AQI numbers. Numeric readings replace/crossfade directly. The WebGL atmosphere may interpolate visually after genuine data changes.

## Rendering fidelity authority

The user explicitly requires the same visual quality target on mobile and desktop.

Do not improve mobile performance by lowering:

- renderer DPR relative to desktop;
- cloud complexity;
- visible animation cadence;
- celestial quality;
- tilt behavior.

Improve performance by removing waste instead:

- no full-page CSS blur/filter transitions;
- minimize nested backdrop filters;
- keep only the active route fragment mounted;
- avoid duplicate large raster layers;
- stop rendering only when the document is actually hidden.

## Mobile tilt

Tilt is always part of the visual system where available.

- Android/device-orientation capable browsers attach continuously.
- iOS/iPadOS requests DeviceOrientation permission from the first valid user gesture as required by the platform; once granted, keep it active.
- Tilt may subtly affect cloud/celestial/haze parallax, not the HTML interface.

## Full-page capture

The Save action captures the complete Today route as a long PNG using the live HTML composition plus a full-resolution render of the same current environment state.

Exclude:

- masthead/header;
- sticky navigation/footer;
- reference footer if present;
- Save control.

This is a web-app capture feature, not generative imagery.
