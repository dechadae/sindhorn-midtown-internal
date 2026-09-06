# Operational Trial A — Moodboard Feature Transplant

Frozen 6 September 2026, before any moodboard code exists in this repository
and before the source feature was snapshotted. Committed on its own hash so
"predicted before implementation" is checkable. Amendments are appended below,
dated, never edited in.

## Not a numbered evidence test

The evidence series stays as the owner set it:

| 01 | Flipgazine | published at `/evidence` |
| 02 | Origarium | published at `/origarium` |
| 03 | Apple | protocol frozen, source not yet captured |
| 04 | Betta | on hold |

This is **Operational Trial A**, and it sits beside that sequence rather than
inside it, because it asks a question none of the four can:

> Can IDUI govern the development of a real, behaviour-heavy production feature
> **while it is being built**, rather than reconstructing one afterwards?

Every test so far has attacked appearance architecture on a finished artefact.
This attacks the rule that has never been under real pressure:

> **Behaviour earns vocabulary. Appearance does not.**

A moodboard has a great deal of genuine behaviour, so for the first time the
method can be wrong in the other direction — not by leaking taste, but by
compressing genuinely different behaviours through one primitive to keep a
count low. **That failure is as important as the appearance one**, and this
trial is the only place in the series it can appear.

## The claim under test

> A behaviour-rich feature can move from the Flipgazine product into Sindhorn
> Midtown while preserving its workflow and information model, deriving all
> appearance from the Sindhorn constitution, with no product-specific
> presentation escape hatch and no Flipgazine visual assumption entering the
> IDUI core.

Deliberately not "can IDUI make a moodboard". The feature is the vehicle; the
governed boundary is the subject.

## Scope

The feature as observed in the owner's recording: editor and public modes,
board and archive states, board metadata editing, section creation, deletion
and reordering, menus and guides, reference imagery, category navigation,
annotations, fullscreen reference viewing, copy and download actions, and
whatever persistence and permission the Sindhorn side requires.

## Frozen predictions

- **M01 — Presentation authority.** The Sindhorn implementation reaches
  **page-specific presentation = 0**: no page CSS, no visual literal, no
  appearance-only primitive.
- **M02 — Behaviour stays where it belongs.** The feature will require
  meaningful product behaviour (D-B) and that is **acceptable**. No attempt is
  made to push moodboard logic into the core.
- **M03 — D-P stays zero.** Every moodboard-specific visual requirement is
  expressible through composition, semantic roles, the Sindhorn constitution,
  or existing core mechanics. If a rule like `.moodboard-special-card` is
  needed because the constitution cannot express it, that is logged as D-P and
  published.
- **M04 — No aesthetic transfer.** The workflow transfers; the Flipgazine
  visual constitution does not. Same semantics and equivalent behaviour, with
  each constitution producing its own appearance. Sindhorn inheriting
  Flipgazine's accent, tracking or geometry is a failed boundary.
- **M05 — Core stays generic.** Any core change enters the same A/B/C/D ledger
  and reruns the frozen Sindhorn, Flipgazine and Origarium regression gates.

## What gets measured

```
Product-specific behaviour (D-B)        N LOC     large is fine
Product-specific presentation (D-P)     N LOC     interesting above zero
New behavioural primitives              N
New appearance-only primitives          N         target 0
Page appearance decisions               N         target 0
Page visual literals                    N         target 0
Core corrections                        N         each classified
Constitution additions                  N
```

If D-B is two thousand lines, that is a sophisticated tool and the number means
nothing bad. If D-P reaches eight hundred, that is the finding.

## The decision ledger — the cheap instrument

The instrument that costs almost nothing and is likely to carry the result.
Every time the build meets "where should this styling go", record the
**architectural outcome only** — not the conversation:

```
Requirement:    fullscreen reference viewer
Decision:       existing overlay material + viewer behaviour
Core change:    no

Requirement:    reference image navigation
Decision:       new product behaviour
Class:          D-B

Requirement:    a moodboard-specific accent border
Decision:       rejected; the constitution derives the accent
Class:          attempted D-P
```

Attempted D-P is recorded as carefully as accepted D-P. A method that refuses
the wrong thing is only demonstrable if the refusals are written down.

## Editor and public are one board in two contexts

The recording shows the same board twice, which is a ready-made test of the
either/or/neither membership rule:

```
same board data, same semantic content
    context = editor  -> editing behaviour participates
    context = public  -> sharing and navigation participate
    neither           -> the rule does not participate
```

Building `editor-board` and `public-board` as two independently styled versions
of the same content is a **failure of this trial**, not a shortcut. Context
changes behaviour and derived presentation; it does not fork the composition.

## The cross-constitution pair

Because the feature already exists in Flipgazine, this yields something no
reconstruction test has had: **the same feature under two constitutions**, with
no need to pixel-match them. Compare the semantic and behavioural skeleton:

```
BOARD
├── title
├── shoot metadata
├── sections
│   ├── references
│   ├── annotations
│   └── guides
├── archive
└── public view
```

Then ask how much of that structure and behaviour survives unchanged while the
visual result changes completely. That is close to a direct demonstration of
*product semantics are portable; taste is constitutional.* Running one fixture
through both implementations would be stronger still, and is optional.

## Before any code

1. Snapshot the current Flipgazine implementation, read-only, key redacted, as
   every source in this series is handled.
2. Freeze a representative board and its data as the fixture.
3. Keep the owner's recording as behavioural evidence.
4. This file, committed on its own hash.
5. Run the existing IDUI audit set once, so the before state is on the record.

Then build the feature normally. **The evidence is collected incidentally while
development happens** — no ten-thousand-case harness, no separate experiment.

## Source boundary

Flipgazine's rows and code belong to another application on the shared Supabase
project. This trial may read and snapshot them and must never write to them.
Any Flipgazine source committed here carries its key redacted, as in Test 01.
Nothing is deployed to Flipgazine.

## The result this is really after

> When a designer adds a complicated new feature, does IDUI actually reduce the
> number of visual decisions they must make — or does the methodology become
> bureaucracy that gets in the way?

Building the moodboard with its full function, keeping editorial freedom, and
finding that CSS architecture simply stopped being a thing to think about is
meaningful operational evidence. **IDUI fighting at every unusual interaction is
equally valuable**, and would be published in those words.

## Naming the result

Not PASS or FAIL. One of:

> **Governed Without Presentation Escape** ·
> **Governed, With N Product-Specific Presentation Rules** ·
> **Governed But Obstructive** ·
> **Did Not Govern — The Feature Required Local Appearance Authority**

The third is the outcome the appearance-only tests could never produce, and it
is the one worth watching for.

## Status

**Documented, not started.** The owner deferred the build; nothing here has been
implemented, no source has been snapshotted, and no measurement exists.
