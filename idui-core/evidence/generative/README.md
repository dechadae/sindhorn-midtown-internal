# IDUI Test 04 — the generative constitution test

**This file is a manifest. It holds no measurements.** Every number lives in a
dated, immutable state file listed below. A later run may supersede an
interpretation; it may never overwrite the observation it corrected.

The claim under test and the frozen failure taxonomy are in `PROTOCOL.md`,
frozen at `93971ec`. That file's body is never edited — corrections are appended
as dated amendments. Amendment **A3** records this test's renumbering to 04 and
its resumption on a new platform; **A4** records its publication as the third
test of the series, **03 Betta** at `/betta`, while this record keeps "Test 04".

`published.json` is the JSON manifest behind that page: every number on
`/betta` is read by `scripts/build-betta.mjs` from a state it lists, and
`scripts/evidence-append-only.mjs` proves none has moved.

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
| `blind-20260907/` | **Claude rated 20 frames blind against the owner. Cohen's κ = 0.00** — agreement exactly at chance. One of two taste controls turned out to be invalid. |
| `editorial-20260907.md` | **The first editorially accepted output.** 7 of 8 accepted at constitution v4; D-P-01 closed, D-P-02 opened. Two hypotheses about predicting the rejection, both falsified. |
| `findings-20260907-scope.md` | **A-02: the renderer was rebuilt and was never under test.** Also A-03 (R1 encoded a completeness assumption the owner's editorial crops contradict), B-04, B-05, C-03. Supersedes the *interpretation* of the Tier B numbers, not the numbers. |
| `review-20260907/rule-prediction.json` | The written rule applied mechanically to twenty seeds, committed before the owner judged them. **The owner's verdicts on those twenty were never pinned**, so this has no result. |
| `tier-a-20260908-metal-v5.json` | **Tier A re-run at constitution v5**: 100,000 seeds, 0 violations, 0 collisions. The v1 figure above stands as measured; this is the one the shipped constitution can cite. |
| `variety-20260908.json` | Output variety per arm, 400 seeds each: the allowlist arm B reaches about half the parameter distance of A and C. Descriptive, added after round one. |
| `judgements-r1-20260907.csv`, `judgements-r2-20260907.csv` | The raw Mac verdicts, copied verbatim from `macos-betta-metal/`: 244 and 240 rows of `arm,seed,composition,verdict`. |
| `keep-rate-20260908.json` | The two keep-rate rounds summarised from those files (the build verifies the summary against them). Pooled A 82/144, B 99/148, C 71/131. **Conclusion: the arm comparison was the wrong instrument for the claim.** |
| `phone-verdicts-20260908.json` | The Betta Explorer's `betta_verdicts` rows by build, 633 in all, 34 excluded as a black-screen build's. Arm C keeps at about a third on the phone against about a half on the Mac. |
| `figures/` | Two judged frames from round one, same arm and crop, one kept and one rejected, recovered from their rows. Illustrations. |

## Frozen ahead of the next phase

| File | What it fixes |
|---|---|
| `predictions-20260907-tier-b.md` | P1–P5 for the specimen surface and Tier B, frozen at `b9e40df` before any rendered sample was measured. P1 and P2 predict failures. |
| `seeds.json` | The 2,000-seed Tier B sample, written before the first run. Not to be regenerated. |

## Where the result stands

**Valid By Construction; Taste Not Guaranteed** — the verdict published at `/betta`
on 8 September 2026 (amendment A4). Tier A has been re-run at v5 and holds;
determinism across Swift and Kotlin holds. Tier B has **not** been re-run
through the production shader: the 7 September Tier B pass measured a renderer
that has since been deleted — Test 04 had rebuilt the production engine, which
was never the half under test (`findings-20260907-scope.md`, A-02). Those
numbers stand as measured; what they were measuring has changed.

The keep-rate arm comparison (484 Mac verdicts, 599 phone verdicts) was closed
by the owner on 7 September as the wrong instrument for the claim: the arms
are indistinguishable in the band where they are blind, and a judge who wrote
the hypotheses cannot be blinded to an arm that differs enough to differ. What
it did measure is recorded, with the conclusion, in `keep-rate-20260908.json`.

Test 04 supplies the generator only. The renderer is the product's own shader,
compiled from its source file and driven directly.

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
- **Claude's taste does not predict the owner's.** A pre-registered blind test
  over 20 frames returned Cohen's κ = 0.00 (`blind-20260907/`). AI pre-screening
  of seeds is unsupported, and the owner's rating in any control condition has
  no machine substitute. Measured, not argued.
- **A-01 and B-03 propose constitution changes that have not been made**, because
  changing the constitution requires the owner's approval.
- **The D-P audit of the v5 sampler has not been done.** Zero contract
  violations across 100,000 seeds is not a proof that no appearance decision
  remains in the generator; that is a reading of the code, and it is owed.
- **Tier B at v5, through the production shader, with predictions re-frozen
  first.** The frozen P1–P5 belong to the deleted renderer.
