# Betta Fin Lab Architecture — 2026-08-30

Status: branch-only visual R&D. This document does not authorize production integration.

## Product boundary

The experiment lives only at `/betta-fin-lab.html` on branch `betta-fin-lab`. It is not an authenticated app route, is not linked from navigation, and does not alter the persistent shell, production atmosphere, weather authority, F&B, Settings, Messages, authentication, capabilities, service worker, or Supabase presentation data.

Production remains the Bangkok seasonal/weather atmosphere until explicit visual approval.

## Real-world input authority — satellite only

The visual experiment has one real-world input authority: current Himawari-9 satellite imagery over Bangkok, delivered by NICT from JMA Himawari observations.

The lab deliberately does **not** read or infer its live state from:
- TMD ground stations;
- MET Norway or any other numerical weather model;
- Open-Meteo;
- AirBKK / PM2.5;
- device geolocation;
- accelerometer / device-orientation / tilt;
- calculated sun position, clock time, or astronomy;
- microphone, camera, touch motion, or any other device sensor.

Procedural GLSL noise remains part of the organism's internal continuous motion, but it is not treated as real-world evidence. The satellite observation changes the target state; the procedural system supplies smooth biological evolution between observations.

## Himawari signal pipeline

The branch-only Cloudflare Pages worker exposes a locked-down same-origin endpoint at `/api/betta-satellite`. It is not a general proxy. It can request only the predefined NICT Himawari image products required by this experiment.

For each new observation, the browser analyzes a Bangkok-centered image patch from:

1. **B13 thermal infrared (~10.4 µm), current frame** — principal cloud morphology / cold-cloud signal.
2. **B13 thermal infrared, previous 10-minute frame** — used with the current frame for cloud-field displacement and change.
3. **B08 upper-level water-vapour band (~6.2 µm)** — atmospheric moisture texture and secondary membrane response.
4. **True-colour imagery** — contributes spectral colour only when the visible image contains enough daylight signal to be meaningful.

No satellite image is rendered as a background or used as a WebGL texture. The images are temporary analysis inputs; the visible artwork remains original procedural geometry and GLSL.

## Derived satellite state

The image analyzer derives normalized artistic-control signals rather than claiming meteorological products it does not possess:

- **cloud amount** — distribution of bright/cold cloud structure in the Bangkok IR patch;
- **cold-cloud index** — relative upper-tail IR intensity used as a convective/cold-cloud structural cue;
- **cloud change / cooling index** — change between consecutive B13 distributions;
- **cloud texture** — local gradient complexity;
- **cloud-motion vector** — best-fit frame-to-frame displacement from normalized patch correlation;
- **water-vapour index** — B08 brightness/texture response;
- **visible colour + confidence** — current satellite RGB bias only when visible light is present;
- **satellite fingerprint** — deterministic hash-derived values from the actual B13/B08 pixels so each observation can alter the organism's trajectory even when broad aggregate metrics are similar;
- **energy** — a bounded artistic state derived only from those satellite-image metrics.

These values are intentionally described as artistic controls, not as official quantitative cloud cover, wind, rainfall, humidity, or temperature measurements.

## Satellite → organism mapping

The satellite does not command individual frames. It changes a target biological state that the renderer approaches smoothly.

- Cloud-field displacement biases the direction of whole-fin bending and large folds.
- Satellite energy changes the visible pace and amplitude of broad morphology, not only tip flutter.
- Cloud texture changes fold complexity.
- Cold-cloud/change signals increase large-scale tension and transient deformation.
- Water-vapour structure changes curl, depth and colour response.
- Visible spectral colour, when available, gently biases the curated Betta palette.
- At night, colour bias is constructed only from infrared/water-vapour satellite structure plus the preset palette; no clock or astronomy is introduced.
- The satellite fingerprint modifies morphology and colour phase so consecutive observations create distinct target states without introducing an unrelated random real-world driver.

The observation cadence is approximately ten minutes. The client polls more frequently for a new timestamp but applies a state only when a genuinely new satellite observation appears.

If the satellite source is temporarily unavailable, the lab does not switch to a ground station or model. It retains the last valid target when one exists and reports the satellite signal problem; before the first valid signal it runs only its neutral internal organism state while visibly reporting that the satellite is connecting/retrying.

## GSMaP rainfall status

Satellite precipitation is conceptually compatible with this architecture, but it is not part of the current implementation. JAXA GSMaP numerical products require their legitimate registered data-access route. The lab therefore does not scrape a visualization or substitute model/ground rainfall merely to obtain a precipitation number.

If GSMaP is added later, it must remain a satellite-observation input and must preserve the satellite-only contract.

## Geometry architecture comparison

### 1. Three.js ribbon / spline mesh
Useful for a long strip, but a betta caudal fin is a radial membrane. A spline ribbon tends to read as fabric, seaweed, or a banner and makes fin-ray structure artificial.

### 2. Custom indexed membrane mesh with CPU deformation
Provides the correct radial topology and deterministic folds, but continuously updating thousands of vertices on the CPU is unnecessary work for a persistent mobile background and makes multi-scale motion harder to keep fluid.

### 3. GPU vertex displacement on generic geometry
Efficient and expressive, but a generic grid does not carry the biological topology. Even good noise can still read as waving cloth because there is no root-to-ray structure.

### 4. Shader-generated / implicit procedural membrane
Can minimize vertices, but deriving a convincing folded 3D translucent membrane, depth ordering, and physical silhouette entirely in the fragment shader increases fragment cost and drifts toward abstract SDF/smoke aesthetics.

### 5. Hybrid indexed radial membrane + GPU deformation + custom GLSL — selected
The selected system uses Three.js for `BufferGeometry`, camera, scene lifecycle and rendering, with a custom indexed radial topology and GLSL deformation/material. This gives:
- real root → radial ray → stretched membrane structure;
- broad curl/twist and secondary fold motion in the vertex stage;
- very small CPU animation cost;
- controlled 1–3 draw calls;
- explicit 3D depth for overlap;
- a dedicated thin biological membrane material rather than a generic cloth material.

## Living-organism motion model

There is no animation clip, timeline, modulo loop, repeated keyframe sequence, video or prerendered asset.

The current system combines:
1. Multi-scale 3D simplex noise sampled with continuously advancing time at non-matching spatial/temporal scales. It drives broad curl, secondary folds, low-frequency turbulence, radial breathing and tip flutter.
2. The latest Himawari-derived target state, which biases energy, direction, form complexity, colour and the trajectory of that continuous field.
3. Smooth low-pass transitions between satellite observations, with extra transition energy when a newly observed satellite frame materially changes the state.

Each membrane layer has its own seed and phase. There is no pointer-drag current and no device-tilt influence in the satellite-only version.

The practical goal is an indefinitely evolving field with no designed repeat point. Finite-precision hardware cannot guarantee mathematical uniqueness forever, so the correct claim is a practically non-repeating generative organism, not literal infinite uniqueness.

## Geometry budget

Default radial subdivisions are 72 root-to-tip segments with 32–80 fin-ray segments. A 56-ray fin is about 4,161 vertices and 8,064 triangles. Presets use one or two major membranes, so the visual system normally remains within 1–2 draw calls and roughly 8k–19k triangles.

Changing the Ray Count control rebuilds the shared indexed geometry and disposes the previous geometry to prevent tuning-session leaks.

## Thin-membrane material

The ShaderMaterial is double-sided, alpha blended, depth tested and depth-write disabled. It combines:
- view-angle Fresnel response;
- non-uniform alpha;
- fin-ray ridge highlights;
- fold-dependent wrap light;
- controlled internal colour absorption/transmission approximation;
- subtle iridescent channel shift;
- restrained edge response;
- procedural micro-variation;
- a restrained colour bias derived from the current satellite state.

No texture images are used by the WebGL renderer. No video, GIF, animated WebP, prerendered loop, or copied fish asset is involved.

"Optical glow" is implemented as selective highlight energy inside the membrane shader. A full-screen bloom pass remains excluded because it adds another render target, bandwidth, battery cost and blur overdraw on Android.

## Transparency strategy

The lab uses conventional alpha blending, `depthTest:true`, `depthWrite:false` and explicit render order between the 1–2 large membrane layers. This is a deliberate mobile-first compromise.

Weighted blended OIT or depth peeling would improve order-independent transparency but adds buffers/passes and is not justified before visual acceptance. The compositions are designed so most self-overlap remains legible without requiring OIT.

## Curated presets

### 01 · Cobalt Veil
One huge lower-right fin; sparse open rays; cobalt → violet → magenta; substantial negative space.

### 02 · Crimson Silk
Two opposing membranes; denser fold topology; warmer absorption; stronger overlap and fold highlights.

### 03 · Turquoise Drift
Two staggered cool membranes at different depth/rotation; a central dark cleft.

### 04 · Midnight Plum
One near-frame-filling fold in burgundy/plum/coral; designed as the most restrained Sindhorn-aligned route-background candidate.

These remain art-direction/base-composition presets. Live variations within a preset come from the Himawari-derived target state, not from choosing different weather providers.

## Performance and validation contract

The lab preserves the production renderer hypotheses that matter:
- fixed device pixel ratio 2;
- `antialias:false`;
- `preserveDrawingBuffer:false`;
- `powerPreference:'high-performance'`;
- animation is cancelled while the document is hidden and resumed without integrating the hidden-time gap;
- zero WebGL texture allocations for the fin renderer;
- 1–3 major draw calls;
- no postprocessing chain.

CI now validates not only frames-per-second mechanics but the real satellite path:
- the branch worker must return current Himawari-9 metadata;
- the browser must decode current B13, previous B13, current B08 and true-colour imagery;
- the observation timestamp must be fresh;
- satellite metrics must be finite and bounded;
- the runtime must declare `satellite-only`;
- contract checks reject TMD, MET Norway, Open-Meteo, AirBKK, geolocation and device-orientation dependencies;
- the WebGL canvas is captured twice 1.2 seconds apart and fails if the rendered image is identical;
- DPR, draw calls, triangle budget, context flags and zero WebGL-texture budget remain validated.

SwANGLE timing in CI is diagnostic only. Physical Android GPU frame pacing, battery behavior and — most importantly — human judgment of whether the satellite-driven morphology is sufficiently alive remain acceptance criteria.

## Why Three.js

Three.js materially improves maintainability here: it owns WebGL context setup, matrices, `BufferGeometry`, render ordering, resize lifecycle and diagnostics. The visual character still comes from original custom GLSL and original procedural geometry; Three.js is the scene/render framework rather than the effect itself.
