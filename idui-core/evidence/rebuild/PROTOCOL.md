# Rebuild test protocol — Flipgazine "Moving to Claude Code"

Frozen 6 September 2026, before the after-metrics were taken. This is IDUI's
first external adversarial case: a product with its own history, identity,
theme engine, WebGL atmosphere, glyph layer and typography, none of which
were designed with IDUI in mind. The earlier transfer test was
self-confirming (IDUI specimens rebuilt on IDUI); this one is not.

## The claim under test

> A methodology derived from one dark-glass hospitality application can
> express a visually unrelated existing product without importing that
> application's visual constitution.

Not "we rebuilt a page with less CSS". If the test forces Sindhorn
assumptions out of the core, that is evidence for the methodology, not
against it, and every such assumption is recorded in `FALSIFICATIONS.md`.

## Steps

1. Snapshot the original page and everything it loads, as stored in
   Flipgazine's `site_files` (`flipgazine-source/`, anon key redacted).
   Nothing in Flipgazine's repository or database is modified.
2. Measure all before-metrics automatically (`measure.mjs`), in a real
   browser, offline, on a pinned clock and a pinned period.
3. State which engines remain untouched (below).
4. Define parity in layers (below).
5. Record every core assumption the migration disproves.
6. Rebuild through constitution + primitives only (`convert.mjs` is a
   deterministic class mapping; the after page may carry no CSS and no
   style attribute). Where the library has no primitive, the question is
   asked before anything is added to the core:
   *is this a reusable semantic degree of freedom required by multiple
   legitimate constitutions, or one application's historical exception?*
   Tracking, label weight, display case, page measure and a code block
   passed. A book-thumbnail tilt would not; it stays an application engine.
7. Measure exactly the same metrics afterward, same harness, same clock.
8. Publish wins and losses, including raw total CSS bytes even where the
   shared foundation is larger than the page it replaced.

## Engines preserved unchanged

`fg-atmos.js` (WebGL atmosphere), `fg-glyph.js` (glyph field),
`fg-theme.js` (period palette, editorial/legacy modes), `fg-motion.js`,
`fg-clock.js`. They are environmental engines, not interface. IDUI governs
the interface's relationship with them — the theme engine writes
`--bg --text --muted --accent --surface --glass --glass-brd`, the Flipgazine
constitution aliases those into `--app-*`, the core derives everything
else — and does not absorb them, the same way it does not own Betta's fin
shader. One edit in the carried copy: `fg-theme.js` no longer fetches
`flipgazine_periods` (the evidence runs offline and may carry no key); its
eight-period snapshot is the same data.

## Parity, in layers

**Functional parity** — same content, same information hierarchy, same
interactive capabilities (copy buttons, section rail with scroll tracking and
smooth scroll, fullscreen, theme and editorial toggles), same state
transitions.

**Identity parity** — same typography family and weight intentions (Poppins
300/500/600), same tracked uppercase label language, same atmospheric
engines, same theme-written color behavior, same density and shape character
(14/12/8 radii, pill controls).

**Visual parity** — side-by-side screenshots at 390 and 1240 wide, with
declared tolerances for spacing and line wrapping, and no requirement for a
pixel-identical implementation. Deviations are listed, not hidden.

The objective is preservation of product identity, not pixel-equivalent CSS
reconstruction.

## Metrics (identical before and after)

Source metrics: page-authored CSS bytes, style blocks, rules, `!important`,
`@media`, literal font sizes and radii, hex colors, inline style attributes,
distinct classes; shared CSS bytes; behavior JS bytes.

Rendered metrics (Playwright, engines hidden for the DOM diff): distinct
computed font sizes, weights, letter-spacings, radii, line heights, colors;
backdrop-filter recipes and count; nested glass; runtime-written inline
styles; stylesheets and rule counts; document height.

Architecture metrics: *discretionary appearance decisions in page code*
(declarations in the page's own CSS or style attributes that choose a value —
a size, a color, a radius, a blur); *semantic declarations required by the
page* (classes and data attributes the page must write to get its look);
*change propagation distance* — for a named visual change, the number of
locations that must be edited (chip radius, label tracking, glass recipe,
accent color, body face).
