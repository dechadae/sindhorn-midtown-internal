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
| `findings-20260907.md` | Difficulties classified A / B / C / D-B / D-P. |

## What has not been done

- **Tier B has not been run on any platform.** No sampled, rendered measurement
  exists. The one render observation on record is a single seed, single moment,
  single aspect ratio.
- **No predictions are frozen for this incarnation.** `PROTOCOL.md`'s Q01–Q05
  belong to the JS sequence A3 records as never run, so nothing measured so far
  may be cited as a prediction confirmed.
- **No contract has been exercised by a negative control**, so no green result
  here has yet been shown to be green for the right reason.
- **The specimen surface does not exist on Metal.** A primitive is finished when
  the specimen surface shows it, not when it renders.
