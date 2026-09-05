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
| core | `app-glass.css` | The one material: fill, edge, blur, the scrim. Nothing else may declare these. |
| core | `app-components.css` | The primitives: geometry and structure only, every value a token, variants as `data-*` attributes. |
| core | `app-compositions.css` | Assemblies of primitives shaped by one page's content (a promotion card, a directory row, a table, a business card). |
| core | `app-shell.css` | The frame: page, masthead, navbar, the atmosphere stage. |
| constitution | `constitutions/<name>/app-tokens.css` | Every value: type steps, weights, tracking, color, radii, control heights, space, motion. |
| constitution | `constitutions/<name>/fonts.css` | The face: `@font-face` and `--font-ui`, the family and zero-tracking lock. |

A constitution is the only thing a second project writes. It declares the
same custom-property names with its own values; it may also redeclare the
material tokens `app-glass.css` sets on `:root` (`--app-glass-fill`,
`--app-glass-border`, `--app-glass-filter`, the overlay, nested and scrim
values), which is why it is loaded last.

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
there because its constitution redeclares no material value.

## Constitutions

| Name | Source | Notes |
| --- | --- | --- |
| `sindhorn` | copied from `site/` at every release (parity-checked) | the origin; redeclares no material value |
| `flipgazine` | written 6 Sep 2026 from `https://flipgazine.pages.dev/ci.html` | the transfer test; redeclares the whole material; imports Poppins + Noto Sans Thai from Google Fonts; no zero-tracking lock (`--tracking:.16em`) |

## Evidence

`evidence/` is the transfer test. `specimens.html` is one fragment of
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
selectors changed value and every change came from a token. The five that did
not, and what the run showed the core cannot yet say, are the findings in
`docs/idui/` §08 Transfer. In short: `--tracking` and `--space-*` are declared
but unconsumed; the shell ground `#2E273B` is a literal; text inputs and
icon-only controls fall to the UA's weight 400 instead of `--weight-regular`;
the core carries three weights and one control shape (Flipgazine's 600
wordmark and pill buttons have no slot, by design); a constitution's font
files must travel with it (Sindhorn's `fonts.css` points at `/assets/fonts/`,
which the core does not carry); and the semantic slots `--app-success` and
`--app-danger` demand values a brand may not have (Flipgazine's were
invented).

## The nine invariants the core assumes

1. One material - all fill, border and blur from `app-glass.css`; no `backdrop-filter` elsewhere.
2. A card is anything that draws an edge; glass never nests.
3. One scale - every size, radius, space, weight, leading, duration and control height is a token.
4. One face, zero tracking - `--tracking` is the constitution's knob, held at 0.
5. Rounded, never circular - no 50%, no pill on a control.
6. No CSS outside the foundation - a page brings markup and behavior, never presentation.
7. Variants are attributes, not classes - `data-tone size width columns mode open compact direction split rule icon stagger`; state is `data-view run set locked ready public`.
8. Both-or-neither - actions that share a row share a weight; a hero head and a dialog foot are where the rule says neither.
9. Voice is library - formatting comes from `app-format.js` and `[data-format]`, never from a page.

Rules 1-3 and 5-6 are checked by the ratchet, the page audit, the nested-glass
walk and the shape audit; 4 by the font test; 7 and 8 by
`scripts/idui-invariants-smoke.mjs`; 9 by the render smoke. The checks read
`site/`; a second project points them at its own tree.

## What the core does not carry

The shell's ground color (`#2E273B` in `app-shell.css`) and the fade-mask
stops (`#000`) are literals the r32 audit named and kept; a constitution that
needs a different ground overrides `body` and `.app-page` and the transfer
test records that as a finding against the core, not the constitution. The
behavior modules (`app-select.js`, `app-dialog.js`, `app-format.js`, the
disclosure binder) are not copied here yet; a page in the second project
renders static specimens of the primitives, which is what the material, scale
and shape invariants are about.
