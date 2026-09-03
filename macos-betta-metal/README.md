# BETTA for macOS

**Living generative art for your Mac.**

BETTA is a native Swift + AppKit + Metal/MetalKit living-art renderer built from the Sindhorn procedural Betta research project. The fish is generated and shaded in real time: there is no WebView, browser, WebGL runtime, video loop, GIF, generated image asset, or prerendered fish.

## 1.0 experience

BETTA 1.0 is organized around three layers:

- **Living Gallery** — the consumer-facing home for the eight immutable Originals, Favorites, Random Betta, Continuous Evolution and one-click desktop use.
- **Living Studio** — the native Liquid Glass advanced editor with full camera, XYZ composition, 1–6 procedural membranes, form, motion, optics, color and fine-detail controls.
- **Ambient Engine** — Bangkok live scheduling, JMA Himawari atmosphere, adaptive energy use, Launch at Login support, synchronized multi-display desktop rendering and an app-level Ambient Screen mode.

First-run onboarding introduces the product as: **Meet your Betta → Make it yours → Let it live.** A native Settings window exposes the few system-level choices that should remain outside the creative Studio.

## Artistic authority and preservation

- Production PWA source was the original visual authority for the port.
- Android remained an implementation reference only.
- The macOS high-detail renderer uses a **160 × 144** membrane topology.
- The eight original fish definitions remain immutable source presets.
- Existing 0.3–0.6 composition, Favorites, random-organism and Studio persistence remains compatible in 1.0.
- Fish #5 **Mustard Galaxy Koi** keeps its original yellow/multicolor source palette and can restore original colors without resetting geometry or composition.

## Living behavior

Normal fish-to-fish changes are intentionally cinematic rather than UI-fast:

- Original/manual/saved-preset morph: **18 seconds**
- Bangkok three-hour rollover: **90 seconds**
- Three-minute day-preview morph: **12 seconds**
- Random Betta and direct Studio customization: immediate
- Continuous Evolution: continuously interpolated generative state

The normal morph uses symmetric smootherstep easing so the organism begins and settles gently.

## Bangkok Live · Himawari

BETTA connects to public JMA Himawari imagery for the Bangkok region. Infrared, water-vapor and true-color tiles are sampled into normalized environmental signals; the remote satellite image itself is never displayed as artwork.

The resulting cloud, vapor, coldness, texture, motion, atmospheric color and energy values are strongly smoothed before reaching the existing Metal environmental uniforms. Network failure falls back safely to the deterministic neutral atmosphere.

## Energy Intelligence

Rendering quality is preserved while frame scheduling adapts to whether the art can actually be seen:

- normal visible rendering: 60 fps target
- visible Low Power Mode: 30 fps target in the primary app surface
- occluded desktop or serious thermal pressure: 15 fps target
- hidden non-desktop renderer: paused

Mesh density, shader detail and saved organism state are never reduced by the energy policy.

## Multi-display and Ambient Screen

When **Mirror across displays** is enabled, additional connected displays receive native Metal desktop surfaces using the same organism stores and environmental state as the primary renderer. No duplicate Himawari feed or duplicated creative state is created.

**Ambient Screen** is a full-screen in-app living-art presentation on every connected display. It exits on keyboard or mouse input. It is intentionally described as Ambient Screen rather than a registered macOS `.saver` extension; a system Screen Saver plug-in is a separate distribution artifact and is not falsely claimed by this build.

The desktop mode itself uses public Core Graphics window levels and AppKit Spaces behavior. It is a wallpaper-style desktop window, not a private or undocumented system wallpaper API.

## Controls

Primary shortcuts include:

- `1`…`8` — select an Original/working fish
- `R` — Random Betta
- `E` — start/stop Continuous Evolution
- `L` — Bangkok live schedule
- `P` — three-minute full-day preview
- `[` / `]` — previous/next fish
- `D` — toggle desktop/Studio behavior
- `G` — Living Gallery
- `S` — Living Studio
- `A` — Ambient Screen
- `⌘,` — Settings

## Build BETTA 1.0

Requires macOS 13 or newer and Xcode Command Line Tools.

```bash
cd macos-betta-metal
./scripts/build-app.sh
```

The default development build creates:

- `dist/BETTA.app`
- `dist/BETTA-1.0.0-macOS-arm64.zip`
- `dist/BETTA-1.0.0-macOS-arm64.dmg`

CI uses ad-hoc signing so the build remains reproducible without private Apple credentials.

For owner-controlled direct distribution, supply:

```bash
BETTA_CODESIGN_IDENTITY="Developer ID Application: …" \
BETTA_NOTARY_PROFILE="your-notarytool-profile" \
./scripts/build-app.sh
```

With those credentials present, the same script enables Hardened Runtime signing, submits the release ZIP with `notarytool`, staples the accepted ticket, and rebuilds the distributable archive. Credentials are never stored in this repository.

## Release boundary

BETTA 1.0 is the technical release build. Public commercial distribution still requires the product owner's Apple Developer credentials and final ownership/branding review. The bundle identifier intentionally remains `com.sindhornmidtown.BettaMetalLab` in this first release to preserve the user's existing local state without an automatic migration.

See `docs/BETTA-METAL-PARITY.md` for the original port contract and `docs/BETTA-1.0-RELEASE.md` for the release checklist.
