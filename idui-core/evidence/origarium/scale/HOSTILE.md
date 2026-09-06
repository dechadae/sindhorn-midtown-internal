# Test 02.3 — hostile content

Twenty-two records the archive was never designed to receive, frozen at
`70a24e7` before either implementation saw them: a 400-character title, an
unbroken 90-character hash, a URL, Thai and Japanese (no word breaks),
right-to-left Arabic, emoji, markup in a title, an empty body, a
forty-thousand-character paragraph, unclosed markdown. Every record is
something a real archive could actually be handed. Wrong types and null fields
were deliberately excluded — those test a parser, not an architecture.

Judged by the same `contracts.mjs` the hundred-paper run faced, so this fixture
could not be graded gently. Nothing was repaired during the run.

## Result

| | Valid @390 | Valid @1240 | Reader | Page overflow @390 | Card widths | Preview sizes |
|---|---|---|---|---|---|---|
| Origarium | 0 / 22 | 11 / 22 | 0 / 22 | **1,050 px** | 2 | 2 |
| IDUI | **17 / 22** | **20 / 22** | 7 / 22 | **459 px** | **1** | **1** |

**Both architectures failed.** IDUI failed less, and the shapes of the two
failures are different.

**Origarium's layout collapses.** One unbroken token widens the grid and the
page overflows by 1,050 px — more than two phone screens. Once that happens no
card sits inside the viewport, which is why the count is 0/22 rather than
1/22: it is one failure that takes every card with it, not twenty-two separate
ones. Card widths and preview sizes both split in two, so the archive stops
being a grid of equal sheets.

**IDUI's layout holds and its text does not.** Card widths stay at one and
preview sizes at one — every sheet is still A4, which is `min-width: 0` doing
its job. The five failures are all the same: a paragraph whose content will not
break (`text overflows: p`), and that text pushes the document 459 px wide.

So the grid survived and the typography did not. The rule the core is missing
is not about layout at all: **text must stay inside its box even when the
content contains nothing to break on.**

## Escaping — both correct

| | Title script ran | Body script ran | Injected `<img>` | Injected `<script>` |
|---|---|---|---|---|
| Origarium | no | no | 0 | 0 |
| IDUI | no | no | 0 | 0 |

Markup in a title is shown and never run, on both sides. Worth stating because
it is the one hostile case where failure would be a security defect rather
than a layout defect.

## The reader

Origarium 0/22 — every reader overflows sideways, for the same reason the
archive does.

IDUI 7/22, and its failures divide: 14 are *"reader not full height"* and one
overflows sideways. The height failures are the honest kind — an empty body, a
one-word body, a heading-only body genuinely produce a short document, and the
contract as written demands 60% of the viewport from every paper. That is the
contract being wrong about legitimate content rather than the architecture
failing, and it is recorded as such rather than counted as a win or a loss.

## What this changes

02.2 found both architectures absorbing a hundred plausible papers without
manufacturing a single exception. 02.3 finds both breaking on content neither
anticipated, in different places and to different degrees. Together they say
something more precise than either alone:

> The difference between these architectures is not robustness under volume.
> It is where a failure lands. Origarium's is total and structural — one record
> takes the page. IDUI's is local and typographic — five records overflow their
> own paragraphs while the grid around them holds.

Neither is repaired here. The repair, and whether it can be made in the
governing rule rather than the page, is the next thing to test.

---

# The repair, and which architecture was harder to fix

Both failures were repaired, and the repairs were measured rather than
estimated. Origarium's was applied to a **scratch copy written outside the
repository** — never back to the source, never to its rows — purely so the
cost could be counted on both sides without editing another application's code.

## After the repair

| | Valid @390 | Valid @1240 | Reader | Page overflow |
|---|---|---|---|---|
| Origarium | **22 / 22** | **22 / 22** | **22 / 22** | 0 |
| IDUI | **22 / 22** | **22 / 22** | **22 / 22** | 0 |

Both hold completely. Neither needed a per-record exception.

## The fix was the same size on both

| | The change | Where it lands |
|---|---|---|
| Origarium | one declaration, 13 selectors | `papers.html`'s own style block |
| IDUI | one declaration, 20 roles, zero specificity | `idui-core/app-components.css` |

**So "harder to fix" is not about the edit.** It is one declaration either way,
and anyone claiming IDUI made this repair smaller would be wrong.

## It is about reach

The core rule reaches every product built on it. Sindhorn and Flipgazine got it
at the same moment, and P05 proves it cost them nothing: **0 differing pixels**
on `/`, `/voice` and `/ci`.

Origarium's fix reaches `papers.html`. The site has **53 HTML pages, 45 of them
carrying their own style block, 93 style blocks in total.** Whether the dream
state, the CRM and the game view need the same declaration is unknown and
untested here — but if they do, the repair is not one declaration. It is one
declaration *per place that styles text*, and nothing in the architecture
tells you which of the 45 those are.

That is the difference the numbers actually support:

> The same repair, in one architecture, is a rule. In the other, it is a task.

## And the core had already made this decision three times

Before Test 02.3, `overflow-wrap: anywhere` appeared in the core in exactly
three places — a list row title, a business card name, a card link — each added
where someone had hit the problem. The rule existed as a habit and had never
been stated. Hostile content is what turned three coincidences into an
invariant.

## One failure I had misread

Fourteen of IDUI's fifteen reader failures were recorded in the first pass as
*"the contract being wrong about legitimate content"* — a short paper making a
short document. That was wrong. Origarium's reader sheet is `height:100%`: a
one-sentence paper still fills the screen, because the reader is a **place**
rather than a container that fits its contents. The contract was right and the
reconstruction was missing a property of the original.

Fixed where it belonged — a reading context occupies the view — and recorded
here rather than quietly corrected, because the first reading was published.
