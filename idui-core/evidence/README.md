# IDUI transfer tests

Numbered by the owner, 6 September 2026. Each test is frozen before it runs:
its protocol and predictions are committed on their own hash, so "predicted
before implementation" is checkable rather than asserted.

| | Test | Subject | State | Frozen at |
|---|---|---|---|---|
| **01** | The Rebuild Test | Flipgazine, "Moving to Claude Code" | Done — published at `/evidence` | r33 |
| **02** | Origarium Papers | An editorial archive and long-form reader | In progress — before side measured | `828ee41` |
| **03** | Outside the interface | The Betta generator: design with no UI in it | Protocol frozen, not started | `93971ec` |
| **04** | Voice | Editorial voice transfer | On hold | — |

Candidate, unnumbered: **Origarium's CRM**. Dense interface — tables, forms,
states, density — a different adversary from an editorial archive, and the mode
of Origarium that puts the transfer question most sharply. Its game view and
dream state are mostly WebGL and belong nearer Test 03 than here.

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
