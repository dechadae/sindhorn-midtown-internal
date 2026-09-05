# Falsification log — what the rebuild test disproved about the core

Every entry is a value or rule the IDUI core carried as its own that the
Flipgazine rebuild showed to be one application's constitution. Each was
moved out of the core into `constitutions/<name>/app-tokens.css` (or
`fonts.css`) and the core now consumes it. Sindhorn renders 0 differing
pixels on `/ci`, `/index` and `/voice` after every move (Playwright +
pixelmatch against HEAD); the ratchet's eleven metrics are unchanged.

Format: initial core assumption / what Flipgazine required / result.

| # | Initial core assumption | Flipgazine requirement | Result |
|---|---|---|---|
| 1 | Zero tracking is a rule of the core; `fonts.css` locked every `letter-spacing` at 0, labels were regular weight, display titles kept their case. | Tracked uppercase labels (`.1–.16em`), 600-weight labels, uppercase display titles, 300 as the body's regular. | Reclassified to the Sindhorn constitution: `--tracking`, `--tracking-label`, `--tracking-display`, `--case-display`, `--weight-label`, `--weight-medium`. The core declares no tracking, weight or case literal; the font test holds Sindhorn's tokens at 0. |
| 2 | The shell ground `#2E273B` was a literal in `app-shell.css`. | Ground is written by the theme engine (`--bg`) eight times a day. | `--app-ground` in the constitution; Flipgazine aliases it to `var(--bg)`. The shell sheet holds no color. |
| 3 | A framed control's radius is the inset radius. | A pill on every control (30px header buttons, rail chips, hero button). | `--radius-control` in the constitution. Sindhorn's resolves to `--radius-inset` ("rounded, never circular" is Sindhorn's rule, checked by its shape audit, not the core's). |
| 4 | The reading column is 720px. | 760px. | `--measure-page`. |
| 5 | The face of code is the core's. | Same stack, but it is a product decision. | `--font-code`. |
| 6 | Font files live in `site/assets/fonts/`, where every route can find them. | Poppins + Noto Sans Thai from Google Fonts; LINE Seed files must not be a core dependency. | Font files travel with their constitution: `constitutions/sindhorn/assets/fonts/`; `fonts.css` is per constitution and is the only place `@font-face` or a font `<link>` may appear. |
| 7 | The material's values — fill `.30`, edge `.14`, `blur(18px) saturate(1.18)`, overlay `.72`, nested `.98`, scrim — were the `:root` of `app-glass.css`. | Glass is the engine's `--glass` / `--glass-brd`, `saturate(1.3)`, overlay is the engine's surface color. | Seven `--app-glass-*` tokens in the constitution. `app-glass.css` declares the rule (who is glass, glass never nests) and no value. Propagation distance for "change the blur recipe" fell from 24 declarations to 1. |
| 8 | The shell band (masthead and navbar) is 56px. | 54px (12px around a 30px control). | `--app-shell-band`. |
| 9 | Long-form prose keeps a 64ch measure. | Prose runs to the page measure. | `--measure-prose` (`none` in Flipgazine). |

## Asked and refused

Capabilities Flipgazine has that were **not** added to the core, because
they fail the question *"is this a reusable semantic degree of freedom
required by multiple legitimate constitutions, or one application's
historical exception?"*:

- The catalog book-thumbnail tilt and hover lift — one application's motif;
  stays in its engine.
- The `saturate(1.4)` header variant against `saturate(1.3)` on the page —
  a drift, not a decision; the constitution names one recipe (recorded as a
  visual deviation).
- The editorial / legacy palette switch and the eight-period theme — engine
  behavior; the core sees only the tokens the engine writes.
- Two status slots (`--app-success`, `--app-danger`) the core **demands**
  and Flipgazine does not have. Recorded the other way round: the core asks
  for a vocabulary this product never needed. Flipgazine fills them with
  its accent and muted ink. This is the one place the core's shape shows
  through the constitution and is left visible on purpose.

## What did not change

The seven-sheet contract, the load order (fonts → glass → components →
compositions → shell → tokens last), the nine invariants, the glass
membership rule, the blur-drop rule for nested glass and the primitive set
(`.app-card`, `.app-control`, `.app-overlay`, `.app-surface`, `.app-prose`,
`.app-hero`, `.app-section`, `.app-masthead`, `.app-navbar`,
`.app-code-block`, `.app-table`, `.app-step`, `.app-switch`, `.app-chip`)
carried the page without a page-level rule. Three core rules were added, all
behavioral, all general: a control inside a code block drops its blur
(nested glass), and a contents list (`data-mode="contents"`) reads as
navigation rather than as running-text links, and `data-columns="2"` lets a
list run in two columns from 640px.
