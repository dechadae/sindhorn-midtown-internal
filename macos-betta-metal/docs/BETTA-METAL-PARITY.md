# Sindhorn Betta — WebGL → Metal parity contract

## Canonical source snapshot

Production PWA visual authority: `b5cf2b1e021d2bd9bc93dff7e28aaf6dd22e41ab`.
Android native implementation reference: `android-betta-wallpaper@7cbd44faca97f763065d194884be935ae95dd106`.

## Preserved exactly

- Shared live topology: 80 rays × 72 radial membrane segments; two translucent membrane layers.
- All per-reference morphology, membrane, palette, gradient, scale, XYZ rotation/placement and layer seed/phase/offset/alpha values.
- 32° vertical FOV, near `0.1`, far `50`, landscape camera Z `9`.
- Fin normals with `eU=.0065`, `eV=.0045`; same simplex-noise constants and three-octave noise field.
- Same morph modes, Koi/Pearl logic, rim/fold/transmission/alpha equations.
- Cubic ease-out `1-(1-t)^3`, correction morph `0.9 s`, live rollover `60 s`, shared Betta/background morph progress.
- Neutral drivers: energy `.58`, cloud `.35`, cold `.35`, cooling `0`, texture `.32`, vapor `.42`, motion `0,0`, color `.18,.23,.52`, visible `0`, fingerprint `.5,.5,.5`.

Preset `rayCount` values remain metadata. Like current production, live topology is built once at maximum 80 rays so morphs never change topology.

## Color pipeline

Metal deliberately uses `bgra8Unorm`, not an sRGB target. Three.js colors and Android parity data are linearized from the approved hex values. The background explicitly converts linear→sRGB, while the custom membrane fragment result is left unmodified, matching the approved native parity behavior and avoiding an automatic conversion that would brighten/change the fin.

## Landscape composition mapper

Portrait remains source art direction. The shared mapper uses a `9:16` reference frustum, converts each approved layer root into normalized portrait edge space, then reprojects that edge intent into landscape. Roots already beyond the portrait edge stay beyond the edge, with only their overhang compressed by `0.55` so the much wider frustum does not throw the organism away. Y, Z, rotations and scale relationships remain intact. This changes camera-relative translation, not geometry.

`LandscapeOverride` exists for tiny deltas after real-Mac review. Phase 1 starts with **zero per-fish overrides**.

## Architecture

`BettaPreset`, `BettaMorphState`, `BettaGeometry`, `BettaRenderer`, `BettaLandscapeMapper`, `BettaDesktopWindow`, `BettaSettings`, and native `Shaders.metal`.

## Performance contract

Immutable geometry/index buffers, persistent pipelines/depth state, one command queue, triple-buffered reusable uniforms, no per-frame geometry allocation, no per-frame shader compilation, MTKView scheduling at 60 fps, 50 ms delta clamp. No initial reductions to rays, segments, layers, shader math or resolution.

## Desktop integration accuracy

This is a live desktop app, not a system live-wallpaper provider. Experimental desktop mode uses a borderless non-key mouse-ignoring AppKit window between the public Core Graphics desktop and desktop-icon levels with `canJoinAllSpaces`, `stationary`, and `ignoresCycle`.

## Phase-1 acceptance checklist

- [x] Native Swift/AppKit/MetalKit architecture.
- [x] Native MSL procedural membrane shader.
- [x] Exact eight production presets.
- [x] 80×72 shared geometry and two layers.
- [x] Deterministic neutral environment.
- [x] Shared background/Betta morph progress.
- [x] Eight manual states + live Bangkok schedule + three-minute preview.
- [x] True parameter/geometry/color/composition morphs, not crossfades.
- [x] Deterministic portrait→landscape mapper with zero overrides.
- [x] Reused uniforms/pipelines/geometry.
- [ ] Visual parity approved on real Mac display.
- [ ] Performance measured on target Mac hardware.
- [ ] Himawari live state ported (phase 2).
