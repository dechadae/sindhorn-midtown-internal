# Negative controls, 7 September 2026

Every rendered contract was first fed a case built to violate it. A contract
that has never failed on purpose has not been shown to work — this series
already paid for that once, when a token scan proved text was *written* rather
than *readable* and four declarations sat dead for six releases.

- Test: IDUI Test 04 (see `PROTOCOL.md` amendment A3)
- Harness commit: `ea2fd4c0fa15a3040d0f60150cdc1d44738c5eb3`
- Run with: `BettaTest04 --negative-controls`

## First attempt: two of four did not fire

This is recorded because it is the point of running controls at all, and
because "the control was wrong" is exactly the rationalisation a failing control
invites. Both failures were in my control designs. Neither check was broken —
but I could not have known that without diagnosing each one.

| Control | Expected | Result | Why |
|---|---|---|---|
| `oversized-form` (`spread=40`) | R1 | **did not fire** | `spread` sweeps the fan *angularly* and never scales it. At 40 the fan wrapped several times inside the same radius and stayed comfortably in frame. |
| `invisible-form` (`opacity=0`) | R1 | fired | — |
| `camouflaged-form` (`transmission=0`) | R2 | **did not fire** | The fragment function computes `base * (0.55 + 0.45 * transmission)`, so at `transmission=0` a mid-grey form renders at 0.275 against a 0.5 ground. Genuinely distinguishable; the check was right. |
| one-byte perturbation | R3 | fired | — |

### What the first failure taught, beyond the fix

No style parameter can push the geometry past the primitive's fixed maximum
radius of 1.1. **The form's extent is bounded by the primitive, not by the
constitution**, and is therefore identical for every seed. A clipping control
cannot come from a style; it has to come from the surface.

That fact went on to explain the Tier B result: containment failure is a
property of the surface aspect alone, with no seed dependence whatsoever.

## Second attempt: all four fire

| Control | Expected | Result | Measured |
|---|---|---|---|
| `narrow-surface` (200×2400) | R1 | fires | coverage 0.2452, border touched |
| `invisible-form` (`opacity=0`) | R1 | fires | coverage 0.0000 — caught as empty, not passed as "unclipped" |
| `camouflaged-form` (`transmission=1`, `depth≈0`) | R2 | fires | separation 0.0176 against a 0.08 floor |
| one-byte perturbation | R3 | fires | fingerprints differ |

`narrow-surface` is a deliberately extreme aspect: at camera distance 5.5 with a
45° vertical field of view, its visible half-width at z=0 is about 0.19, far
inside the form's 1.1 radius, so the form provably cannot fit.

`invisible-form` is the control that matters most for the combined condition.
An empty frame is trivially "not clipped", so a containment check evaluated on
its own would pass on a blank screen. Containment and non-emptiness are
therefore one condition, and this control is what demonstrates it.

## What this does not cover

R2's negative control proves the check *can* fire on a hand-built style. It does
not establish that the 0.08 separation floor is the right threshold for a
translucent membrane over a dark ground — only that the check is capable of
failing and does fail on real sampled seeds (584 frames, 43 seeds, in
`tier-b-20260907-metal.json`).

There is no negative control for P5. That prediction is verified by reading the
source, and a control for "no rejection path exists anywhere" would have to be a
proof about the whole program rather than a case fed to a check.
