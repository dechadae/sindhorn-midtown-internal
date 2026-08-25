# Real-Time Environment Plan

## Product goal

Evolve the approved Sindhorn Midtown PM2.5 utility into a premium, App-Store-quality environmental web app while preserving fast access to the actual air-quality information.

The WebGL scene is not decorative. It is a real-time environmental representation driven by independent physical inputs.

## Inputs

### 1. Air quality

Authoritative source: Bangkok Metropolitan Administration AirBKK.

Use PM2.5 and Thai AQI for factual values and for pollution-dependent atmosphere parameters.

Pollution affects:

- haze density
- atmospheric extinction / visibility
- Mie scattering
- sun diffusion / halo
- sky saturation
- distant contrast

Pollution never changes the calculated physical position of the sun or moon.

### 2. Weather

A weather source will supply only fields that materially affect the scene:

- condition
- cloud cover
- precipitation and intensity
- wind speed / direction
- visibility
- humidity
- temperature
- sunrise / sunset if useful for validation

Weather affects clouds, rain, storm state, wind-driven motion and baseline visibility.

### 3. Astronomy

Use Sindhorn Midtown coordinates and Bangkok time to calculate:

- solar elevation
- solar azimuth
- daylight / twilight state
- optional moon position and phase

Day/night is real-world state and is independent of the user's UI light/dark preference.

## Core composition rule

Build the base weather world first, then apply pollution as an atmospheric modifier.

Example: noon + clear weather + hazardous PM2.5 must show the sun high in the sky, but through a desaturated grey/beige haze with reduced visibility and softer shadows. It must not show a clean blue sky merely because the weather condition is `clear`.

Likewise, overcast weather with excellent air can be grey while remaining crisp and clean beneath the cloud layer.

## Rendering stack

1. Procedural sky / atmospheric shader.
2. Sun and optional moon based on astronomy.
3. Procedural/layered cloud system driven by cloud cover and wind.
4. Rain / storm layer when weather requires it.
5. Pollution haze and particulate scattering.
6. HTML UI above the WebGL canvas.

## Interaction and motion

- Current numeric PM2.5/AQI values replace directly with a crossfade. Never count through invented values.
- New air-quality state may interpolate environmental parameters over roughly 2–3 seconds.
- Weather transitions may be slower so cloud/rain changes feel natural.
- The live indicator should be steady normally and pulse once when genuinely fresh data arrives.
- UI press states and transitions should remain restrained and tactile.

## Performance

- Mobile first.
- Cap DPR on mobile.
- Avoid expensive volumetric raymarching unless benchmarked safe.
- Prefer procedural shaders and low geometry counts.
- Stop or heavily throttle rendering when document is hidden or the environmental hero is offscreen.
- Respect `prefers-reduced-motion`.
- Provide a static/CSS fallback with no loss of data or controls.

## Phases

1. Repository/deployment bootstrap.
2. Migrate approved PM2.5 v5 baseline unchanged in behavior.
3. Add unified environmental state layer.
4. Add astronomy + procedural sky + sun.
5. Add live weather feed and cloud/rain/wind behavior.
6. Add PM2.5 atmospheric scattering and visibility effects.
7. Add premium app interactions: one-shot live pulse, tactile controls, sticky summary, AQI detail sheet.
8. Cross-device performance and failure-mode QA.

## Non-goals

- No decorative 3D objects.
- No 3D text.
- No game-like camera movement.
- No generated-image pipeline as part of this development phase.
- No dependence on WebGL for essential air-quality information.
