# IDUI Test 03 — Apple

Frozen 6 September 2026, before the source was captured and before any Apple
code existed. Committed on its own hash so "predicted before implementation" is
checkable. Amendments are appended below, dated, never edited in.

## The question

> Can a methodology built by **removing** design decisions reconstruct a design
> whose quality depends on exceptionally **precise** design decisions — without
> copying its implementation, flattening its identity, or returning those
> decisions to the page?

Test 01 asked whether IDUI transfers away from Sindhorn. Test 02 asked whether
it survives a second material and an editorial mode. Apple asks something the
first two could not:

> Can IDUI leave an already excellent design alone?

There is no "we improved the old CSS" escape route here. The frozen Apple
reference is the authority, and it is better than anything the rebuild will do.

## Two substitutions, decided before the start

The owner set both (6 Sep 2026), and they are not concessions — each makes the
result mean more.

**Type.** SF Pro is not licensable for this, so the reconstruction uses the
closest widely available neutral grotesque, **Inter**. Declared, not hidden.

**Imagery.** No Apple photography, anywhere. Every artwork slot is filled with
an **Apple-style gradient** derived from the Apple constitution. This is the
more important of the two, because Apple's homepage is mostly art-directed
photography: a reconstruction showing Apple's own images would score highly on
"looks like Apple" while telling us nothing about IDUI. Removing them sharpens
the question to the one worth asking:

> With neutral artwork in the same slots, does the **structure** still read as
> Apple?

If yes, IDUI reproduced the design. If it only reads as Apple with Apple's
photographs in it, IDUI reproduced a photo gallery.

## Source boundary

The live URL is **not** the evidence source once the test begins; the frozen
snapshot is. Captured with locale, viewport, user agent, timestamp and hashes.
Apple has an event on 9 September and the homepage is unusually likely to
change, so if the source moves mid-test the run is annotated, never
silently retargeted.

Nothing proprietary is redistributed. The evidence package carries hashes,
manifests, measurements and the reconstruction — which contains no Apple font,
no Apple image and no Apple CSS.

## Clean room

Apple's public implementation may be inspected to understand it. It may not be
converted.

```
Apple rendered product + public inspection + measurements
        ↓  observed design decisions
        ↓  Apple constitution
        ↓  IDUI composition + behaviour
        ↓  independent reconstruction
```

Forbidden: Apple CSS → copy → rename selectors → IDUI. That path is barred for
a scientific reason before a legal one — it would tell us nothing about IDUI.

## Scope

Three modules, not the homepage. Each puts a different question:

1. **A full-bleed promotional hero** — the artwork field, type scale, emphasis
2. **A two-up tile grid** — composition, alignment, responsive behaviour
3. **The entertainment rail** — the only one with real interaction, and so the
   only place A03 gets tested

## Frozen predictions

- **A01 — Zero page discretion.** Page-owned appearance decisions reach 0.
  Pages specify content, semantics, hierarchy and composition; never values.
- **A02 — Composition survives.** Apple's heroes and tiles do not each require
  a component variant. Falsified the moment the rebuild contains
  `hero-left`, `hero-left-large`, `hero-bottom-product-large`.
- **A03 — Appearance does not earn primitives.** A promotional module that
  merely looks different justifies nothing. A carousel may, because it has
  state, focus, keyboard behaviour and a lifecycle.
- **A04 — Responsive art direction is real complexity.** It belongs in semantic
  art-direction data or reusable behaviour, never in per-section media queries
  in the page.
- **A05 — Identity does not converge.** The reconstruction keeps Apple's
  identity without acquiring Sindhorn's material, Flipgazine's rhythm,
  Origarium's editorial treatment, or a generic IDUI signature.
- **A06 — Core remains mostly still.** Apple should need a constitution, not an
  Apple-shaped core. Every core change survives A/B/C/D.
- **A07 — The face substitution costs something, and it is bounded.** Inter is
  not SF Pro. The amount of "looks like Apple" lost to type is stated before
  the editorial judgement, so it cannot be confused afterwards with a failure
  of the architecture.
- **A08 — The artwork field is a surface role.** A hero's artwork is a surface
  whose material the constitution derives, the way a document is
  (`data-surface="document"`, r41). The page names no colour and no gradient.

## A05 is measured, not squinted at

The genericisation check is the most valuable thing in this test and the
easiest to fudge, because the implementer would be judging their own work.
So it is computed.

A **fingerprint** is taken across all four products from the render probe that
already exists — radius distribution, spacing rhythm, content width, headline
to body ratio, control shape, section cadence — and the question is whether the
four **cluster or stay apart**. Sindhorn, Flipgazine and Origarium are built and
measurable today, so the baseline exists before Apple starts.

The type face is **excluded** from the fingerprint and reported separately: two
constitutions now use Inter, so including it would manufacture convergence that
is an artefact of the substitution rather than of the method.

The blind squint stays, as the owner's judgement, labelled subjective.

## Three experiments

**1 · Fidelity without imitation.** Reconstruct the three modules at 390, 768
and 1440. Structural comparison only — bounding boxes of key elements,
alignment, type-scale ratios, spacing rhythm, section order, responsive
transitions. **Not pixel similarity**: on a page whose original is dominated by
photography, and whose rebuild deliberately replaces it, a percentage would be
noise wearing a decimal point.

**2 · Architectural burden.** Every difficulty enters the same ledger as Test
02 — **A** misowned core assumption, **B** constitution concern, **C** missing
reusable capability, **D** Apple-specific. D is never free: each publishes
description, rationale, file, lines, literals, and a split into **D-B**
(behaviour, healthy when intrinsic) and **D-P** (presentation, the alarm).
Several hundred lines of legitimate carousel behaviour is a far better outcome
than a small amount of D-P.

**3 · Derivation locality.** Not a maintainability comparison against Apple —
we hold only their compiled artefact, and that comparison would be dishonest.
Instead, three constitutional changes: promotional headline scale, CTA
treatment, promotional section spacing. Report constitution locations changed,
page files changed, local repairs required, unintended instances affected.

## Constitution burden

Reported, because otherwise Apple can be smuggled in as a thousand-line
settings form:

- semantic rules, tokens, independent visual decisions, page-specific rules,
  exceptions
- and how many tokens are consumed by exactly one rule

The dangerous result is not a large file. It is
`iphone-hero-title-top: 97px`. That is page CSS wearing a constitution costume,
and it is scored as a failure. A valid constitution describes relationships —
*a promotional hero is a centred editorial stack, the artwork occupies the
remaining field, emphasis determines title scale, tone derives foreground* —
not screenshot coordinates.

## Valid ≠ selected

When two candidates both pass every contract, at least one pair is preserved
and the owner selects. Recorded as conformance PASS / selection REJECTED, with
the reason given as editorial judgement. No contract is invented afterwards to
justify a preference. "A feels cramped" leaves A valid; it was edited out, not
failed.

## Stopping rule

Stop and publish the partial result when **any one** of these is observed, at
whatever point it appears — not at a percentage of completion, which is not
measurable:

- page presentation is required to hold Apple's identity
- the constitution is accumulating screenshot coordinates
- **D-P exceeds D-B**
- the core is expanding to accommodate this one homepage

A failed Apple reconstruction is still useful evidence. Do not rescue IDUI by
finishing through exceptions.

## Headline metrics

| Metric | Target |
|---|---|
| Page-authored CSS | 0 |
| Inline appearance styles | 0 |
| Discretionary ADPE | 0 |
| Visual literals in page code | 0 |
| Appearance-only primitives introduced | 0 |
| D-P burden | 0, or small and fully disclosed |
| Functional parity | met |
| Unexplained visual deviations | 0 |

No target is set for total CSS bytes. If IDUI loses that, the loss is
published, as it was in Test 01.

## Naming the result

Not PASS or FAIL. One of:

> **Held Without New Core Law** · **Held With N Core Corrections** ·
> **Held Structurally, Lost Editorial Fidelity** ·
> **Did Not Hold — Apple-Specific Presentation Required**

The third is the most interesting outcome available: conformance succeeded and
expressive capacity failed. If that happens it is published in exactly those
words.

## Amendments

### A1 — 6 September 2026: D-P is only meaningful against an accepted reconstruction

The owner rejected Candidate A's reader on editorial parity while every
contract passed, and that exposes a hole in how this test — and Test 03 —
reports its headline number.

Candidate A reported **D-P = 0**: no product-specific presentation was needed.
That is technically true and, as a claim of success, worthless, because an
architecture can reach zero D-P **by refusing to reproduce the difficult part
of the identity**. Normalise away what is hard and the ledger looks perfect.

So the interpretation rule changes, for every test in this series:

> **Product-specific presentation burden is evaluated only against an
> editorially accepted reconstruction.** Zero D-P with rejected fidelity is not
> a win. It is *unresolved*.

Nothing about how D-P is counted changes; what changes is when the number is
allowed to mean anything. A result now needs both halves — the ledger and the
owner's acceptance — before it can be called held.

This is the strongest methodological finding the series has produced, and it
came from a rejection rather than a pass.

### A2 — 6 September 2026: the inferred intent brief, frozen before implementation

Test 02 ended on a finding this protocol cannot survive unamended. Two
reconstructions of Origarium passed every contract; the owner rejected one and
accepted the other at 70%, and what separated them was a single sentence of
design intent — *the thumbnail is an e-ink reader, and pressing it bounces to
full screen*. The instruments had already read every value on the page. They
could not read what the thing **was**.

> Rendered outcomes expose values. They do not necessarily expose reasons.

Origarium had a designer to ask. **Apple will not.** That difference forces two
questions apart which this protocol had been treating as one:

- ❌ *Given the designer's intent, can IDUI encode Apple?* — untestable here.
  Apple's internal brief is not available and inventing one would be fiction.
- ✅ **Given public rendered evidence and public behaviour, how much of a
  design's governing intent can be reconstructed, and what remains
  underdetermined?**

The second is the honest question, and it is more adversarial than the first.

**Requirement.** Before any Apple reconstruction begins, the source study must
produce a frozen **inferred intent brief** — concepts and relationships, in the
shape of Origarium's four lines, not values — committed on its own hash and
labelled in the file itself:

> **Inferred, not authoritative.** Reconstructed from public rendered evidence.
> No Apple design documentation was consulted, because none is available.

The reconstruction is then built **from that brief**, not from the screenshots
directly. Afterwards two things can be inspected separately, which is the whole
point:

1. Was the inferred intent model any good?
2. Given that model, did IDUI implement it without local appearance authority?

**Consequence for the verdict.** A fidelity failure must now be attributed to
one of those before the test may name a result. An intent-recovery failure is
**not** an IDUI-governance failure, and reporting it as one would overstate the
architecture's weakness exactly as reporting the reverse would overstate its
strength. Both are published either way.

This also bounds what the whole method may claim, and the bound belongs in this
protocol rather than only in Test 02's results:

> Centralising the wrong interpretation only makes the wrong interpretation
> systematic. Contracts cannot rescue misunderstood intent.

