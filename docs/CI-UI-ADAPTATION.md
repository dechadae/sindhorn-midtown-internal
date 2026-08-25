# Sindhorn Midtown CI-aligned App UI

## Purpose

Use the interaction grammar and component system documented on Flipgazine `/ci.html` while preserving Sindhorn Midtown / Vignette identity and the realtime environmental architecture.

This is an adaptation, not a Flipgazine rebrand.

## Brand mapping

- Base / environment fallback: `#2E273B` — Sindhorn Midtown Twilight.
- Primary text: `#FAF7F5` — warm off-white.
- Accent: `#E5ECBE` — Sindhorn Midtown Sorbet.
- Typography remains Vignette Sans + IBM Plex Sans Thai.
- Realtime AQI/weather semantics may retain their data meaning inside visualizations; UI chrome does not introduce another brand accent.

## Flipgazine CI rules adopted

- One 1px hairline system for structure.
- Glass surface = translucent base + 1px translucent border + restrained blur/saturation.
- Panel radius 12–14px.
- Buttons and navigation chips use pill geometry.
- Small uppercase labels use wide tracking and medium weight.
- Large display type stays light-weight with negative tracking.
- In-place changing numerals use tabular figures.
- Header owns a 2px accent progress rule.
- Bottom navigation is a fixed glass rail with one current accent chip.
- Shared motion curves: `cubic-bezier(.22,1,.36,1)` for entrances and `cubic-bezier(.4,0,.2,1)` for color/opacity changes.
- Avoid heavy shadows, thick borders, filled dashboard cards and unrelated accent hues.

## App surfaces

### Header

Persistent smoked glass, hotel lockup left, date + fullscreen utility right, 2px reading progress rule on the lower edge.

### Today

Preserve the approved PM2.5/AQI information hierarchy. Data sits directly over the realtime atmosphere. Use hairlines and typography for structure. Weather may use the standard glass surface.

### Guidance

Route heading + Today’s Guidance + Thailand AQI scale. Advice rows use circular glass icons and hairlines; the scale uses one shared glass container.

### Details

Route heading + reading facts + Refresh/Share + source/disclaimer. Facts use glass only as one container, with hairline rows inside.

### Footer

Shared reference footer on every route using the same small-label + hairline grammar as the CI reference.

### Bottom navigation

Fixed glass rail. Today / Guidance / Details are editorial pills; only the active route carries the accent border and accent text.

### Buttons

Primary: accent tint + accent border. Secondary: transparent glass border. 999px radius, 1px border, uppercase tracked label, tactile press scale.

## Non-negotiables

- Do not alter AirBKK or Open-Meteo data behavior for UI styling.
- Do not couple UI theme to physical day/night; there is no manual theme system.
- Do not animate through fabricated PM2.5/AQI values.
- Do not obscure the realtime WebGL atmosphere with opaque page backgrounds.
- WebGL remains progressive enhancement and HTML remains fully usable without it.
- Preserve mobile-first behavior at 320–390px widths and installed/fullscreen PWA behavior.
