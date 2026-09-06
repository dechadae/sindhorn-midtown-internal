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

Four capabilities, all reusable, none product-specific. No **D** at all, and
no **D-P** — the number the stopping rule watches.

| # | Requirement | Class | What it cost |
|---|---|---|---|
| 1 | Material chosen by semantic role, not by drawing an edge | **C** | One rule + 4 constitution tokens. `data-surface="document"` |
| 2 | Prose has its own face | **C** | One declaration + 1 token. `--font-prose` |
| 3 | Prose has its own reading size | **C** | Two declarations + 1 token. `--type-prose` |
| 4 | A stack can flow in columns | **C** | Two rules, no token. `data-columns`, already in the vocabulary |
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
