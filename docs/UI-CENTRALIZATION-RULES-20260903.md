# UI rules — read before touching any markup, CSS, or component

Status: active from 2 September 2026. Governs the from-scratch UI rebuild
(`land-baseline` → `main`) and everything built on it: `/ci`, `/next`, and
every page that follows. For the reinstall/shell-vs-data rules specifically,
see `docs/RELEASE-RULES-NO-REINSTALL-20260903.md` — this document assumes
Rule 6 from that one and does not repeat it.

## Why this document exists

The first attempt at this rebuild lost to the live app twice: once because
route CSS kept reinventing material under new names, and once because the
review process (screenshots reviewed on a phone) couldn't catch that half of
`/ci`'s own components had no CSS behind them. This document is the fix for
the first failure. `scripts/ci-page-render-smoke.mjs` and
`scripts/ui-centralization-budget.mjs` are the fix for the second — run them
before every push, not after something looks wrong.

## The eight requirements

Everything below exists to satisfy these. If a change conflicts with one of
them, the change is wrong, not the requirement.

1. **No reinstall after release.** The PWA identity never changes — see
   `docs/RELEASE-RULES-NO-REINSTALL-20260903.md` Rule 1.
2. **Centralized code and modules.** One shared library, not per-route
   reinvention.
3. **No inline CSS patches.**
4. **No inline or per-page CSS at all** — not even a `<style>` block, not
   even one `style="…"` attribute.
5. **Consistent, real frosted-glass blur** everywhere a surface calls for it.
6. **The Betta WebGL engine stays intact** — see `AGENTS.md` and
   `docs/BETTA-PRODUCTION-ATMOSPHERE-20260831.md`.
7. **Fast launch.**
8. **Skeleton loading on Today.**

## The library is the only source of truth

Every page loads the same five foundation files and nothing else for UI:

    fonts.css → app-tokens.css → app-glass.css → app-components.css → app-shell.css

(`/ci` additionally loads `ci-library.css`, which styles only the reference
page's own chrome — specimen labels, the index nav, swatch grids — never a
component.)

`site/ci.html` at `/ci` is the master UI library and the only place a
component is allowed to be designed. The workflow for anything new:

1. Add the component to `site/app-components.css` — geometry and structure
   only, no colour literals beyond the state tones, no route co-selectors,
   no `!important`.
2. Demonstrate it live in `/ci`, in its own section, over the real
   atmosphere.
3. Extend `scripts/ci-page-render-smoke.mjs`'s `EXPECT` (and `MOTION` if it
   transitions or animates) so the component's actual computed material and
   motion are locked in, not just documented.
4. Only then does a route consume the class. A route never declares its own
   fill, border, blur, radius, font-size, duration, or easing — if the
   library doesn't have what a page needs, the library gets it first.

Before every push that touches shared UI code, run both:

    node scripts/ui-centralization-budget.mjs   # the ratchet — see below
    node scripts/ci-page-render-smoke.mjs       # renders /ci headlessly, asserts every component

Land one page at a time, verified, rather than batching several unverified
pages into one push — this is what let the rebuild actually finish instead
of losing another race to the live app.

## The ratchet

`scripts/ui-centralization-budget.mjs` tracks nine metrics (stylesheet
counts, `!important` count, backdrop-filter rules outside `app-glass.css`,
inline style blocks/attributes, distinct off-scale font-sizes and radii,
card/hero implementations). A change may improve any metric or leave it
alone; it may never make one worse, with `foundationCssFiles` alone allowed
to grow (that's route CSS being absorbed into shared files, which is the
point). If a change legitimately improves a metric, lower the baseline with
`--update`. If the tool refuses `--update` because something else regressed,
that regression is the thing to fix — never fold a new violation into the
baseline to make the tool pass.

## Glass membership rule (3 September 2026)

**A card is anything that draws an edge — a border or a fill. If it draws
one, it needs the atmosphere behind it and takes the material. If it only
arranges its children, it draws nothing and takes nothing.** This is a
consequence to apply, not a list to consult: a back/close control with a
visible frame is glass; a text-and-icon utility action with no frame is not,
even though both are "buttons."

Three primitives, declared in markup, defined once in `app-glass.css`:

- `.app-card` — a surface sitting on the atmosphere (also implied by
  `.app-action-card`, `.app-surface`, `.app-disclosure`, `.app-masthead`,
  `.app-navbar`, `.app-table tbody th` — these get material without a
  second class because they are cards by definition).
- `.app-control` — an interactive element sharing the same material.
- `.app-overlay` — a surface floating above content (dialogs, sheets,
  menus, toasts), heavier fill because it has no atmosphere directly
  behind it.

Two weights of one material only:

- `--app-glass-fill` `rgba(46,39,59,.30)` — on-page surfaces.
- `--app-glass-overlay-fill` `rgba(38,32,49,.72)` — floating overlays.
  Never push this past roughly `.92`; beyond that it reads as solid black
  and stops being glass.

One blur recipe for both: `--app-glass-filter: blur(18px) saturate(1.18)`.
There is no third recipe, ever.

**Glass never nests.** `backdrop-filter` cannot sample past an ancestor that
already has one, so a card inside a card renders as a flat tint no matter
what the CSS asks for. `app-glass.css` handles this structurally (nested
selectors drop the blur, keep the tint) — a route must never fight this or
try to give a nested surface its own blur.

If a surface's real purpose is to have no background, don't draw a frame
around it at all rather than drawing an empty one — an unpainted frame is
still an edge, and an edge is still a card.

## Motion (2 September 2026)

Two durations, one easing, both tokens in `app-tokens.css`:

- `--motion-fast` `160ms` — press feedback (transform/scale, chevron
  rotation).
- `--motion-ms` `280ms` — a component settling into a new state (colour,
  border-color, disclosure height).
- `--motion-ease` `cubic-bezier(.22, 1, .36, 1)` — pairs with both.

No component invents a third duration or a different easing curve.
`scripts/ci-page-render-smoke.mjs`'s `MOTION` list reads the actual computed
`transition-duration`/`transition-timing-function` off the canonical
selectors and checks them against these tokens, the same way material is
checked — a silently drifted value fails the gate exactly like a wrong
background colour would.

Reduced motion resets the same rules' durations near zero; it is never a
second, separately-maintained "motion-safe" copy of a component.

## Sequencing

`/next` is the new public app shell and is intentionally unauthenticated
while its pages are built. Auth returns before any page that reads a real
employee's data lands (Settings, Account, People, Messages, Admin) — no
exceptions for convenience during development.

Where this document or the library's own state ever conflicts with
"Product state that must be preserved" in `AGENTS.md` — for example, the
legacy three-button Today/F&B/Messages footer — that section describes the
**legacy app at `/`** only, until the rebuild cuts over. The new shell's
footer is Today/F&B/Brand/CI.
