# Realtime Environment Plan

## Product direction

The PM2.5 app should feel like a premium environmental utility rather than a dashboard. The approved v5 information architecture remains the baseline, but the WebGL atmosphere becomes the primary visual surface.

## UI rule for the WebGL redesign

- The atmosphere is the background of the entire app.
- PM2.5, AQI, status, guidance, controls and supporting information sit directly above the atmosphere as HTML.
- Do not use filled color cards/panels behind PM2.5, AQI or status.
- Use typography, spacing and fine translucent rules for hierarchy.
- Keep semantic AQI color only as restrained accent information, not as a large panel fill.
- Preserve accessible contrast with a subtle global atmospheric scrim rather than local boxes.
- The WebGL scene remains progressive enhancement; if it fails, the approved v5 HTML/CSS fallback remains usable.

## Independent realtime inputs

The visual environment is the result of three independent real-world systems.

### 1. Bangkok astronomy

Use Sindhorn Midtown's Bangkok coordinates and Bangkok local time to calculate:

- solar altitude
- solar azimuth
- day / twilight / night state
- eventual moon placement

Pollution must never change the physical sun position.

### 2. Weather

A weather provider should supply only observed/forecast fields that materially affect the scene:

- cloud cover
- precipitation
- humidity
- wind speed
- wind direction
- visibility
- temperature
- observation time

Do not invent cloud, rain or storm conditions when weather data is unavailable.

### 3. Air quality

AirBKK remains authoritative for PM2.5 / Thai AQI. Pollution should affect atmospheric optics rather than weather state:

- haze / extinction
- Mie-like sun diffusion
- blue-sky saturation loss
- horizon visibility
- distant contrast
- pollution tint

Example: clear weather at noon with hazardous PM2.5 still shows the real high noon sun, but through a grey/desaturated polluted atmosphere rather than a clean blue sky.

## Data-transition rule

Never animate through fabricated PM2.5/AQI numbers. Numeric readings replace/crossfade directly. The WebGL atmosphere may interpolate visually after a genuine observation changes.

## Rendering fidelity authority

- HTML remains the functional layer, but the visible WebGL environment must use the same quality target on mobile and desktop.
- Renderer DPR is fixed at 2 for the current app; do not reduce quality based on device-memory or hardware-concurrency heuristics.
- Render ambient motion on every display-synchronised animation frame while the app is visible.
- Do not disable atmospheric motion because of `prefers-reduced-motion`; the user explicitly chose a continuously living environmental surface.
- Stop rendering when the document is actually hidden.
- Mobile tilt is always part of the visual system. Android/device-orientation capable browsers attach immediately; iOS requests orientation permission from the first user gesture as required by the platform.
- Weather resolves first. Clouds, overcast, fog, rain and storm state must be visibly represented from the weather code and cloud cover before any PM2.5 optics are applied.
- PM2.5 is a final optical layer: haze, saturation/contrast loss, solar diffusion and suspended particulate. It never invents cloud/rain/weather.
- Celestial edges must be high precision and anti-aliased; the moon must not degrade to a pixelated sprite.

## Current preview status

The experimental branch `webgl-environment-v1` currently implements:

- real Bangkok solar position
- live AirBKK-driven pollution optics
- full-viewport fixed WebGL atmosphere
- transparent information surfaces over the atmosphere
- no colored PM2.5/AQI/status cards
- weather-provider interface with cloud/rain disabled when the provider is unavailable

Do not merge the experimental branch into production until visual direction and weather-provider behavior are approved.

## Full-page capture

The Save action captures the complete Today route as a long PNG using the live HTML composition plus an offscreen full-resolution render of the same current environment state. It excludes the masthead, sticky navigation/footer, reference footer and Save control. This is a web-app capture feature, not generated imagery.
