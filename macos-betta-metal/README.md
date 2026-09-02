# Sindhorn Betta Metal Lab for macOS

Native Swift + AppKit + Metal/MetalKit implementation of the Sindhorn procedural Betta renderer.

## Authority

- Production PWA main captured for this branch: `b5cf2b1e021d2bd9bc93dff7e28aaf6dd22e41ab`
- Android implementation reference: `android-betta-wallpaper@7cbd44faca97f763065d194884be935ae95dd106`
- The production PWA remains the canonical starting artwork. The macOS editor stores non-destructive per-fish overrides on top of those presets.

The macOS implementation still uses the production neutral satellite driver state. Live Himawari/Bangkok environmental modulation remains a later phase after the native artwork is approved.

## High Detail Mac renderer

There is no WebView, browser, WebGL, video, GIF, generated imagery, or prerendered fish asset. The fish is generated and shaded natively with Metal.

The first parity build used the web/mobile 80 × 72 membrane topology. The Mac High Detail build now uses a **160 × 144** radial membrane surface, roughly four times the triangle density, while retaining two ordered translucent membrane layers.

The Metal shader adds tunable high-frequency structure for:

- ray definition
- micro folds
- edge ruffle
- vein emphasis
- membrane grain
- fine flutter
- normal detail

All of these controls default to neutral values so Reset returns to the production-inspired appearance.

## Per-fish editor

Each Fish #1–#8 has its own saved state. The editor is split into these tabs:

- **Layout** — 90° orientation, scale, X/Y/Z
- **Camera** — FOV, camera X/Y/Z, pitch, yaw, roll
- **Form** — spread, ray count, fold density, curl, twist, edge flutter, depth, current strength
- **Motion** — speed, turbulence, amplitude
- **Optics** — opacity, transmission, rim light, fold highlight, iridescence, bloom
- **Color** — saturation, brightness, gradient position
- **Detail** — Mac-only microstructure controls
- **Front** — primary membrane layer scale/alpha/offset/rotation/phase
- **Back** — secondary membrane layer scale/alpha/offset/rotation/phase

Changes preview live. **Save All 8 & Use as Wallpaper** persists layout, camera, tail and layer settings for all eight fish, returns to the Bangkok live cycle and switches to desktop mode. Camera and advanced tail settings morph smoothly between fish rather than crossfading rendered images.

Press `D` to switch between wallpaper and editor mode.

## Run from source

Requires macOS 13 or newer and Xcode Command Line Tools.

```bash
cd macos-betta-metal
swift run BettaMetalLab
```

Launch options: `--fish=5`, `--preview`, `--desktop`, `--self-test`.

Keyboard controls: `1`…`8` specific Betta, `L` live Bangkok schedule, `P` three-minute full-day preview, `[`/`]` previous/next, `D` wallpaper/editor.

The desktop mode uses public Core Graphics desktop window levels and AppKit Spaces behavior; macOS does not expose a general third-party live-wallpaper API.

## Build an app bundle

```bash
./scripts/build-app.sh
```

Creates `dist/Sindhorn Betta Metal Lab.app` and a ZIP with ad-hoc signing. Notarization and a polished installer are intentionally deferred.

Branch CI compiles the Metal shader, runs the Swift self-test, builds the release app, validates the app bundle/signature and publishes the runnable artifact on a native macOS runner.

See `docs/BETTA-METAL-PARITY.md` for the original port contract and acceptance checklist.
