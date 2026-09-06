# Test 02 — results

Origarium Papers, `/papers.html` v59, measured at 390 in both modes. Both sides
by the same code: `idui-core/evidence/metrics.mjs`, which the Flipgazine test
imports too.

**Scope, stated first.** This is one of Origarium's four modes. The game view
and the dream state are mostly WebGL and do not put the transfer question; the
CRM is reserved for a test of its own (`PROTOCOL.md` A4, A5). Nothing here
speaks for those.

## What changed

| | Before | After |
|---|---|---|
| Page CSS | 22,912 B in 154 rules | **0** |
| Style blocks | 2 | **0** |
| Inline `style=` | 0 | 0 |
| Style set from script | — | **0** |
| **Appearance decisions** | **243** | **0** |
| Semantic declarations | 51 | 44 |
| Font sizes rendered | 15 | 7 |
| Distinct radii | 7 | 3 |
| Blur recipes | 4 | **1** |
| Nested glass | 1 | **0** |
| Console errors | 0 | 0 |

Identity held where it matters most: the reader is **Cormorant Garamond at
19px on `rgb(234,231,221)`** in both, and the archive keeps the near-black
ground, the lime accent and the warm paper thumbnails.

## What the core needed

Nine entries: seven reusable capabilities, one misowned assumption returned to
where it belonged, and one defect in a capability this test had itself added.
None product-specific. No **D** at all, and
no **D-P**.

**That number is not evidence on its own.** Candidate A also reported D-P = 0
while failing editorially, which is how an architecture can score perfectly by
declining to reproduce the hard part of an identity. Amendment A6 fixes the
rule for the whole series: *product-specific presentation burden is evaluated
only against an editorially accepted reconstruction.* Zero D-P with rejected
fidelity is not a win — it is unresolved.

| # | Requirement | Class | What it cost |
|---|---|---|---|
| 1 | Material chosen by semantic role, not by drawing an edge | **C** | One rule + 4 constitution tokens. `data-surface="document"` |
| 2 | Prose has its own face | **C** | One declaration + 1 token. `--font-prose` |
| 3 | Prose has its own reading size | **C** | Two declarations + 1 token. `--type-prose` |
| 4 | A stack can flow in columns | **C** | Two rules, no token. `data-columns`, already in the vocabulary |
| 5 | Material has scope: a context can make a material the ground | **C** | One rule block, no token. `data-context="reader"` |
| 6 | A view may scale and fade where its material draws no blur | **A** | The core held a Sindhorn constraint as universal. One keyframe, 3 tokens, and a gate that enforces the condition |
| 7 | A document in preview keeps a page's proportion | **C** | One rule + 1 token. The thumbnail is a sheet, `aspect-ratio: 210/297` |
| 8 | The accent can emit light | **C** | 1 token. The core already glowed its progress bar, hardcoded; now it is named |
| 9 | A mark and a dot: the accent as a short rule and as a point | **C** | Two rules, no token |
| — | Stack items must fit their track | **defect** | `min-width:auto` let one long word make a column wider than its share; two-across was not equal |
| — | Miniature prose at caption scale | **free** | Existing token, existing variant word |
| — | Meta at micro scale | **free** | Existing token, existing variant word |
| — | A third blur weight | **not spent** | The rebuild renders on one |
| — | `50%` radii | **not a finding** | The core draws its one circle through `--radius-pill` |

The core rule that broke was the global one — *a card is anything that draws an
edge, and it is glass*. That holds only while every surface in a product is
chrome. Origarium puts documents inside chrome, so the same element kind must
be a different material depending on what it **is**. Membership now answers
"does this draw a surface" and one semantic variant answers "what surface is
it"; the constitution decides what a document is made of.

## Candidate A, and why it was rejected

The first reconstruction passed every contract and the owner rejected its
reader. It is frozen in `candidate-a/`, uncorrected.

The original says *the paper is the page*: the warm material occupies the
environment and the interface sits quietly on it. Candidate A said *the paper
is a surface inside the app* — dark shell, rounded dark container, cream
document within. A different composition, not a styling difference.

It happened because the reader was built on `.app-dialog`, the library's way of
putting a layer over a page — which carries Sindhorn's compositional model:
scrim, floating panel, chrome wrapping content. Reaching for it imported an
assumption that had nothing to do with Origarium. That is the failure Test 03
predicts as **A05, identity does not converge**, arriving through a primitive
rather than a value, and showing up in a real experiment before the test
written to look for it.

## What that found: material has scope

Material by role answers *what is this surface made of*. It does not answer
*how much of the world is it*. An embedded preview and a full reader are the
same material at different scope — an object in a dark interface, or the
environment itself.

No token could have fixed Candidate A, because the difference is not what the
material is; it is where it applies. So context is declared once, by the scene,
and the constitution derives the ground from it:

```
role = document, context = archive   → embedded paper
role = document, context = reader    → environmental paper
```

A page says "this is a reading context". It never says warm, or cream, or
`#eae7dd`. Chrome inside that context belongs to the paper — it takes the
document's ink and edge, drops the interface's glass, and its titles are set in
the document's face, because the voice of a reading context is the document's.

**Candidate B** is that repair. The governing rule changed; the page did not.

| | Conformance | Editorial selection |
|---|---|---|
| **A** | PASS | REJECTED — the document became an object inside the app |
| **B** | PASS | *awaiting the owner* |

## The first A: a motion law that was really a material law

The core said it plainly, in `app-view.js` and beside the keyframes:

> Nothing recedes, scales or parallaxes… Opacity, filter, mask or clip-path
> defeats `backdrop-filter` and the glass flashes flat mid-move.

That is true, measured in Chrome, and it is **not a law about motion**. It is a
consequence of glass. Sindhorn's surfaces are frosted, so Sindhorn may not
scale — and that was written into the core as though it held everywhere.

Origarium's reader is opaque paper on a plain `rgba(8,9,11,.6)` scrim, with no
`backdrop-filter` anywhere in the moving subtree. It has no frost to flatten,
and the original springs: rise 42px, overshoot a little past rest, settle, on
`cubic-bezier(.3,1.4,.4,1)` over 480ms. That overshoot is what makes a
thumbnail feel like it *became* the page rather than being replaced by one —
the e-ink reader opening, which is the design the product was built around.

Classification **A** — a Sindhorn assumption that leaked into the core — and
the first of that kind in this test. The repair is not to delete the rule,
which is correct where it applies, but to make it state its condition:

> A view may spring only where the material it carries declares no filter.

**And the condition is enforced, not documented.** `idui-invariants-smoke.mjs`
check 10 fails any constitution that gives its spring real travel while its
document material carries a blur. Given Sindhorn a 42px spring, it reports:
*springs 42px but its document material is `var(--app-glass-filter)`; a scaling
surface may not carry a blur.*

Verified in flight: at 120ms the reader sits at scale 1.007, 6px above rest —
the overshoot — and the moving subtree contains zero backdrop-filters.

## Change propagation

*Locations that must be edited for one named visual change.* Computed by the
shared `propagation()` in `metrics.mjs`, so the five changes Test 01 measured
are measured identically here.

| Change | Before | After |
|---|---|---|
| Chip radius | 3 | **1** |
| Label tracking | 9 | **1** |
| Glass recipe | 8 | **1** |
| Body face | 15 | **1** |
| Label weight | 6 | **1** |
| Reading measure | 3 | 2 |

Three numbers deserve their caveats rather than a table row that flatters:

- **Document material — 1 → 1, no improvement.** The shared matcher reported
  0 → 1, which is an artifact: it cannot know a product's own token names, and
  Origarium had already tokenised its paper colour as `--eink-bg`, declared
  once with no literal uses. One edit before, one edit after. This is a place
  the original was **already doing what IDUI asks**, and it is recorded as such
  rather than dressed as a win.
- **Accent colour — 2 → 1.** The original declares the lime twice, as `--lime`
  and `--term-lime`, with no literal uses. Two tokens become one.
- **Reading measure — 3 → 2.** The remaining two are core declarations, not
  page ones. The matcher is the weakest of the eight, because "the measure of
  running text" is expressed by several properties, and the number should be
  read as indicative rather than exact.

The five shared changes are the trustworthy ones, and they are unambiguous:
**a visual decision that took three to fifteen edits in the page now takes
one.**

## Core stability elsewhere — P05

Enforced, not assessed. After every change:

- Sindhorn `/`, `/voice`, `/ci`: **0 differing pixels**
- Flipgazine specimens: 29 glass surfaces, 0 nested, still Poppins
- Core ↔ site parity: 10 pairs, no drift
- Constitutions: 74 required tokens, all three complete, no orphans
- Ratchet: 11 metrics unchanged

## Deviations, recorded not chased

1. **Metadata face.** The original sets `paper—01 · 20 Jul 2026` in monospace;
   the rebuild sets it in the interface face. Closing it would mean a monospace
   *text* role beside `--font-code`, which is a block-level code face. Left
   open rather than spent.
2. **No lime rule atop each thumbnail.** Decoration in the original; nothing in
   the rebuild depends on it.
3. **Fewer rendered font sizes**, 15 → 7. Normalisation, not loss: the original
   accumulated sizes the scale does not name.

None of the three was repaired with page-local styling, which is the rule that
matters: if the valid system produces the wrong appearance, the governing rule
is repaired, never the page.

## Method

Three probes reported false results before any number here was trusted, each
the same error — asserting that an action was taken rather than that a state
was reached. Reads answered empty rendered an archive saying "No papers
published yet"; a click on the wrong element reported the reader open and
measured the archive twice; a probe read a transparent wrapper and reported the
serif reader as Inter. The write guard had the same flaw, and now each viewport
makes a deliberate write attempt that must be refused, so the guard is
demonstrated on every run rather than assumed. Nothing was written to
Origarium's rows.
