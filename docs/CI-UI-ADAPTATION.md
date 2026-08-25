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

## Governing bilingual typography rule

> **English typography is eminent. This is the highest visual-language rule for the app. English defines the premium editorial composition; Thai guarantees operational understanding.**

The app remains bilingual by default. There is no mandatory language switch.

### English leads visual identity

English appears first and carries the strongest typographic treatment for:

- brand/editorial headings;
- navigation;
- section labels;
- data labels;
- weather labels;
- status/display words;
- normal utility buttons;
- reference/footer typography.

English may be larger, lighter, more widely tracked, uppercase, or otherwise used as the structural typography of the interface. Thai must remain clearly readable and must never be reduced to illegible caption text.

### Thai leads comprehension when action or safety matters

Thai appears first in reading order for:

- health guidance;
- actionable instructions;
- warning states;
- error/recovery instructions;
- permission or operational instructions;
- safety/medical disclaimers where comprehension is more important than visual hierarchy.

English follows as the supporting international-language version. This exception does not reverse the overall visual system: English remains the eminent typographic language across the app.

### Practical hierarchy

```text
BRAND / AESTHETIC / STRUCTURE
English first and visually eminent
Thai second and fully readable

NAVIGATION
English first
Thai always visible

DATA / STATUS / WEATHER LABELS
English first
Thai supporting

ACTIONABLE GUIDANCE / WARNINGS / ERRORS
Thai first for comprehension
English second

NUMERIC DATA
language-neutral
```

Never hide essential Thai comprehension behind a language selector. A future language preference may change emphasis/order for long-form copy, but it must not remove the other language from critical operational information.

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

Route heading + Today’s Guidance + Thailand AQI scale. Advice rows use circular glass icons and hairlines; the scale uses one shared glass container. Instruction copy follows the Thai-first comprehension exception while English remains eminent in headings and UI structure.

### Details

Route heading + reading facts + Refresh/Share + source/disclaimer. Facts use glass only as one container, with hairline rows inside. Safety/medical disclaimers use Thai-first reading order.

### Footer

Shared reference footer on every route using the same small-label + hairline grammar as the CI reference. English remains the primary editorial/reference language.

### Bottom navigation

Fixed glass rail. Today / Guidance / Details are editorial pills; only the active route carries the accent border and accent text. English is the primary label; Thai remains visible underneath.

### Buttons

Normal utility controls: English first. Primary styling uses accent tint + accent border; secondary uses transparent glass border. 999px radius, 1px border, uppercase tracked English label, tactile press scale. Critical recovery/action instructions may use Thai first.

## Non-negotiables

- **English typography must remain eminent across the app.**
- Important instructions, health guidance, warnings and recovery states must be understandable in Thai without changing language settings.
- Do not alter AirBKK or Open-Meteo data behavior for UI styling.
- Do not couple UI theme to physical day/night; there is no manual theme system.
- Do not animate through fabricated PM2.5/AQI values.
- Do not obscure the realtime WebGL atmosphere with opaque page backgrounds.
- WebGL remains progressive enhancement and HTML remains fully usable without it.
- Preserve mobile-first behavior at 320–390px widths and installed/fullscreen PWA behavior.


## v13 typography and footer authority

- Noto Sans is the app-wide English/UI typeface; Noto Sans Thai is mandatory for Thai glyphs, including mixed status copy such as `ข้อมูลล่าสุด`.
- English remains eminent through scale, tracking and placement; Thai remains correctly shaped and readable.
- Header logo artwork is reduced by 10% from the v12 size.
- Guidance/Details route kickers are semantic (`AIR QUALITY CARE`, `CURRENT OBSERVATION`) with no redundant page numbers.
- Sticky navigation uses the Flipgazine Voice-page footer contract: edge-to-edge frosted rail, compact independent chips, no oversized rounded dock.
- Route changes use a short out/in depth transition while header, environment and sticky footer remain persistent.
