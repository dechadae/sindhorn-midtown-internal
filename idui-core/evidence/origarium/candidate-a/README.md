# Candidate A — conformance PASS, editorial selection REJECTED

Frozen 6 September 2026, exactly as measured, and **not corrected in place**.
This is the first IDUI reconstruction of Origarium Papers. It is
architecturally valid — 0 bytes of page CSS, 0 style attributes, 0 appearance
decisions, 243 → 0 — and the owner rejected it.

| | Conformance | Editorial selection |
|---|---|---|
| Archive | PASS | **Partial** — recognisably Origarium, normalised toward generic clean UI |
| Reader | PASS | **REJECTED** — the compositional model changed |

## What it got wrong

The original reader says *the paper is the page*: the warm reading material
occupies the environment and the interface sits quietly on it. The reader has
entered the document.

Candidate A says *the paper is a surface inside the app*: a dark Origarium
shell, then a large rounded dark container, then a cream document inside it.

That is not a styling discrepancy. It is a different composition. The
reconstruction reasoned:

```
Origarium → dark interface material
paper     → document material
    ⇒  dark interface
           └── paper surface
```

where the original says:

```
reader context → the document becomes the environment
    ⇒  paper ground
           ├── reader chrome
           └── article
```

## Why it happened, which is the interesting part

The reader was built on `.app-dialog` because that is the library's way of
putting a layer over a page — and `.app-dialog` carries Sindhorn's
compositional model: a scrim, a floating panel, chrome wrapping content.
Reaching for it imported an assumption that had nothing to do with Origarium.

That is exactly the failure Test 03 predicts as **A05, identity does not
converge** — a house model arriving through a primitive rather than through a
value. It showed up here first, in a real experiment, rather than in the test
written to look for it.

## What it proves that a corrected version could not

Kept because deleting it would destroy the most useful thing in Test 02: two
reconstructions, both passing every contract, one selected. Contracts define
validity; the editor selects quality. Candidate B repairs the governing rule,
never this page.
