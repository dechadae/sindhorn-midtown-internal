# Sindhorn Midtown CI-aligned App UI

This specialist document is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Purpose

Use the interaction grammar and component system documented on Flipgazine `/ci.html` and the Voice-page footer while preserving Sindhorn Midtown / Vignette identity and the realtime environmental architecture.

This is an adaptation, not a Flipgazine rebrand.

## Brand mapping

- Base / environment fallback: `#2E273B` — Sindhorn Midtown Twilight.
- Primary text: `#FAF7F5` — warm off-white.
- Accent: `#E5ECBE` — Sindhorn Midtown Sorbet.
- **English / Latin editorial and UI typography: Vignette Sans.**
- **Thai typography: Noto Sans Thai.**
- Realtime AQI/weather semantics may retain their data meaning inside visualizations; UI chrome does not introduce another brand accent.

The previous v13 global Noto Sans English override is explicitly superseded.

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
- Buttons and navigation chips use compact premium geometry.
- Small uppercase English labels use wide tracking and medium weight.
- Large display type stays light-weight with negative or restrained tracking as appropriate to Vignette Sans.
- In-place changing numerals use tabular figures.
- Shared motion curve: `cubic-bezier(.22,1,.36,1)` for premium entrances/transitions and `cubic-bezier(.4,0,.2,1)` for restrained state changes.
- Avoid heavy shadows, thick borders, filled dashboard cards and unrelated accent hues.
- Avoid nested backdrop filters when one parent frosted layer produces the same visual result.

## App surfaces

### Header

Persistent restrained frosted glass, hotel lockup, date + fullscreen utility, fine structural line and safe-area support.

### Today

Preserve the approved PM2.5/AQI information hierarchy. Data sits directly over the realtime atmosphere. Use hairlines and typography for structure rather than opaque cards. Weather may use a restrained glass treatment where necessary for legibility.

### Guidance

Route heading + Today’s Guidance + Thailand AQI scale. Advice rows use typography, small icon treatments and hairlines. Instruction copy follows the Thai-first comprehension exception while English remains eminent in headings/UI structure.

The route must not use redundant numeric kickers such as `02 · Guidance`. Use a semantic non-numbered kicker only if useful.

### Details

Route heading + reading facts + Refresh/Share + source/disclaimer. Safety/medical disclaimers use Thai-first reading order.

The route must not use redundant numeric kickers such as `03 · Details`. Use a semantic non-numbered kicker only if useful.

### Footer / bottom navigation

Follow the Flipgazine Voice-page footer grammar using Sindhorn colors:

- edge-to-edge persistent rail;
- one parent frosted-glass surface;
- compact independent Today / Guidance / Details chips;
- English first, Thai always visible;
- active chip receives restrained Sorbet emphasis;
- safe-area-aware bottom padding;
- no oversized rounded floating dock;
- no separate expensive backdrop blur per chip unless absolutely necessary.

### Buttons

Normal utility controls are English-first. Use restrained Sindhorn glass/accent styling, 1px borders and tactile press scale. Critical recovery/action instructions may be Thai-first.

### Pull-to-refresh indicator

The pull indicator uses the **same material tokens as header/footer**. It must not look like an opaque/solid toast floating over the app.

## Motion authority

Route transition performance takes priority over decorative blur.

Use:

- `opacity`;
- `transform: translate3d(...)`;
- optional tiny scale shift.

Do **not** animate `filter: blur()` on the whole `main` or another large full-page DOM surface. That can trigger expensive rasterization while WebGL is active and is prohibited by the final plan.

Target approximately 260–340 ms with premium easing while header/footer/environment remain persistent.

## Supabase UI-pack ownership

After the final bootstrap migration, frequently edited presentation is supplied from the Sindhorn Supabase app pack rather than requiring a Cloudflare deployment.

This includes:

- header/footer presentation;
- route markup;
- typography/layout CSS;
- buttons and glass styling;
- bilingual copy;
- transition configuration;
- atmosphere art-direction parameters.

Core PWA/WebGL/router/service-worker code remains in GitHub/Cloudflare.

## Non-negotiables

- **English typography must remain eminent across the app.**
- **English uses Vignette Sans; Thai uses Noto Sans Thai.**
- Thai including mixed live copy such as `ข้อมูลล่าสุด` must shape/render correctly.
- Important instructions, health guidance, warnings and recovery states must be understandable in Thai without changing language settings.
- Do not alter AirBKK or Open-Meteo data meaning for styling.
- Do not couple UI chrome to physical day/night; there is no manual theme system.
- Do not animate through fabricated PM2.5/AQI values.
- Do not obscure the realtime WebGL atmosphere with opaque page backgrounds.
- Preserve mobile-first behavior at 320–390px widths and installed/fullscreen PWA behavior.
- Preserve equivalent atmospheric rendering quality on mobile and desktop.
- Normal releases must not require PWA reinstall.
