# Frozen predictions — specimen surface and Tier B

**Frozen 7 September 2026, before any rendered sample was measured.** Nothing in
this file may be edited once the phase has been run. A change of mind is
recorded as a dated amendment below it, with the reason.

Test: IDUI Test 04 (see `PROTOCOL.md` amendment A3). This file exists because
`PROTOCOL.md`'s Q01–Q05 were written for the JS `betta-random-2.js` sequence
that A3 records as never run, so this incarnation had no predictions of its own.
The states in `tier-a-20260907-*.json`, `determinism-20260907.json` and
`observations-20260907-render-smoke.md` were measured *before* this freeze and
are therefore baseline observations. **None of them may be cited as a prediction
confirmed.**

## The frozen sample

Written before the first run and not to be regenerated:

- **Seeds** — `seeds.json`, 2,000 seeds, all distinct, the first 2,000 outputs
  of a SplitMix64 stream from `0x1D0104`.
  `sha256 801aa5b866a3da1590329ee2924437927dc76a162693ff6baef77c0198f31e09`
- **Surfaces** — three, because framing is fixed and never seed-touched, so
  robustness across shapes is the framing primitive's burden to carry:
  phone portrait `1080×2400`, Mac landscape `2560×1600`, square `1024×1024`.
- **Moments** — five fixed elapsed times on a pinned clock: `0, 1.7, 4.1, 9.3,
  21.0` seconds, mirroring the protocol's own time samples. Phase is computed as
  `wrap(t × motionSpeed)` and set directly. **The clock is never waited on.** A
  check that observes elapsed time rather than a state the system states has put
  this series in the red before.
- **Constitution** — `sha256 48e239067408428afbc4e3dd85b8f6da28cc1d89e8d78d98a4924ee1cf152299`,
  the same file both implementations read.

That is 2,000 × 3 × 5 = **30,000 rendered frames**, produced offscreen. Tier A
and Tier B are reported separately and never merged.

## Predictions

**P1 — Containment fails for at least one seed. Predicted: FAIL.**
Not every seed's form will lie wholly inside the frame across all three
surfaces. Framing is fixed while `form.spread` varies the angular sweep, and the
single Android capture already showed clipping before the camera was moved. I
expect a non-zero clipped count, largest on the square surface.
*Falsified if* zero seeds clip on all three surfaces.

**P2 — Rendered figure/ground collapse occurs even though Tier A passes T6.
Predicted: FAIL, small count.**
Tier A separates HSL *parameters*; the rendered pixel additionally passes through
opacity, transmission, rim and blending. I expect a small number of seeds whose
parameters separate but whose drawn pixels do not.
*Falsified if* zero seeds fall below the rendered separation floor.
**If P2 returns zero, the check is to be suspected before the result is
celebrated** — a contract that cannot fail is the failure mode this series has
already paid for.

**P3 — Render determinism holds. Predicted: PASS.**
The same seed at the same phase on the same surface produces bit-identical
pixels across runs and across process restarts.
*Falsified if* any frame differs by a single bit.

**P4 — Coverage is broad, not clustered. Predicted: PASS, weakly held.**
Rendered mean luminance and dominant hue across the 2,000 seeds span the
constitution's declared axes rather than piling into a band. Validity is not
coverage; a generator that always draws the same safe fish passes everything.
*Falsified if* either distribution concentrates in under a third of its declared
range.

**P5 — No rejection path exists. Predicted: PASS.**
No code path in the generation or render path discards a seed and draws another.
Contracts count and report; they never filter.
*Falsified if* any retry, resample or repair is found.

## Negative controls, run before any green result is believed

Each contract is first fed a hand-built style engineered to violate it, and must
fire:

| Contract | Deliberate violation it must catch |
|---|---|
| Containment | a form scaled past the frame on every surface |
| Non-emptiness | a fully transparent style that draws nothing |
| Rendered figure/ground | background set equal to the base colour |
| Render determinism | a frame perturbed by one pixel |

**Containment and non-emptiness are evaluated as one condition, never
separately.** An empty frame is trivially "not clipped", so a containment check
alone would pass on a blank screen — a contract passing for the wrong reason.

A contract whose negative control does not fire is reported as broken, not as a
pass.

## What no measurement here can settle

P1 and P2 concern how the result *looks*. Geometric containment and pixel
distinctness are measurable; whether the fish is any good is not. **A D-P count
stands only against a result the owner has editorially accepted.** Zero D-P
against a rejected or unseen result is unresolved, not a win — and D-P-01 is
currently open.
