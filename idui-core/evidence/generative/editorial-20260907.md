# First editorial acceptance, 7 September 2026

The first rendered output of this test that the owner has editorially accepted.
Until now every positive reaction was recorded as approval of direction, and
D-P-01 was held open on the rule that a D-P count stands only against an
accepted result.

- Test: IDUI Test 04 (see `PROTOCOL.md` amendment A3)
- Constitution: **v4**
- Harness commit: `d4e36cd` (`dechadae/sindhorn-midtown-internal`, branch `macos-betta-display-1.2`)
- Renderer: the production shader, compiled from `Sources/BettaMetalLab/Shaders.metal`
  and driven directly. Test 04 supplies the generator only.
- Surface: 5120×2880, mesh 640×576, 4× MSAA, through the eight locked landscape
  compositions

## The verdict

> *"all artworks are acceptable as editorial except max-01"*

**7 of 8 accepted. 1 rejected.**

| frame | parts | verdict |
|---|---|---|
| max-01 | membrane + diamond + ribbon | **rejected** |
| max-02 | membrane + ring + diamond + prism | accepted |
| max-03 | membrane + prism + ribbon | accepted |
| max-04 | membrane + prism + ribbon | accepted |
| max-05 | membrane + ribbon + diamond | accepted |
| max-06 | membrane + ring + prism + ribbon | accepted |
| max-07 | membrane + diamond + ribbon + prism + ring | accepted |
| max-08 | membrane + ring + diamond | accepted |

Seeds are the first eight of `seeds.json`, in that order.

**This is the first keeper-rate figure this test has: 87.5% on n = 8.** It is a
very small sample and should not be quoted as a rate without that attached.

## D-P-01

**Closed.** An accepted baseline now exists, so the presentation column has
something to measure against. The rejection is recorded as an open D-P below.

## D-P-02 — max-01, rejected

A mid-value desaturated teal field with a thin sliver of organism at the top
edge. Unresolved: no fix has been made or accepted.

Note that it does **not** fail for being cropped nearly empty. The owner had
already ruled on that:

> *"the whole screen might not show any organism because it's been pushed
> offscreen but the gradient bg itself is good enough to be a wallpaper then
> that result will survive my review."*

`max-05` is accepted with an even emptier frame. The difference is in the frame
itself, not in how much organism is present.

## Two hypotheses, both falsified

Recorded because the failures are more informative than another guess would be.

**H1 — the ground lacks tonal range.** Measured luminance span and standard
deviation across all eight:

| frame | span | sd | verdict |
|---|---|---|---|
| max-01 | 0.1246 | 0.0399 | rejected |
| max-05 | 0.1083 | 0.0370 | accepted |
| max-08 | 0.1107 | 0.0462 | accepted |

Two accepted frames have **less** tonal range than the rejected one. Falsified.

**H2 — the frame commits to nothing** (neither a value extreme nor high chroma):

| frame | mean luminance | mean chroma | verdict |
|---|---|---|---|
| max-01 | 0.5099 | 0.2541 | rejected |
| max-07 | 0.4732 | 0.1723 | accepted |
| max-03 | 0.5944 | 0.1799 | accepted |

Two accepted frames are mid-luminance with **lower** chroma than the rejected
one. Falsified.

## What that establishes

**No global image statistic tested here separates the owner's rejection.** Not
tonal range, not mean luminance, not mean chroma.

Two things follow, and they point in opposite directions:

1. **AI pre-screening is not currently justified.** The original proposal was
   that if machine ratings correlated with the owner's, thousands of seeds could
   be filtered before he looks. Nothing here supports that. The owner's blind
   rating in the control design (M5) has no machine substitute.
2. **The sample cannot bear the weight.** Fitting a rule to a *single*
   rejection is overfitting by construction; at n = 1 a real rule could not be
   confirmed either. The two falsifications above are honest, but they are
   falsifications of guesses, not evidence that no rule exists.

The remedy is more editorial data, not a cleverer metric. A rated pass over a
few dozen frames would produce enough rejections to test anything at all.

## Caveats

- One session, one rater, eight frames, one surface, one moment.
- The frames were rendered with `detail` ranges that are still estimates; the
  owner's own `BettaAdvancedTuningStore` has not been read.
- Acceptance is of these eight frames at this commit. It is not a standing
  acceptance of the constitution, and a range change invalidates it.
