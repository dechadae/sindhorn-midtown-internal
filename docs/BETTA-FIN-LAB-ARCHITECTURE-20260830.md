# Betta Fin Lab Architecture — 2026-08-30

Status: branch-only visual R&D. This document does not authorize production integration.

## Product boundary

The experiment lives only at `/betta-fin-lab.html` on branch `betta-fin-lab`. It is not linked from production navigation and does not alter the persistent shell, production atmosphere, weather authority, F&B, Settings, Messages, authentication, capabilities, service worker, or Supabase presentation data.

Production remains unchanged until explicit approval and a separate integration decision.

## Real-world input authority — satellite only

The visual experiment has one real-world input authority: **JMA Himawari-9 High-Resolution Asia 1 imagery over Bangkok**.

The lab deliberately does not read or infer its live state from TMD ground stations, MET Norway, Open-Meteo, AirBKK / PM2.5, device geolocation, accelerometer / device orientation, astronomy, microphone, camera, touch motion, or other device sensors.

Procedural GLSL noise remains the organism's internal continuous motion. It is not treated as real-world evidence. Satellite observations change the target state; the procedural system supplies smooth biological evolution between observations.

## Himawari signal pipeline

The branch-only Cloudflare Pages worker exposes a locked-down same-origin endpoint at `/api/betta-satellite`. It can request only the required JMA High-Resolution Asia 1 products.

The sector covers 99°E–110°E and 16°N–7°N, which contains Bangkok. For each new observation, the browser analyzes a Bangkok-centered patch from:

1. **B13 thermal infrared**, current frame — principal cloud morphology / cold-cloud structural signal.
2. **B13 thermal infrared**, previous 10-minute frame — used for cloud-field displacement and change.
3. **B08 water-vapour imagery** — atmospheric moisture texture and secondary membrane response.
4. **B03 visible imagery** — contributes spectral colour only when the visible signal is strong enough to be meaningful.

JMA reuses HHMM image filenames each day, so the worker validates upstream `Last-Modified` freshness before accepting a frame. CI also rejects spatially degenerate B13 or B08 Bangkok patches.

No satellite image is rendered as a background or WebGL texture. The visible artwork remains original procedural geometry and GLSL.

## Derived satellite state

The analyzer derives bounded artistic-control signals rather than claiming official meteorological quantities:

- cloud-field amount / structure;
- cold-cloud index;
- frame-to-frame change index;
- cloud texture;
- best-fit cloud-motion vector;
- water-vapour index;
- visible colour + confidence;
- deterministic satellite fingerprint from B13/B08 pixels;
- artistic energy state derived only from satellite-image metrics.

These values are artistic controls, not official cloud-cover, wind, rainfall, humidity, or temperature measurements.

## Satellite → organism mapping

The satellite does not command individual frames. It changes a target biological state that the renderer approaches smoothly.

- Cloud-field displacement biases whole-fin bending and large folds.
- Satellite energy changes the pace and amplitude of broad morphology.
- Cloud texture changes fold complexity.
- Cold-cloud/change signals increase structural tension and transient deformation.
- Water-vapour structure changes curl, depth and iridescence.
- B03 visible colour gently biases the selected Betta colour family when daylight signal is usable.
- At night, colour bias comes only from infrared/water-vapour structure plus the selected Betta baseline.
- The satellite fingerprint changes morphology and colour phase so consecutive observations create distinct target states.

The observation cadence is approximately ten minutes. The client polls more frequently but applies a state only when a new satellite observation appears.

If the satellite source is temporarily unavailable, the lab does not switch to a ground station or model. It retains the last valid state when available; before the first valid state it uses only the neutral internal organism motion while reporting that the satellite signal is retrying.

## Biological colour authority

The colour hierarchy is now:

**real Betta splendens colour morph baseline → satellite bias inside that biological family → membrane lighting / iridescence**

The satellite is no longer allowed to pull a fish arbitrarily into unrelated hues. It can influence gradient position, brightness, saturation, iridescence and a restrained spectral tint while the biological morph remains recognizable.

No fish photograph is copied, sampled as a runtime texture, or included as an asset. Real Betta photographs and established ornamental-Betta colour categories are used only as visual reference for palette and pattern design.

### Eight current biological baselines

1. **Royal Blue Halfmoon** — deep navy through saturated royal and electric blue.
2. **Super Red Halfmoon** — near-monochrome scarlet/crimson with darker red folds.
3. **Mustard Gas** — steel/royal-blue root transitioning into mustard-yellow and warm gold fins.
4. **Black Orchid** — near-black membrane with blue-black iridescence and steel-blue ray highlights.
5. **Copper Metallic** — graphite / bronze / copper with pale metallic flashes.
6. **Turquoise Metallic** — deep blue-green through turquoise and bright metallic aqua.
7. **Nemo Galaxy Koi** — irregular orange, red, cream and dark patches with sparse electric-blue flecks.
8. **Red Snow Dragon** — pearl-white / silver inner membrane breaking irregularly into red outer fin zones.

Morph-specific GLSL adds restrained biological patterning where a simple linear gradient would be insufficient:

- Nemo Galaxy Koi uses low-frequency irregular colour zones, dark patches and sparse galaxy flecks.
- Red Snow Dragon uses an irregular pearl-to-red boundary with ray structure retained in the pale zone.
- Mustard Gas uses a strongly root-to-tip bicolour transition.
- Black Orchid emphasizes blue light along fin-ray structure.
- Copper Metallic adds view/ray-dependent metallic highlights.

## Geometry architecture

The selected system remains a hybrid custom indexed radial membrane + GPU deformation + custom GLSL material, with Three.js providing scene, camera, `BufferGeometry`, renderer lifecycle and diagnostics.

This gives root → radial ray → membrane topology, broad curl/twist, low CPU animation cost, explicit 3D overlap, and a thin biological membrane instead of a generic cloth surface.

## Living-organism motion model

There is no animation clip, repeated keyframe sequence, video or prerendered loop.

The current system combines:

1. multi-scale 3D simplex noise with continuously advancing time;
2. the latest Himawari-derived target state;
3. smooth low-pass transitions between observations, with extra transition energy when a new satellite frame materially changes the state.

Each membrane layer has its own seed and phase. The practical goal is a continuously evolving, practically non-repeating organism.

## Material and transparency

The ShaderMaterial is double-sided, alpha blended, depth tested and depth-write disabled. It combines view-angle Fresnel response, fin-ray ridge highlights, fold-dependent wrap light, controlled membrane absorption/transmission, restrained iridescence, micro-variation and the current biological morph pattern.

There are zero WebGL texture allocations for the fin. No video, GIF, animated WebP, prerendered loop or copied fish asset is involved.

The lab uses conventional alpha blending and explicit render order between one or two large membrane layers. OIT remains excluded until visual need justifies the mobile cost.

## Performance and validation contract

The lab preserves:

- fixed DPR 2;
- `antialias:false`;
- `preserveDrawingBuffer:false`;
- `powerPreference:'high-performance'`;
- animation pause while hidden;
- zero WebGL texture allocations;
- 1–3 draw calls;
- no post-processing chain.

CI validates:

- current JMA Himawari-9 metadata and freshness;
- B13/B08/B03 decoding around Bangkok;
- non-degenerate IR and water-vapour pixel variation;
- satellite-only runtime declaration;
- rejection of ground/model/device inputs;
- all eight biological baselines can be activated and rendered;
- morph-mode shader data is present;
- WebGL canvas visibly changes across a 1.2-second probe;
- DPR, draw calls, triangle budget, context flags and zero-texture budget.

SwANGLE timing in CI is diagnostic only. Physical Android GPU behavior and human visual judgment remain the acceptance criteria.
