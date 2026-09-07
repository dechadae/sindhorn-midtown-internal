# Findings from Tier B, 7 September 2026

Classified against the frozen taxonomy: **A** misowned core assumption,
**B** constitution, **C** missing reusable capability, **D** product-specific,
split **D-B** behaviour (healthy) and **D-P** presentation (the alarm).

This file supersedes nothing. `findings-20260907.md` records what was known
before any rendered sample existed and stands as written.

Numbers: `tier-b-20260907-metal.json`. Predictions: `predictions-20260907-tier-b.md`,
frozen at `b9e40df`.

---

## The headline, stated plainly

**Constructional validity does not hold at Tier B.** Every one of the 2,000
sampled seeds fails a rendered contract on at least one surface. Tier A passed
100,000 seeds with zero violations; that number is now shown to have been
answering an easier question than the one that matters.

The two results are reported separately and neither lends the other its
credibility. A generator can hold zero appearance decisions, sample only from
declared ranges, and still produce output that does not survive being drawn.

---

## A-01 — The primitive owns the form's extent, and the constitution cannot see it

The form's maximum radius is `1.1`, a literal in the vertex function. No seed,
and no range the constitution declares, can change it. Framing is likewise fixed
by the Framing primitive.

So whether the form fits the frame is decided entirely by two primitives talking
past each other, with the constitution — the thing that is supposed to own the
space of legal results — having no visibility into the question at all. On a
1080×2400 surface the visible half-width at z=0 is ~1.025 against that 1.1
radius, and **every seed clips, on every moment**: 10,000 of 10,000 frames.

This is classified **A** rather than B or D because it is a misowned assumption
about who owns what. The constitution declares ranges for how the form *deforms*
and never for how much room it *needs*, while the framing primitive declares a
camera without reference to what it must contain. Neither is wrong on its own
terms. The relationship between them is owned by nobody.

**Not fixed here.** The obvious repairs — scale the form down, pull the camera
back, derive the camera from the form's extent — are all appearance decisions
about how the wallpaper is composed, and the owner decides those.

## B-03 — Parameter separation is not rendered separation

584 frames across 43 seeds (2.15%) fail rendered figure/ground separation
**while passing Tier A's T6 on parameters**. Separations run 0.0319–0.0798
against a 0.08 floor: below the line, none catastrophic.

The parameter check compares declared HSL lightness. The rendered pixel has also
passed through opacity, transmission, rim and blending. The constitution
currently constrains the former and says nothing about the latter, so a style
can be lawful in every declared range and still come out indistinguishable from
its ground.

Failures spread evenly across surfaces (202/191/191) and moments (116–119), so
this is a property of the seed's colour, not of framing or timing.

**Proposed, not applied:** either the constitution constrains the material
parameters jointly with the palette ranges, or T6 is retired at the parameter
level in favour of the rendered check. Both are constitution changes and need
the owner's approval.

## C-02 — The rendered contracts have no shared definition across platforms

R1–R3 exist only in the Swift target. The Android implementation has the Tier A
contracts and nothing else. If the same questions were asked there tomorrow they
would be asked by different code, and a comparison between the two would measure
the measurer — the failure mode this evidence directory's own README warns about
for per-test harnesses.

Extends C-01 (no shared conformance fixture) from styles to frames.

## D-P-01 — still open, and now with more evidence against it

The framing problem first seen as "the form sits off-centre" in
`observations-20260907-render-smoke.md` is now measured: on a phone aspect the
form does not merely sit off-centre, it does not fit at all, for any seed.

Still **unresolved**. The owner has not seen and accepted a corrected framing. A
D-P count stands only against an editorially accepted result, and there is none.

---

## What went right, in the same words as what went wrong

- **P2 and P3 were predicted correctly and the predictions were falsifiable.**
  P2 predicted a small number of rendered collapses despite a clean Tier A, and
  the freeze committed in advance to distrusting the check if it returned zero.
  It returned 584.
- **P1 was right about the outcome and wrong about the mechanism.** It predicted
  a seed-dependent failure, worst on the square surface; the failure is not
  seed-dependent and square had none. Scored as a wrong prediction that happened
  to point at a real defect.
- **Two of four negative controls failed on first run** and were corrected
  (`negative-controls-20260907.md`). Both faults were in the controls. That
  diagnosis produced A-01, which is the most substantial finding in this batch.
- **Render determinism holds** across 1,500 frames and two process invocations.

## The measurement this cannot make

P1 and P2 are about how the result *looks*, and no number here settles that. The
harness can say a form is geometrically contained and pixel-distinct from its
ground. It cannot say the fish is worth looking at. Every framing repair listed
under A-01 changes the composition, which is the owner's decision and not a
contract's.
