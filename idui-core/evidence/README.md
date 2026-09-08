# IDUI transfer tests

Numbered by the owner, 6 September 2026. Each test is frozen before it runs:
its protocol and predictions are committed on their own hash, so "predicted
before implementation" is checkable rather than asserted.

| | Test | Subject | State | Frozen at |
|---|---|---|---|---|
| **01** | The Rebuild Test | Flipgazine, "Moving to Claude Code" | Done — published at `/evidence` | r33 |
| **02** | Origarium Papers | An editorial archive and long-form reader | **Architecture Held With Nine Corrections; Editorial Parity Partial (~70%)** | `828ee41` |
| **03** | Betta | The Betta engine's generative constitution — a wallpaper from a seed, no CSS, no DOM | **Valid By Construction; Taste Not Guaranteed** — published at `/betta` | `93971ec` |

Those three are what the `/idui` footer lists (owner, 8 Sep 2026). Two further
tests are **not in the published series**:

| Test | Subject | State | Frozen at |
|---|---|---|---|
| Apple | Three modules of the homepage, no Apple imagery or type | Protocol frozen, never run; withdrawn from the footer 8 Sep 2026 | `79d34cd` |
| Voice | Editorial voice transfer | On hold (owner, 6 Sep 2026) | — |

**Betta is "Test 04" in its own record.** It resumed 7 September 2026 while
Apple held 03, and every state file it froze since says 04; a file hashed into
a manifest cannot be renamed to say otherwise. So the footer counts what was
published and the record counts what was frozen — amendment A4 in
`idui-core/evidence/generative/PROTOCOL.md`, appended and not edited in. Its
protocol's heading still reads "Test 03" from an earlier scheme, deliberately
left alone for the same reason (A2, A3).

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
- `generative/` — Test 04, published as 03 Betta. The frozen protocol with
  its amendments, the state files, and `published.json`, the manifest behind
  `/betta`. The Mac harness is `macos-betta-metal/` on the
  `macos-betta-display-1.2` branch; the phone explorer is its own repository.

## Operational trials

Beside the numbered sequence, and not part of it. A trial governs a real
feature while it is being built rather than reconstructing a finished one.

| | Feature | Question | Status |
|---|---|---|---|
| **A** | Moodboard transplant, Flipgazine to Sindhorn | Can IDUI govern a behaviour-heavy feature during development? | Protocol frozen 6 Sep 2026; **not started** |
