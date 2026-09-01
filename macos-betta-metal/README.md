# Sindhorn Betta Metal Lab for macOS

Native Swift + AppKit + Metal/MetalKit proof-of-parity for the Sindhorn procedural Betta renderer.

## Authority captured for this milestone

- Production PWA main: `b5cf2b1e021d2bd9bc93dff7e28aaf6dd22e41ab`
- Android implementation reference: `android-betta-wallpaper@7cbd44faca97f763065d194884be935ae95dd106`
- PWA visual authority remains `site/betta-fin-presets.js`, `site/betta-fin-shader.js`, `site/betta-environment.js`, and `site/betta-day-periods.js`.

The macOS implementation intentionally starts with the production neutral satellite driver state. Live Himawari/Bangkok environmental modulation is a separate phase after visual parity is reviewed.

## What is native

There is no WebView, browser, WebGL, video, GIF, generated imagery, or prerendered fish asset. Geometry is generated once as the same 80-ray × 72-segment radial membrane topology and rendered as two translucent Metal layers. The procedural deformation and membrane lighting are translated to Metal Shading Language in `Sources/BettaMetalLab/Shaders.metal`.

## Run from source

Requires macOS 13 or newer and Xcode Command Line Tools.

```bash
cd macos-betta-metal
swift run BettaMetalLab
```

Launch options: `--fish=5`, `--preview`, `--desktop`, `--self-test`.

Controls: `1`…`8` specific Betta, `L` live Bangkok schedule, `P` three-minute full-day preview, `[`/`]` previous/next, `D` experimental live desktop.

The desktop toggle uses public Core Graphics desktop window levels and AppKit Spaces behavior; macOS does not expose a general third-party live-wallpaper API.

## Build an app bundle

```bash
./scripts/build-app.sh
```

Creates `dist/Sindhorn Betta Metal Lab.app` and a ZIP with ad-hoc signing. Notarization and a polished installer are intentionally deferred.

See `docs/BETTA-METAL-PARITY.md` for the port contract and acceptance checklist.
