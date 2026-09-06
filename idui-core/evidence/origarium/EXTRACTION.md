# Test 02 — constitution extraction, from rendered outcomes

Measured from the frozen snapshot (`/papers.html` v59) at 390×844, both modes,
after the scroll reveals have fired. Derived from what the browser computed,
never from class names — per `PROTOCOL.md`.

## What Origarium actually paints

Nine distinct surface recipes in the archive, ten in the reader. Collapsed by
role:

| Role | Fill | Filter | Seen on |
|---|---|---|---|
| Interface glass, light | `rgba(14,15,18,.9)` | `blur(8px)` | `pc-frame` — the frame around each paper (×8) |
| Interface glass, heavy | `rgba(14,15,18,.9)` | `blur(18px) saturate(1.6)` | `topbar` |
| Floating layer | transparent | `blur(34px) saturate(1.6)` | `dg-card` |
| **Paper** | **`rgb(234,231,221)`** | **none** | `paper-thumb`, `reader-sheet` (×9) |
| Accent tint | `rgba(212,255,26,.1)` | none | `pc-cta`, `val` |
| Scrim | `rgba(8,9,11,.6)` | none | `reader-overlay` |

Typography, rendered: **three faces in one product** — Inter for interface,
Cormorant Garamond for prose (19px on `rgb(234,231,221)`), `ui-monospace` for
metadata and actions. Weights 400 / 500 / 700 / 800. Tracking is `normal` on
almost everything, with small negative values (−0.2 to −0.56px) used optically
on large type. Radii 4 / 7 / 10 / 12 / 14 / 24px **and `50%`**.

## P01 — confirmed, and understated

P01 predicted "at least two" material families. Measured: **three glass weights,
one opaque paper, one tint, one scrim.** Origarium's own tokens name the same
split independently — `--glass-*`, `--term-*`, `--eink-*`, the last consumed by
24 selectors.

Origarium also *has* glass, with its own recipe (`blur(18px) saturate(1.6)`
against the core's `blur(18px) saturate(1.18)`). The concept transfers; the
values are constitution work.

## P02 — the break is the membership rule, not the tokens

The core's material rule is global:

> a card is anything that draws an edge → glass

Under it, `paper-thumb` and `reader-sheet` are cards and would take glass. They
must be **opaque warm paper with no blur**. The same element kind needs a
different material depending on the context it sits in — chrome gets glass, a
document gets paper.

That cannot be reached by changing token values, because the rule that assigns
material does not ask what the surface *is*. This is the architectural change
P02 predicted, stated precisely: **material membership must become
role-dependent rather than universal.**

## Ledger, so far

| # | Requirement | Class | Note |
|---|---|---|---|
| 1 | Material chosen by semantic role, not by drawing an edge | **C** | A reusable degree of freedom: any product with a document surface inside interface chrome needs it. This is the core change P02 predicted. |
| 2 | A third blur weight (8 / 18 / 34px) | **C**, provisional | The core has two recipes — glass and scrim. Whether Origarium needs three *roles* or has three by drift is not yet decided; deciding it from the source rather than from the render would be reading class names. |
| 3 | An editorial prose face beside interface and code | **C** | The core has `--font-ui` and `--font-code`. Any editorial product needs a third role. |
| 4 | `50%` radii | **not a finding** | The core already draws its one circle through `--radius-pill`, so "a constitution that draws no circles keeps its rule" — Sindhorn's rule is Sindhorn's. Already generalised; nothing to move. |

Nothing is classified **D** yet, and no D-P at all. That number is the one to
watch: `PROTOCOL.md` stops the test if D-P ever exceeds D-B.

## Method note

Three separate probes reported false results before these numbers were
trusted, each the same error — asserting an action rather than a state. The
one that produced this table originally served `/papers` as `text/plain`,
because it took the content type from the request path rather than the
resolved file, so the browser rendered the HTML as text and reported an empty
DOM. The measurement harness had it right; the probe did not.
