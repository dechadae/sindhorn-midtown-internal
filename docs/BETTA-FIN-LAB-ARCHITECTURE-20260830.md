# Betta Fin Lab Architecture — 2026-08-30

Status: branch-only visual R&D. This document does not authorize production integration.

## Product boundary

The experiment lives only at `/betta-fin-lab.html` on branch `betta-fin-lab`. It is not an authenticated app route, is not linked from navigation, and does not alter the persistent shell, production atmosphere, weather authority, F&B, Settings, Messages, authentication, capabilities, service worker, or Supabase presentation data.

Production remains the Bangkok seasonal/weather atmosphere until explicit visual approval.

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

The motion is intentionally non-looping. There is no animation clip, timeline, modulo loop, or repeated keyframe sequence.

Two systems combine:
1. Multi-scale 3D simplex noise is sampled with continuously advancing time at non-matching spatial/temporal scales. It drives broad curl, secondary folds, low-frequency turbulence and tip flutter.
2. A stochastic "living current" chooses a new direction and strength after irregular 13–42 second intervals using `crypto.getRandomValues()`. The current is low-pass interpolated, so changes feel like slow underwater pressure rather than random jumps.

Each membrane layer has its own seed and phase. Pointer drag adds a decaying current impulse. Device tilt is opt-in and intentionally weak.

The practical goal is an indefinitely evolving field with no designed repeat point. It is living art, not a canned loop.

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
- procedural micro-variation.

No texture images are used. No video, GIF, animated WebP, prerendered loop, or copied fish asset is involved.

"Optical glow" is implemented as selective highlight energy inside the membrane shader. A full-screen bloom pass is deliberately excluded from v1 because it adds another render target, bandwidth, battery cost, and blur overdraw on Android. It can be reconsidered only if visual review shows that the shader-local glow is insufficient.

## Transparency strategy

Version 1 uses conventional alpha blending, `depthTest:true`, `depthWrite:false` and explicit render order between the 1–2 large membrane layers. This is a deliberate mobile-first compromise.

Weighted blended OIT or depth peeling would improve order-independent transparency but adds buffers/passes and is not justified before visual acceptance. The compositions are designed so most self-overlap remains legible without requiring OIT.

## Curated presets

### 01 · Cobalt Veil
One huge lower-right fin; sparse open rays; cobalt → violet → magenta; substantial negative space.

### 02 · Crimson Silk
Two opposing membranes; denser fold topology; warmer absorption; stronger overlap and fold highlights.

### 03 · Turquoise Drift
Two staggered cool membranes at different depth/rotation; slower current and a central dark cleft.

### 04 · Midnight Plum
One near-frame-filling fold in burgundy/plum/coral; lowest brightness and activity; designed as the most restrained Sindhorn-aligned route-background candidate.

These are composition presets, not colour swaps: layer count, position, scale, rotation, curl, twist, depth, fold density, turbulence and motion character all differ.

## Performance contract

The lab preserves the production renderer hypotheses that matter:
- fixed device pixel ratio 2;
- `antialias:false`;
- `preserveDrawingBuffer:false`;
- `powerPreference:'high-performance'`;
- animation is cancelled while the document is hidden and resumed without integrating the hidden-time gap;
- no texture allocations in the fin system;
- 1–3 major draw calls;
- no postprocessing chain in v1.

CI validates syntax, protected-file diffs, deployment, WebGL creation, DPR, draw calls, triangle budget and screenshots at 390×844 and 1440×1000. SwANGLE frame timing is diagnostic only; physical Android GPU frame pacing and battery behaviour remain a human/device acceptance check.

## Why Three.js

Three.js materially improves maintainability here: it owns WebGL context setup, matrices, `BufferGeometry`, render ordering, resize lifecycle and diagnostics. The visual character still comes from original custom GLSL and original procedural geometry; Three.js is the scene/render framework rather than the effect itself.
