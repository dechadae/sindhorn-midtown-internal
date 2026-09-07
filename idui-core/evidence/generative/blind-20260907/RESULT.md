# Blind rating: Claude against the owner

7 September 2026. Twenty frames, constitution v4, drawn by the production
shader at 3840×2160 through the eight locked landscape compositions.

- Claude's ratings committed at **`c6a1f14`**, before the owner's were given
- Owner's verdict given as rejections: **02, 04, 06, 07, 16, 20**
- Two deliberately degraded controls hidden in the set; neither rater knew which
- Claude rated from the images alone — the manifest was opened only after both
  sets of ratings were locked

## The headline

**Cohen's κ = 0.00.** Claude's agreement with the owner is exactly what chance
would produce given the two accept rates.

| | owner accepts | owner rejects |
|---|---|---|
| Claude accepts (≥3) | 7 | 3 |
| Claude rejects (≤2) | 7 | 3 |

- Observed agreement: 10/20 = **50%**
- Expected by chance: 0.5 × 0.7 + 0.5 × 0.3 = **50%**
- κ = (0.50 − 0.50) / 0.50 = **0.00**

At a stricter threshold (≥4 counts as accept) κ = 0.20, "slight" at best.
**The threshold was chosen after seeing the owner's answers**, which is a
researcher degree of freedom that could flatter the result, so both are
recorded and neither is presented alone.

Accept rates: Claude 50%, owner 70%. **Claude is the harsher rater**, and
specifically harsh about quiet frames.

## Every frame

| frame | Claude | owner | kind |
|---|---|---|---|
| b-01 | 4 | accept | sample |
| b-02 | 1 | **reject** | **control-muddy** |
| b-03 | 5 | accept | sample |
| b-04 | **5** | **reject** | sample |
| b-05 | 2 | accept | sample |
| b-06 | 2 | **reject** | sample |
| b-07 | 3 | **reject** | sample |
| b-08 | 2 | accept | sample |
| b-09 | 4 | accept | sample |
| b-10 | 2 | accept | sample |
| b-11 | 3 | accept | sample |
| b-12 | 2 | accept | sample |
| b-13 | 5 | accept | sample |
| b-14 | **1** | **accept** | **control-flat** |
| b-15 | 5 | accept | sample |
| b-16 | 2 | **reject** | sample |
| b-17 | 2 | accept | sample |
| b-18 | 2 | accept | sample |
| b-19 | 4 | accept | sample |
| b-20 | 3 | **reject** | sample |

## The two sharpest breaks

**b-04** — Claude 5, owner rejected. One of Claude's top three. Deep olive
ground, amber ribbon and ring top-left. Claude's note at rating time: "elegant,
moody, sophisticated."

**b-14** — Claude 1, owner accepted. This was a **planted control**, built to be
near-empty on an almost flat mid grey.

## The controls did not do their job

`b-02` (desaturated organism on a desaturated ground) was caught by both raters.

`b-14` was not. The owner kept it.

The tempting reading — that the owner failed to discriminate — is the wrong one.
The same thing already happened with `max-01`: a frame Claude assumed was
obviously poor, judged the other way by the person whose judgment defines the
target. **The likelier explanation is that the control was mis-designed**, and
that "near-empty on a flat ground" is not degraded by this owner's standard. He
had already said as much:

> *"professional human designer are not afraid of nagative space… the gradient
> bg itself is good enough to be a wallpaper then that result will survive my
> review."*

So one of two taste controls was invalid. **Any future control set has to be
built from frames the owner has actually rejected, not from what Claude imagines
a bad frame looks like.**

## A hypothesis, explicitly not a finding

Every owner rejection except the control (04, 06, 16, 20, and arguably 07) has a
**small organism fragment stranded in a corner**. The owner meanwhile accepted
`b-10` and `b-14`, which are near-pure gradients with almost nothing in them.

That suggests a rule: *commit to the gradient, or commit to the organism; a
fragment that does neither reads as an accident rather than a crop.* It is
consistent with the `max-01` rejection too.

It is recorded as a hypothesis because **two previous hypotheses about this
owner's judgment have already been falsified** (tonal range; commitment to a
value or chroma extreme — see `editorial-20260907.md`). The next rating set
exists to kill this one.

## What this establishes

1. **Claude's taste does not predict the owner's on this subject.** Not weakly —
   at the primary threshold, not at all. AI pre-screening of seeds is
   unsupported, and the owner's rating in any control condition (M5) has no
   machine substitute. This is now measured rather than argued.
2. **The failure is not random noise, it is systematic.** Claude accepts 50%
   where the owner accepts 70%, and the largest single disagreement is a frame
   Claude scored top marks. A rater who was merely noisy would not do that.
3. **The method worked even though the result is negative.** Ratings were frozen
   before exposure, the manifest stayed shut, and the controls were checked -
   which is how a mis-designed control got caught instead of being read as the
   owner's error.

## Caveats

- n = 20, one session, one rater on each side.
- The owner gave a binary verdict; Claude's 1–5 scale was collapsed to binary
  afterwards, and the collapse threshold was chosen post hoc.
- Both raters saw downscaled images, not the 3840×2160 originals.
- One of the two controls was invalid, so the discrimination check is
  half-strength.
