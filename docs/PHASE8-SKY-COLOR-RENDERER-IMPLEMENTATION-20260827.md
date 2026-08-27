# Phase 8 — Live sky color renderer implementation

**Date:** 27 August 2026  
**Status:** Phase 8 implementation record  
**Branch:** `phase8-directional-sky-calibration`

## Decision

The directional Bangkok camera calibration vector is applied as a **persistent calibrated color-compositing layer** above the physical WebGL atmosphere and below precipitation overlays.

This is intentionally separate from the weather/astronomy shader. It preserves the architecture rule that:

- Open-Meteo determines physical weather state;
- local astronomy determines sun/moon position and twilight geometry;
- AirBKK determines PM2.5 / Thai AQI;
- directional Bangkok cameras calibrate the *observed visible color and atmosphere* only.

The camera layer never decides whether it is raining, overcast, foggy or storming and never changes PM2.5 values.

## Why a compositor instead of replacing the physical shader

The existing atmosphere shader already has validated weather, cloud, celestial, fog, rain and PM2.5 behavior. Replacing its sky palette directly with camera RGB would couple a fallible external visual source to the physical renderer.

The Phase 8 compositor instead:

1. keeps the physical renderer authoritative underneath;
2. receives only the validated numerical calibration vector;
3. blends observed zenith and horizon RGB conservatively;
4. uses stronger influence around directional sunrise/sunset windows;
5. clears itself immediately when calibration is stale or low-confidence;
6. costs no continuous animation work because it redraws only on calibration/resize;
7. can be removed/fallback independently without restarting the WebGL engine.

This also satisfies the no-blocky-boundary rule because the compositor covers the same full environment viewport and contains no panels, images, filters or camera frames.

## Layer order

```text
physical WebGL weather / astronomy / PM2.5 atmosphere
→ existing structural atmosphere veil
→ live Bangkok sky color compositor
→ snow / hail / rain / storm optical layers
→ HTML UI
```

The compositor is a transparent full-viewport canvas. It never displays a source camera image.

## Color policy

The worker supplies:

- `zenithRgb`
- `horizonRgb`
- luminance
- saturation
- warmth
- cloud opacity/darkness
- haze
- horizon contrast
- sun glow
- confidence and source weights

The client uses zenith/horizon RGB for the color compositor while the existing Phase 8 calibration client continues to use cloud evidence for conservative cloud opacity/contrast/edge-light adjustment.

Maximum color influence is deliberately capped:

- sunrise-east / sunset-west: 46%
- twilight: 34%
- normal daytime consensus: 28%
- night: 16%

Actual influence is multiplied by fused confidence, so a weak observation has little or no visible effect.

## Capture parity

`site/sky-color-renderer.js` wraps the existing `SindhornEnvironment.renderExport()` output and applies the same calibration gradient to saved full-page atmosphere exports. The saved image therefore uses the same live calibration as the visible PWA rather than falling back to the uncalibrated base renderer.

If the compositor or export wrapping fails, the original physical atmosphere export is returned unchanged.

## PWA / offline behavior

- `site/sky-color-renderer.js` is part of the v21 service-worker shell cache.
- Cached calibration may be used only within the existing short grace window.
- Stale/no-confidence calibration clears the compositor.
- Failure of the sky Worker never blocks app boot, weather, AirBKK, navigation, push, capture or offline recovery.
- No reinstall is required.

## Release gate

Before merge to `main`:

1. syntax-check the calibration and color-renderer clients;
2. verify live preview sky Worker health;
3. deploy the branch Pages preview;
4. verify `sky-color-renderer.js` is served and referenced by the preview shell;
5. verify service-worker v21 precaches the renderer;
6. rerun the full Phase 8 directional camera evaluation and Pages smoke gate;
7. merge through PR only after both Phase 8 workflows pass;
8. verify production sky Worker and production Pages promotion after merge;
9. run launch-hardening against the unchanged PWA identity and active Supabase Pack 37.

## Acceptance

Phase 8 color calibration is accepted when:

- east-facing evidence dominates sunrise mode;
- west-facing evidence dominates sunset mode;
- the visible PWA receives the fused Bangkok zenith/horizon colors;
- the physical weather state remains visibly correct underneath;
- a stale/offline camera system visibly falls back without breaking the app;
- saved full-page output matches the calibrated live atmosphere;
- mobile quality is unchanged from desktop.
