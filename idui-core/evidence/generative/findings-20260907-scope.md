# Findings: the renderer was never under test

Recorded 7 September 2026, after the owner asked a one-line question that
invalidated a day's work: *"why create a new one when you get a full suite
working engine?"*

This file supersedes no observation. The numbers in
`tier-b-20260907-metal.json` stand exactly as measured; what changes is what
they were measuring, and that is recorded here rather than by editing them.

---

## A-02 — The engine was rebuilt, and it was never the thing under test

The frozen claim is that a constitution can constrain a **generator** so that
every seed produces a valid result *with zero appearance decisions left in the
generator*. It says nothing about the renderer.

Test 01 had already settled the principle, in this directory:

> The engines are **preserved, never IDUI-ified**: IDUI governs the interface's
> relationship with an engine, **it does not absorb one**.

I wrote a new membrane renderer anyway, on the strength of one line in the
brief — "the wallpaper is a new implementation" — applied to the whole system
rather than to the generator. The result was a single welded sheet with no
per-ray identity, which the owner correctly called low-poly student work beside
his own renders.

Classified **A**: a misowned core assumption. Not about ranges or contracts, but
about which half of the system the test is even addressing.

**The cost was not only visual.** Holding the renderer constant and swapping only
the generator is the cleanest possible control: one variable. I spent a long
stretch of this session designing an elaborate control condition while having
already destroyed the easy one.

### What the numbers now mean

`tier-b-20260907-metal.json` measured a renderer that has since been deleted.
Its 30,000 frames, its 10,000 R1 violations and its 584 R2 violations are
faithful observations of a thing that no longer exists in the codebase. **They
may not be cited as evidence about the generator.** Any Tier B claim about this
test has to be re-measured through the engine.

## A-03 — R1 encoded a programmer's assumption about images

R1 required the form to be *wholly inside the frame*. Run against the owner's
eight locked compositions it would reject all eight: every one is scaled up
1.25–1.90 and pushed off-centre, with fish 7 at the clamp ceiling of x = 8.0.

The owner's account: *"i'm a graphic designer, thats how i cropped artwork, the
art itself doesn't have to be shown in full shapes. they are just editorially
cropped."*

The frame is the composition and the artwork runs through it. R1 was measuring
my default assumption and reporting 10,000 violations of it. **This is the
protocol's own warning arriving on schedule** — *measurement recovers values,
never intent* — and one sentence of stated intent dissolved the headline finding
of a 30,000-frame run.

R1 is replaced by **presence**: something is in frame, and it has form. Paired
with internal contrast, that permits every crop a designer would make and
rejects only the empty frame and the featureless wash.

## B-04 — Three parameter families were missing, and each one showed

The constitution covered 20 parameters. The engine exposes roughly 28, and the
gaps were not decorative:

| Missing | Consequence |
|---|---|
| sRGB→linear palette conversion | display-space values fed to a linear pipeline; everything read dull |
| `brightness` (1.64–1.88), `saturation` (1.18–1.46) | rendering at an implicit 1.0 against an engine that grades well above it |
| the whole `detail` block — `rayDefinition`, `veinStrength`, `membraneGrain`, `microFold`, `edgeRuffle`, `fineFlutter`, `normalDetail` | no fine structure at all; the membrane could not read as rays however dense the mesh |

A constitution that does not cover an engine's full appearance surface does not
constrain that engine — it silently defaults the remainder. **Coverage of the
surface is a precondition for the claim, not a detail of it.**

## B-05 — The ground was one number where the product has a place

v1 declared `backgroundLightness`, a scalar, and painted a flat fill. Every frame
whose organism was cropped away read as empty, and I scored those 1 and 2 out of 5.

The owner: *"professional human designer are not afraid of negative space… the
gradient bg itself is good enough to be a wallpaper then that result will
survive my review."*

In this artwork the ground does half the work. v2 gave it three stops, a radial
falloff, a sweep and a vignette; v3 hands those to the engine's own background
shader. The before/after is unambiguous and the earlier low scores were scoring
an unbuilt feature.

## C-03 — Composition data is not portable without its frustum

The eight locked compositions were applied to a camera they were not authored
against, and threw the organism out of frame entirely — three of the first four
renders were empty or near-empty. Their translations run to ±8 and read
correctly only at 32° FOV with the camera at z = 9.

The engine's own parity document describes a mapper that reprojects composition
*intent* through a reference frustum rather than copying numbers. I copied
numbers. **A composition is meaningless without the frustum it was composed in**,
and nothing in the data says which frustum that is.

Also worth recording: those eight compositions exist **only in one machine's
`UserDefaults`** (`sindhorn-betta-metal:landscape-compositions:v2`). A read-only
copy is now committed beside the Test 04 target; the live store was not written to.

---

## Where the test actually stands

- The generator, the constitution and the contracts are Test 04's. The renderer
  is the product's and stays the product's.
- **Tier A must be re-run against constitution v3.** The earlier pass covered a
  smaller parameter set.
- **Tier B must be re-measured through the engine**, with R1 rewritten as
  presence. Predictions for that phase need re-freezing first; the ones at
  `b9e40df` were written against a renderer that has been deleted.
- The owner has seen engine-rendered output and said *"looks good"* — that is
  approval of direction, and it is **not** an editorial acceptance of fidelity.
  **D-P-01 remains open.**
