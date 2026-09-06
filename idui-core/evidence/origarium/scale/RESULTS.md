# Test 02.2 — one hundred papers

The same hundred records, in the same order, to both implementations. Fixture
frozen at `2f4dbd9` before either side saw it: seed `0x416a21`, md5
`0a63c0bda455254ff20fa5f2a1679b11`, titles 4–99 characters, bodies
3,059–51,781, twelve papers with no summary at all. The envelope is measured
from the eight real papers and extended at the extremes by a stated factor,
because a generator whose author picks the hard cases is measuring its author.

Neither page was edited for the run. The reconstruction under test is
byte-identical to the one being judged; only what it is fed differs.

## Result

| | Cards | Valid @390 | Valid @1240 | Reader | Card widths | Preview sizes | Nodes | Render | Errors |
|---|---|---|---|---|---|---|---|---|---|
| Origarium | 100 | **100/100** | **100/100** | **100/100** | 1 | 1 | 1,272 | 693 ms | 0 |
| IDUI | 100 | **100/100** | **100/100** | **100/100** | 1 | 1 | 1,543 | 749 ms | 0 |

Contracts checked per card, never repaired: not collapsed, inside the viewport,
a document preview present and not wider than its card, the preview a page
(0.707 ± 0.02), and no text escaping its own box. Then every one of the
hundred papers opened into the reader and closed again.

**Both architectures held.** That is the honest headline, and it is the second
of the three outcomes named before the run: *if both stay near zero, we learn
that Origarium's existing architecture was already robust.* It was.

## What separates them

Not the render. The difference is where the authority to make appearance
decisions lives:

| | 8 papers | 100 papers |
|---|---|---|
| Origarium appearance decisions in page code | 243 | **243** |
| IDUI appearance decisions in page code | 0 | **0** |

Neither grew, which is the result IDUI needed — *the number of content
instances must not multiply styling authority*. But Origarium did not grow
either, and that matters: its 243 decisions are made once, in a stylesheet, and
a hundred papers reuse them. A page that styles by class does not manufacture
exceptions per instance; it simply holds all of its exceptions up front.

So the scale test does **not** show IDUI absorbing variation better. It shows
both absorbing it completely, and the 243 → 0 difference remaining exactly
where the reconstruction found it — a difference of *locality*, not of
robustness under volume.

## Repair burden

Recorded on the IDUI side only, and logged as it happened rather than after
the score was known. Origarium's cannot be recorded at all: it belongs to
another application and cannot be repaired here, so any number would be
inaccessibility dressed as a result.

**IDUI: zero paper-specific repairs.** The hundred rendered on the same rules
as the eight. The one defect volume did expose was found earlier, at eight
papers, by the owner asking why the thumbnails were not the same shape — a grid
item is `min-width:auto`, so one long word made a column wider than its share.
That was a defect in a primitive this test had itself added two commits before,
and it is fixed; a hundred papers found nothing further.

## What this test cannot say

It ran one fixture. A hundred plausible papers test **volume**; they do not
test hostility, and no malformed input was used. Whether either architecture
survives content it was never designed for is a different experiment, and this
one does not speak for it.
