# idui-core

The transferable part of Invariant-Driven UI (IDUI), copied verbatim from the
Sindhorn Midtown Internal foundation at every release. `scripts/idui-core-parity-smoke.mjs`
fails the deploy guard on any byte of drift from `site/`; `--sync` recopies.

The method is described in `docs/idui/` (built by `scripts/build-idui.mjs`).
This folder is the evidence that the method is a set of files, not a project:
take the core, write a constitution, and the same components render in a
second identity without one of them being edited.

## Files

| Tier | File | What it owns |
| --- | --- | --- |
| core | `app-glass.css` | The one material's rule: who is glass, who is not, glass never nests. It declares no value; the constitution names the fill, edge, blur and scrim (`--app-glass-*`). |
| core | `app-components.css` | The primitives: geometry and structure only, every value a token, variants as `data-*` attributes. |
| core | `app-compositions.css` | Assemblies of primitives shaped by one page's content (a promotion card, a directory row, a table, a business card). |
| core | `app-shell.css` | The frame: the document reset, the atmosphere stage. No color of its own. |
| constitution | `constitutions/<name>/app-tokens.css` | Every value: type steps, weights, tracking and case, color and ground, the material, radii (including the control's), control heights, the shell band, page and prose measures, space, the code face, motion. |
| constitution | `constitutions/<name>/fonts.css` | The face: `@font-face` or a font `<link>`, `--font-ui`, and whatever lock the product wants (Sindhorn holds every `letter-spacing` at 0 here; Flipgazine locks nothing). |
| constitution | `constitutions/<name>/assets/` | The font files, if the face is self-hosted. `fonts.css` names them relative to itself. |

A constitution is the only thing a second project writes. It declares the
same custom-property names with its own values and nothing else; the core
declares no value a constitution could want to change (no color, no radius,
no tracking, no weight, no blur recipe, no band height, no measure - the r33
falsification log lists the nine that were still in the core before the
Flipgazine rebuild). `scripts/idui-constitution-completeness.mjs` fails the
deploy guard if a constitution misses a token the core consumes, or declares
one the core never reads. Tokens load last so that a constitution wins
every tie.

## Load order

```html
<link rel="stylesheet" href="fonts.css">          <!-- the constitution's face -->
<link rel="stylesheet" href="app-glass.css">
<link rel="stylesheet" href="app-components.css">
<link rel="stylesheet" href="app-compositions.css">
<link rel="stylesheet" href="app-shell.css">
<link rel="stylesheet" href="app-tokens.css">     <!-- the constitution, last -->
```

Sindhorn loads its tokens before the material; the two orders are equivalent
because the core declares no `:root` value for the constitution to beat.

## Constitutions

| Name | Source | Notes |
| --- | --- | --- |
| `sindhorn` | copied from `site/` at every release (parity-checked, font files included) | the origin: LINE Seed Sans TH 100/400/700, zero tracking, glass at 30% / 72%, 10px control radius, 56px band |
| `flipgazine` | rewritten 6 Sep 2026 from the real page "Moving to Claude Code" and Flipgazine's shared header, rule by rule | the adversarial case: Poppins + Noto Sans Thai from Google Fonts, 300/500/600, tracked uppercase labels (`--tracking-label:.12em`), color and material aliased to what its theme engine writes (`--bg --text --muted --accent --surface --glass --glass-brd`), pill controls, 54px band |

## Evidence

`evidence/rebuild/` is the rebuild test, IDUI's first external adversarial
case: one real Flipgazine page with its WebGL atmosphere, glyph field,
theme engine and motion runtime carried unchanged, rebuilt through the
Flipgazine constitution and the core's primitives with no CSS in the page.
`PROTOCOL.md` was frozen before the after-metrics; `README.md` publishes the
wins and the losses (2.9× the CSS bytes for a one-page product is a loss);
`FALSIFICATIONS.md` lists the nine values the test forced out of the core.
The run is published as a page of the Sindhorn site, `/evidence`, built by
`scripts/build-evidence.mjs` from `comparison.json` and the four first-screen
captures - every number on the page is read from the run, never typed -
next to the method itself at `/idui` (`scripts/build-idui.mjs`). Both pages
carry only library classes and the live atmosphere in sky mode, and both are
audited by the same gates as the app.

```sh
node idui-core/evidence/rebuild/convert.mjs
node idui-core/evidence/rebuild/measure.mjs
node scripts/build-evidence.mjs        # site/evidence.html + site/assets/evidence/
```

`evidence/` itself is the earlier transfer test. `specimens.html` is one fragment of
library markup copied from `/ci` (cards, forms, actions, metrics, list, check,
badge, states, skeleton, table); `build.mjs` writes `sindhorn.html` and
`flipgazine.html` from it, identical but for the constitution links;
`transfer-smoke.mjs` renders both in Playwright, refuses any CSS in the page
or any glass inside glass, and writes `measurements.json` (the same twenty-five
selectors computed under each constitution) and one viewport screenshot per
constitution.

```sh
node idui-core/evidence/build.mjs
node idui-core/evidence/transfer-smoke.mjs --shots /tmp/idui-shots   # from the repository root
```

Result of the first run (6 Sep 2026): the fragment transferred without an
edit; 29 glass surfaces and 0 nested under each; 20 of the 25 probed
selectors changed value and every change came from a token. The five that
did not were the first findings against the core (the shell ground as a
literal, an unconsumed `--tracking`, one control shape, font files outside
the constitution, two demanded status slots); the rebuild test the same day
turned each into a token or recorded it as a refusal, and the log is
`evidence/rebuild/FALSIFICATIONS.md`. The status slots remain demanded:
that is the one place the core's shape shows through a constitution, left
visible on purpose.

## The nine invariants the core assumes

1. One material - all fill, border and blur from `app-glass.css`; no `backdrop-filter` elsewhere.
2. A card is anything that draws an edge; glass never nests.
3. One scale - every size, radius, space, weight, leading, duration and control height is a token.
4. One face - the constitution declares the family, the weights and the tracking; the core consumes them and declares none of its own. (Zero tracking is Sindhorn's constitution, not the core's.)
5. One shape system - every radius is a token; the core declares no radius literal and no `50%`. (Rounded, never circular - no pill on a control - is Sindhorn's constitution, `--radius-control:var(--radius-inset)`, checked by its shape audit.)
6. No CSS outside the foundation - a page brings markup and behavior, never presentation.
7. Variants are attributes, not classes - `data-tone size width columns mode open compact direction split rule icon stagger`; state is `data-view run set locked ready public`.
8. Both-or-neither - actions that share a row share a weight; a hero head and a dialog foot are where the rule says neither.
9. Voice is library - formatting comes from `app-format.js` and `[data-format]`, never from a page.

Rules 1-3 and 5-6 are checked by the ratchet, the page audit, the nested-glass
walk and the shape audit; 4 by the font test and the constitution
completeness check; 7 and 8 by `scripts/idui-invariants-smoke.mjs`; 9 by the
render smoke. The checks read `site/`; a second project points them at its
own tree.

## What the core does not carry

The fade-mask stops (`#000` in `app-components.css`) are the one literal
color left in the core: a mask stop is opacity, not pigment. Everything the
r32 audit named as a kept literal - the shell ground, the material values,
the band height, the control radius, the measures - is a constitution token
since r33. The behavior modules (`app-select.js`, `app-dialog.js`, `app-format.js`, the
disclosure binder) are not copied here yet; a page in the second project
renders static specimens of the primitives, which is what the material, scale
and shape invariants are about.
