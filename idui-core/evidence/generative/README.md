# IDUI Test 04 — the generative constitution test

**This file is a manifest. It holds no measurements.** Every number lives in a
dated, immutable state file listed below. A later run may supersede an
interpretation; it may never overwrite the observation it corrected.

The claim under test and the frozen failure taxonomy are in `PROTOCOL.md`,
frozen at `93971ec`. That file's body is never edited — corrections are appended
as dated amendments. Amendment **A3** records this test's renumbering to 04 and
its resumption on a new platform.

## Where the code lives

This test is not part of the Sindhorn app and shares no code with it.

| Implementation | Language | Location |
|---|---|---|
| Android specimen surface | Kotlin / OpenGL ES 2 | `betta-wallpaper` (standalone local repo) |
| Metal | Swift | `macos-betta-metal/Sources/BettaTest04`, beside but never importing `BettaMetalLab` |

Both read a byte-identical `constitution.json`
(`sha256 48e2390674…f152299`). One file consumed by two independent
implementations is what makes the portability claim measurable rather than
asserted.

## States

| File | What it records |
|---|---|
| `tier-a-20260907-android.json` | Tier A on Kotlin. Both states: the failing baseline and the corrected re-run. |
| `tier-a-20260907-metal.json` | Tier A on Swift. |
| `determinism-20260907.json` | Swift/Kotlin bit-level agreement across a sampled seed range. |
| `observations-20260907-render-smoke.md` | A single manual Android emulator capture. **Not Tier B.** |
| `findings-20260907.md` | Difficulties classified A / B / C / D-B / D-P, as known before any rendered sample existed. |
| `negative-controls-20260907.md` | Whether each rendered contract can fail. Two of four did not fire on first run. |
| `tier-b-20260907-metal.json` | Tier B against the frozen sample: 30,000 frames, P1–P5 scored. |
| `findings-20260907-tier-b.md` | Difficulties from Tier B: A-01, B-03, C-02, and D-P-01 still open. |
| `editorial-20260907.md` | **The first editorially accepted output.** 7 of 8 accepted at constitution v4; D-P-01 closed, D-P-02 opened. Two hypotheses about predicting the rejection, both falsified. |
| `findings-20260907-scope.md` | **A-02: the renderer was rebuilt and was never under test.** Also A-03 (R1 encoded a completeness assumption the owner's editorial crops contradict), B-04, B-05, C-03. Supersedes the *interpretation* of the Tier B numbers, not the numbers. |

## Frozen ahead of the next phase

| File | What it fixes |
|---|---|
| `predictions-20260907-tier-b.md` | P1–P5 for the specimen surface and Tier B, frozen at `b9e40df` before any rendered sample was measured. P1 and P2 predict failures. |
| `seeds.json` | The 2,000-seed Tier B sample, written before the first run. Not to be regenerated. |

## Where the result stands

**Both tiers must be re-run.** The Tier A pass covered a smaller parameter set
than the constitution now declares, and the Tier B pass measured a renderer that
has since been deleted — Test 04 had rebuilt the production engine, which was
never the half under test (`findings-20260907-scope.md`, A-02). The numbers on
record stand as measured; what they were measuring has changed.

Test 04 now supplies the generator only. The renderer is the product's own
shader, compiled from its source file and driven directly.

## What has not been done

- **The states measured before `b9e40df` are baseline observations, not tests of
  a prediction**, and none of them may be cited as a prediction confirmed.
  `PROTOCOL.md`'s Q01–Q05 belong to the JS sequence A3 records as never run.
- **The specimen surface does not exist on either platform.** A primitive is
  finished when the specimen surface shows it, not when it renders. Nothing here
  has been laid out for a person to look at.
- **A rendered result has now been editorially accepted** (`editorial-20260907.md`),
  so D-P-01 is closed and the presentation column has a baseline. D-P-02, the one
  rejected frame, is open and unresolved.
- **No global image statistic tested separates the owner's rejection.** AI
  pre-screening of seeds is unsupported on the evidence so far; the owner's own
  rating has no machine substitute.
- **A-01 and B-03 propose constitution changes that have not been made**, because
  changing the constitution requires the owner's approval.
