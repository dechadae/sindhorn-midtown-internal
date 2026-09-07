# IDUI transfer tests

Numbered by the owner, 6 September 2026. Each test is frozen before it runs:
its protocol and predictions are committed on their own hash, so "predicted
before implementation" is checkable rather than asserted.

| | Test | Subject | State | Frozen at |
|---|---|---|---|---|
| **01** | The Rebuild Test | Flipgazine, "Moving to Claude Code" | Done — published at `/evidence` | r33 |
| **02** | Origarium Papers | An editorial archive and long-form reader | **Architecture Held With Nine Corrections; Editorial Parity Partial (~70%)** | `828ee41` |
| **03** | Apple | Three modules of the homepage, no Apple imagery or type | Protocol frozen | `79d34cd` |

Those three are the interface rebuilds, and they are what the `/idui` footer
lists. One further test is **on hold** (owner, 6 Sep 2026):

| Test | Subject | State | Frozen at |
|---|---|---|---|
| Voice | Editorial voice transfer | On hold | — |

**04 Betta** resumed 7 September 2026 as a new, standalone Android native live
wallpaper app — its own repository, no code shared with this one — testing the
same claim frozen at `93971ec` on a platform with no CSS, no DOM and no
stylesheet cascade. Its protocol's heading still reads "Test 03" from the
numbering scheme before this one; that is deliberately left alone (the heading
is not where the meaning lives, and the commit that froze its predictions is
unedited) and the renumbering to 04 is recorded as amendment A3 in
`idui-core/evidence/generative/PROTOCOL.md`, not as an edit to the frozen text.

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
- `generative/` — Test 04's frozen protocol only. The resumed Android
  implementation and its own evidence live in that app's own repository, not
  here (see `PROTOCOL.md` amendment A3).

## Operational trials

Beside the numbered sequence, and not part of it. A trial governs a real
feature while it is being built rather than reconstructing a finished one.

| | Feature | Question | Status |
|---|---|---|---|
| **A** | Moodboard transplant, Flipgazine to Sindhorn | Can IDUI govern a behaviour-heavy feature during development? | Protocol frozen 6 Sep 2026; **not started** |
