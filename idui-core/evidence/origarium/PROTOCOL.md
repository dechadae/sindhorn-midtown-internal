# IDUI Test 02 — Origarium Papers

Frozen 6 September 2026, before the source was snapshotted and before any
Origarium code existed. This file is committed on its own hash so that
"predicted before implementation" is checkable rather than asserted. Amendments
are appended below, dated, never edited in.

## The question

Flipgazine asked whether IDUI survives another interface. Origarium asks
something narrower and harder:

> The core that Flipgazine corrected — can it now meet a radically different
> editorial product and mostly **stay still**?

The test is not a redesign. Origarium must remain Origarium: no Sindhorn glass,
no Flipgazine assumptions, no modernising, no beautifying inconsistencies
before they are documented.

## The source, and the boundary

`https://origarium.pages.dev/papers`. Cloudflare serves a ~9 KB stage-1 shell;
everything real is a row in Supabase project `sjpvhgxacsiorrtijqua`:

- `site_files` row `path = '/papers.html'` — 58,319 B, **version 59**
- `site_files` row `path = '/loader.js'` — 1,520 B, version 4

> **Origarium source rows reside in another application on the shared Supabase
> project. The experiment may read and snapshot them but must never write to
> those rows. Reconstruction occurs separately.**

The snapshot records the row **version** as well as the content. `/papers.html`
is a live row on a shared table and can change under the test; if the version
moves, the run is annotated or repeated, never silently carried forward.

## Frozen predictions

- **P01 — Material plurality.** The current core exposes **one** material
  family (`app-glass.css`, the `--app-glass-*` tokens, and the membership rule
  "a card is anything that draws an edge → glass"). Origarium will require **at
  least two** materially distinct semantic families — at minimum interface and
  paper/document.
- **P02 — Structural consequence.** Satisfying P01 will require a core
  architectural change, not merely different token values.
- **P03 — Selection authority.** Pages will not directly select material
  values. They may declare semantic or contextual role; the constitution and
  invariants determine the material.
- **P04 — Page presentation.** After reconstruction, page-authored CSS and
  discretionary appearance decisions remain **0**.
- **P05 — Core stability elsewhere.** The material generalisation must leave
  the frozen Sindhorn and Flipgazine renders and contracts valid. If
  accommodating Origarium changes their appearance unexpectedly, the
  abstraction is wrong.

**P05 is a gate, not an assessment.** It is enforced automatically on every
core change, by machinery that already exists: 0 differing pixels on `/`,
`/voice` and `/ci`; `scripts/idui-core-parity-smoke.mjs`; the Flipgazine
specimen renders in `idui-core/evidence/`. A core change that moves any of them
fails the build rather than being judged afterwards.

If P01 proves wrong — if Origarium can be expressed through one generalised
material model — that is a real result and is published as one.

## Executable scope

Deliberately smaller than the twenty-section draft, because the Flipgazine test
worked by being automated end to end and this one must be finishable.

**A · Frozen source and shared harness.** Snapshot the rows read-only with
their versions. Measure with `idui-core/evidence/rebuild/measure.mjs`
**unchanged**. Metric definitions do not move between columns, and they do not
move between tests — otherwise the comparison in D is meaningless.

**B · Frozen predictions.** P01–P05, this commit.

**C · Three experiments.**
1. **Multi-material** — can semantic roles derive multiple materials with no
   page presentation?
2. **Core stability** — what exactly must change in core, in constitution, and
   in product-specific code?
3. **Change propagation** — for representative edits (paper material, accent,
   reading measure): *locations touched before → after*.

**D · Classification ledger.** Every discovered requirement is classified:

- **A** — a Sindhorn assumption leaked into core → move it to the Sindhorn constitution
- **B** — a Flipgazine assumption leaked into core → move it to the Flipgazine constitution
- **C** — a genuine reusable capability missing → consider a core change
- **D** — an Origarium-specific motif → keep it local; do not enlarge core

Before any core addition: *would at least one unrelated constitution plausibly
need this semantic capability?* If not, reject it.

**D is not free.** Every D publishes its implementation cost — the requirement,
why it is not core, the files, the lines and bytes, whether it contains
presentation or behaviour or both, whether it introduces a token, whether
another page consumes it, and why core or constitution could not reasonably own
it. D is split in two, because they mean opposite things:

- **D-B — irreducible product behaviour.** A genuine capability that does not
  belong in a universal core. Healthy complexity; a large count can be fine.
- **D-P — product-specific presentation.** Visual logic that could not be
  expressed through the constitution or core. **The alarm.** A large D-P
  suggests IDUI failed to generalise its appearance architecture.

Preserve intrinsic complexity; compress accidental complexity.

**The constitution is D-P's escape hatch, and is watched.** Appearance pushed
into `constitutions/origarium/app-tokens.css` keeps D-P at zero while the
constitution becomes a taxonomy of one-off values. So the ledger also reports
the constitution's **token count** and **how many tokens are consumed by
exactly one rule**. Sindhorn's constitution is 68 tokens
(`scripts/idui-constitution-completeness.mjs`). If Origarium's needs 200, that
is the finding.

**E · Owner editorial review.** Objective evidence is automated metrics, render
comparisons, pixel differences where meaningful, functional checks and
published losses. Identity and editorial quality are judged by the owner, not
by the implementing agent, and the result is labelled **"Owner editorial
assessment — subjective"**.

## Comparison with Flipgazine

By category only. Flipgazine's nine were specifically **misowned values moved
from core to constitutions**; comparing a raw count of anything against that
number is fake precision.

| | Flipgazine | Origarium |
|---|---|---|
| Misowned core assumptions | 9 | ? |
| Missing reusable capability | ? | ? |
| Product-specific behaviour (D-B) | ? | ? |
| Product-specific presentation (D-P) | ? | ? |

## Stopping rule

Stop implementation and publish the partial result when **any one** of these is
observed, at whatever point it appears — not at a percentage of completion,
which is not measurable:

- page-owned presentation is required to retain identity
- the constitution is becoming a taxonomy of local values
- **D-P exceeds D-B**

Failure discovered early may teach more than a heroic rebuild full of
exceptions. Do not finish at any cost.

## Reconstruction rules

Allowed: composition, semantic markup, existing IDUI primitives, Origarium
constitution declarations, legitimate behaviour modules, runtime data.

Forbidden: page CSS, inline style, arbitrary visual custom properties,
page-specific colour/radius/spacing fixes, screenshot-chasing patches,
"just this once" selectors, importing Sindhorn classes because they look close.

> If the valid system produces the wrong appearance, repair the governing rule
> or the constitution — never the page.

A primitive is allowed only for a genuinely new interaction model, state
machine, keyboard behaviour, focus behaviour, accessibility semantic or
lifecycle. A paper preview is not a new primitive because it looks like paper.

## Naming the result

Not "passed". Named by what held:

> **Held With N Corrections**, or **Held Without New Core Law**.

## Amendments

### A1 — 6 September 2026, at step C1: the harness cannot be shared, the definitions can

**Found.** The protocol says to measure with
`idui-core/evidence/rebuild/measure.mjs` **unchanged**. It cannot be: that
script composes the Flipgazine page from three specific files, serves a
specific source directory, and pins a specific Betta period. Pointing it at
Origarium is impossible without editing it, so the instruction as written was
unachievable.

**Resolved.** The *intent* was that metric definitions must not move between
tests, and that is preserved literally rather than by discipline: the pure
measurement functions — `cssMetrics`, `markupMetrics`, `declarations`,
`discretionary`, `semantic`, `propagation`, and the `CHANGES` propagation list
— now live in `idui-core/evidence/metrics.mjs`, which both harnesses import.
The harness around them stays per-product, because each source page is composed
and served differently. `CHANGES` is shared deliberately: a test that invents
its own list of "representative changes" can pick flattering ones.

**Proof the move was faithful.** The pre-extraction script and the
post-extraction script were both run against the same working tree and produce
identical output once the ephemeral server port is normalised. The
extraction changed no metric.

### A2 — 6 September 2026: the Flipgazine evidence is a dated run, and the script overwrites it

Re-running `measure.mjs` today does **not** reproduce the committed
`comparison.json`. The after-side has grown — shared CSS 82,011 → 87,201 bytes,
434 → 451 rules, 5 → 6 media queries — because the core itself has grown since
r33 (the range control, the sortable list, the disclosure toggle, the lifted
material). The published `/evidence` page is stamped with the release it was
measured at, so it is honest; but it is a **pinned historical run, not a live
number**, and running the script silently overwrites `comparison.json` and the
four screenshots. Both were restored from git here.

Consequence for this test: Origarium's before/after must be its own pinned run
with its own stamp, and any comparison with Flipgazine's figures must state
that they were measured against an earlier core.

### A3 — 6 September 2026: renumbered to Test 02

The owner set the series numbering: **01 Flipgazine, 02 Origarium, 03 Betta
(generative), 04 Voice**. This document was written and committed as "Test 03"
under an earlier numbering in which the r32a specimen transfer counted as 01.

The heading is corrected rather than left wrong, because a document that
misnames its own experiment is worse than one whose title moved. Nothing else
is touched. The property that matters — that the predictions existed before the
work — rests on the commit, not on the title: **P01–P05 were frozen in
`828ee41`, before the source was snapshotted and before any Origarium code
existed**, and that commit is unedited in history.

The earlier r32a specimen transfer (`idui-core/evidence/transfer-smoke.mjs`,
`specimens.html`) stays unnumbered. It predates the adversarial series and was
self-confirming by design — IDUI markup rendered under a second constitution —
so it reads as background to 01 rather than as a test of its own.

### A4 — 6 September 2026: the scope is one mode of four

The owner states that Origarium is not the Papers archive. One site carries
**four very different modes**: the papers, a Pokémon-Go-like game view, a dream
state, and a CRM application.

This test measured `/papers` and nothing else. That does not invalidate what it
found — the before-metrics, the material break, the reconstruction and P05 are
all real for the mode they cover — but it bounds what may be claimed. **"The
core met Origarium and mostly stayed still" is not a conclusion this test can
reach.** The defensible claim is narrower:

> The core met Origarium's editorial archive and reader, and the changes it
> needed were four reusable capabilities and no product-specific presentation.

The other three modes are untested surface. A game view in particular is the
kind of thing that would be expected to need genuine product behaviour — a
large **D-B**, which the protocol already says can be large without concern.
Whether it also needs product-specific *presentation* — **D-P**, the alarm — is
simply unknown, and the evidence page must say so rather than imply coverage it
does not have.

The owner also lifted the implicit constraint that the rebuild should keep its
class count low: a product of this range legitimately needs more primitives,
and reluctance to add one is not a virtue when the complexity is intrinsic.
What the protocol still forbids is unchanged — a primitive for appearance
alone, and any presentation owned by the page.
