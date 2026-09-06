# IDUI Test 03 — outside the interface

Frozen 6 September 2026, before any result was measured. Nothing in this file
may be edited once a baseline has been run; a change of mind is recorded as an
amendment below it, dated, with the reason.

## The claim

> A constitution can constrain a **generator** so that every seed produces a
> valid, on-identity result, with zero appearance decisions left in the
> generator.

The transferable idea being tested is the one this codebase already applies to
interfaces, moved to a domain with no interface in it:

| IDUI | Here |
|---|---|
| Pages compose | A **scene** composes: form, ground, framing |
| Primitives behave | **Form generators** — radial membrane, prism, diamond — each with its own deformation and motion |
| Invariants style | Rules that hold for **every** seed |
| Contracts validate | Checks that **reject** an output |
| A page contributes zero appearance | **A seed contributes zero appearance** — it selects within a space the constitution defines |

Why this is the most falsifiable IDUI test so far: the adversary is not another
designer's product, it is randomness. Every seed is an author with no
judgement, and there are 16,777,216 of them.

## Constructional validity

The result being tested is **not** "the output we keep is valid". It is:

> **Constructional validity** — every sampled seed passes on first generation,
> without rejection, retry, resampling or repair.

Contracts here are **diagnostic, never filtering**. A rejected raw seed is a
finding: the constitution failed to constrain the generator. Any code path that
discards a seed and draws another invalidates the run.

Contracts reveal invalidity. They do not create validity — only changes to the
constitution and the generator do.

## Two tiers, reported separately

The two numbers must never be merged, and the strong one must never lend its
credibility to the weak one.

**Tier A — style level, exhaustive.** Pure arithmetic on the generated style
object; no renderer. Measured at 11 µs per seed, so the whole space runs in
~3.1 minutes. Tier A is reported over **all 16,777,216 seeds**, as a proof
rather than a sample.

**Tier B — rendered, sampled.** Framing, motion, performance. Reported as
`seeds × viewports × time samples`, with the exact surface stated. Frozen
sample: **10,000 seeds × 3 viewports × 5 deterministic motion times**. Seeds
are the first 10,000 of a SplitMix64 stream from seed `0x1DU104`, written to
`seeds.json` before the first run. Viewports: 390×844, 768×1024, 1240×900.
Motion times: 0, 1.7, 4.1, 9.3, 21.0 seconds on a pinned clock.

Performance is judged against the Betta ceiling **on the reference device**,
not on headless timing alone.

## Frozen failure taxonomy

Categories are fixed now so they cannot be invented to flatter a result.

- **T1 non-finite** — any parameter NaN or Infinity
- **T2 out of gamut** — a palette or gradient colour outside the constitution's declared range
- **T3 degenerate material** — opacity or transmission at a clamp, scale ≤ 0
- **T4 out of vocabulary** — a parameter outside the range the constitution declares for it. For the baseline, "the constitution" is the eight presets' own declared min/max, since those are the de facto constitution today
- **T5 palette collapse** — the four palette colours mutually indistinguishable
- **T6 figure/ground collapse** — palette and background gradient indistinguishable
- **T7 seed collision** — two seeds producing an identical style
- **T8 temporal** — valid at t=0, invalid at a later frozen time sample
- **T9 framing** — the form leaves its declared framing: full crop, or empty frame

A violation that fits none of these is recorded as **T0 unclassified** and the
taxonomy is amended, dated, rather than quietly widened.

## Metrics

- **Generator Discretion Count** — every number, string or branch in generator
  code whose value exists because somebody decided what would look good. The
  procedural analogue of discretionary ADPE. Measured today, before any change:
  `generateBettaStyle` is 22 lines with **44 numeric literals, 19 of them
  hand-tuned RNG bounds**; the eight presets carry **437** literals.
- **Constructional validity rate** — Tier A over the whole space, Tier B over
  the frozen sample. Reported separately.
- **Coverage** — validity is not coverage. A generator that always draws the
  same safe fish passes everything. Coverage asks whether the output actually
  spans the constitution's declared axes (organic↔geometric, light↔dark,
  still↔active) or clusters in a band.
- **Determinism** — the same seed yields the same style across runs and across
  platforms. This is a contract in its own right, and the precondition for the
  Mac port consuming the same constitution.

## The axes the constitution owns

- **form**: organic ↔ geometric (fluid membrane … diamond, prism)
- **luminance**: light ↔ dark, for ground *and* form
- **energy**: still ↔ active movement

A seed picks a point in that space. It never names a colour, an opacity or a
bound.

## Where 4.5:1 belongs

Contrast at 4.5:1 is a **text** threshold, not a universal shape-versus-ground
rule, and forcing it on the artwork would destroy legitimate low-contrast
results. It applies only where a product places text over the output — which
Sindhorn does, and the art constitution does not. Same generator, two
constitutions, one carrying an extra contract because its product puts words on
top. That is the separation demonstrating itself, and it is recorded here as a
prediction of how the split should behave, not as a convenience.

## Frozen predictions

- **Q01** The generator currently holds ≥15 appearance decisions the
  constitution should own. *(Measured before freezing: 19 tuned bounds, 44
  literals.)*
- **Q02** Extraction is possible for the parametric decisions without changing
  output for a fixed seed set.
- **Q03** Adding a rigid family (prism, diamond) beside the membrane will
  require a **new primitive**, not a new parameter — different topology, not a
  deformation.
- **Q04** The current unconstrained generator will produce at least one
  contract violation in the frozen sample. After taste extraction and
  constitution constraints, the same sample will exhibit fewer violations, with
  zero observed violations as the target.
- **Q05** The eight existing presets are not a constitution — they are 437
  literals — and most will dissolve into ranges.

## Sequence

1. Freeze this protocol, the contracts, the seed list, viewports and time
   samples. **No result measured before this file is committed.**
2. Run the baseline against the current generator, unchanged.
3. Publish the observed violation rate and the failure taxonomy as found.
4. Extract the 19 tuned ranges into constitution data.
5. Prove fixed-seed parameter/output equivalence for the extractable parts.
6. Re-run the identical frozen sample.
7. Add rigid topology as a genuinely new form primitive.
8. Run the constitution swap with the same seeds.
9. Only afterward expand sampling or attempt wider coverage.

## Rules

- All work happens in `betta-random-2.js` and this folder. **`site/betta-random.js`
  is never modified**: it is pinned by the eight saved production period styles,
  which `scripts/betta-periods-release-smoke.mjs` requires to reproduce from
  their seeds, and by bit-exact parity with the macOS Betta Metal Lab. Mac
  parity is left alone.
- The constitution is a **JSON data file**, not JavaScript, so the web
  implementation and any later Mac or starter-kit implementation consume the
  same file. Portability then becomes measured evidence rather than a
  documented intention.
- No retries, no resampling, no repair anywhere in the generation path.
- The result is not named "passed". It is named by what held and what did not.

## Amendments

### A1 — 6 September 2026: renumbered to Test 03

The owner set the series numbering: **01 Flipgazine, 02 Origarium, 03 Betta
(generative), 04 Voice**. This document was written and committed as "Test 04".
The heading is corrected; nothing else is. The predictions Q01–Q05 were frozen
in **`93971ec`**, before any result was measured, and that commit is unedited in
history.
