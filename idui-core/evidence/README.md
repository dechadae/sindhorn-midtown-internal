# IDUI transfer tests

Numbered by the owner, 6 September 2026. Each test is frozen before it runs:
its protocol and predictions are committed on their own hash, so "predicted
before implementation" is checkable rather than asserted.

| | Test | Subject | State | Frozen at |
|---|---|---|---|---|
| **01** | The Rebuild Test | Flipgazine, "Moving to Claude Code" | Done — published at `/evidence` | r33 |
| **02** | Origarium Papers | An editorial archive and long-form reader | Measured — not yet published | `828ee41` |
| **03** | Apple | Three modules of the homepage, no Apple imagery or type | Protocol frozen | `PENDING` |

Those three are the interface rebuilds, and they are what the `/idui` footer
lists. Two further tests are **on hold** (owner, 6 Sep 2026):

| Test | Subject | State | Frozen at |
|---|---|---|---|
| Betta | The generator: design with no UI in it | Protocol frozen, on hold | `93971ec` |
| Voice | Editorial voice transfer | On hold | — |

The Betta protocol's heading still says "Test 03" from an earlier numbering.
It is deliberately not renumbered again — the heading is not where the meaning
lives, and the commit that froze its predictions is unedited. If it resumes it
takes the next free number then.

Tests 02 and 03 were written under an earlier numbering, as "Test 03" and
"Test 04", when the r32a specimen transfer counted as 01. Their headings were
corrected and the reason recorded as an amendment in each; the commits above
are unedited, which is where the property that matters actually lives.

The r32a specimen transfer (`transfer-smoke.mjs`, `specimens.html`, and the
`sindhorn.*`/`flipgazine.*` renders beside them) stays unnumbered. It predates
the adversarial series and was self-confirming by design — IDUI markup rendered
under a second constitution — so it reads as background to 01 rather than as a
test of its own.

## What lives here

- `metrics.mjs` — the metric definitions every test shares. The harness around
  them is per-product; the definitions are not, or a comparison between tests
  measures the measurer.
- `rebuild/` — Test 01. **`comparison.json` and its screenshots are a pinned
  historical run**: re-running `measure.mjs` overwrites them and no longer
  reproduces them, because the core has grown since r33.
- `origarium/` — Test 02.
- `generative/` — Test 03.
