# BETTA 1.0 Technical Release

Version: **1.0.0**  
Build: **20**

## Product promise

BETTA is living generative art rendered natively on macOS with AppKit, Metal and MetalKit. The release contains no browser renderer, video loop, GIF, generated Betta image, or prerendered fish fallback.

## Included in 1.0

### Living Gallery
- Eight immutable original Betta families.
- Favorites and exact saved presets.
- Random Betta with matching procedural gradient.
- Continuous Evolution.
- Use current organism on the desktop.
- Deliberate entry into Living Studio.

### Living Studio
- Native Liquid Glass surface on supported macOS versions with native AppKit fallback.
- 160 × 144 high-detail procedural membrane topology.
- Full camera controls.
- Full X/Y/Z composition rotation and positioning.
- 1–6 rendered membrane layers derived from two canonical membrane endpoints.
- Form, motion, optics, color and detail controls.
- Non-destructive Restore Original Colors Only.
- Favorites and named preset persistence.

### Motion
- 18-second manual/original/saved-preset morph.
- 90-second Bangkok live rollover.
- 12-second morph in the compressed three-minute day preview.
- Symmetric smootherstep easing for cinematic arrival/departure.
- Randomization and direct customization remain immediate.

### Atmosphere
- Bangkok Live mood sourced from JMA Himawari data.
- Infrared, water-vapor and true-color observations are reduced to environmental signals rather than displayed.
- Multi-minute smoothing prevents network-frame changes from becoming visual jumps.
- Deterministic neutral fallback remains available offline or when Himawari is disabled.

### macOS integration
- Persistent menu-bar controller.
- Launch at Login foundation through ServiceManagement.
- Adaptive 60/30/15 fps scheduling and hidden-window pause.
- Synchronized multi-display wallpaper-style rendering.
- App-level Ambient Screen presentation across connected displays.
- First-run onboarding.
- Native Settings window.
- Explicit user-initiated diagnostic reports only.

## Data preservation

The 1.0 technical release deliberately keeps the existing bundle identifier and persistence domains used by the approved 0.3–0.6 builds. Existing compositions, camera settings, membrane count, detailed tail settings, generated organisms, Favorites and presets therefore remain available without a risky automated migration.

The eight canonical Original definitions are source data, not mutable user presets. User customization is always a working state layered on top.

## Multi-display model

The primary BETTA app remains the creative authority. Additional desktop surfaces instantiate native Metal renderers but share the same process-wide composition, advanced tuning, random-style and environmental stores. They do not establish independent creative state or duplicate the Himawari network controller.

Display attach/detach is monitored at runtime. Secondary wallpaper surfaces are rebuilt against the current screen set and follow the primary renderer's presentation mode.

## Ambient Screen boundary

Ambient Screen is intentionally an in-app full-screen presentation. It is **not** represented as a registered macOS `.saver` plug-in. Shipping a system Screen Saver extension would be a separate signed distribution artifact and is outside this technical release rather than being simulated or mislabeled.

## Signing and notarization

CI creates an ad-hoc signed ARM64 build because private Apple Developer credentials are not stored in the repository.

The release script accepts two owner-controlled inputs:

- `BETTA_CODESIGN_IDENTITY` — a valid Developer ID Application identity.
- `BETTA_NOTARY_PROFILE` — a local/keychain `notarytool` profile.

When supplied, the build script enables Hardened Runtime signing, submits the release archive to Apple notarization, staples the accepted ticket, and rebuilds the ZIP. No signing certificate, private key, password, App Store Connect key or notary credential is fabricated by the project.

## Commercial boundary

The UI uses the neutral product name **BETTA**, but the 1.0 technical build intentionally retains the legacy bundle identifier for state continuity. Before public paid distribution, complete the ownership/branding review and decide whether to migrate to a separate commercial bundle identifier. Any such migration should copy existing user state explicitly rather than silently discarding it.

## Release gates

The GitHub Actions release job must pass all of the following on the exact release commit:

1. Swift regression/self-test suite.
2. Runtime-safe Metal shader compilation.
3. Release Swift build.
4. ARM64 executable inspection.
5. Bundle identifier, display name, version and build verification.
6. Code-signature verification.
7. Bundled Metal library and shader-source parity check.
8. Runtime Metal pipeline creation when a GPU is exposed by the runner.
9. ZIP and DMG creation.
10. Artifact upload.

Production PWA/main and draft PR #156 remain outside this release operation and must not be merged as a side effect of packaging BETTA.
