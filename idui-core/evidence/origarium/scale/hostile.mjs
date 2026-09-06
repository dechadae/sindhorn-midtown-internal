/* Test 02.3 — the hostile fixture, generated once and frozen.

   02.2 asked whether a hundred plausible papers manufacture exceptions. They
   did not, for either architecture. This asks the different question: what
   happens to content the archive was never designed to receive.

   Hostile here means *legitimate but unanticipated* — every record is
   something a real archive could actually be handed. A title in Thai, which
   has no word breaks. A 400-character title. An unbroken 90-character token,
   which is what a URL or a hash looks like to a layout. Right-to-left text.
   An empty body. One paragraph of forty thousand characters. Markdown left
   unclosed. Markup in a title, which must be shown and never run.

   Not included: wrong types, null fields, invalid JSON. Those test a parser.
   The question here is what an editorial architecture does when the content
   is real and simply harder than the design assumed.

   Each record carries the case it represents, so a failure names itself.

     node idui-core/evidence/origarium/scale/hostile.mjs      # from the repo root */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const long = (unit, n) => unit.repeat(n);
const paragraph = 'A decision is only useful later if the reasoning behind it survives the decision itself. ';

const CASES = [
  ['a very long title', long('Documenting the reasoning behind a decision that nobody expected to need explaining, ', 5).slice(0, 400)],
  ['one unbroken token', 'sha256:9f2c4e7a1b8d3f6019ae5c2d47b0e839fa61c05d3e9748bb2f0a6c1d5e837490'],
  ['a url as a title', 'https://origarium.com/papers/on-the-continuity-of-an-archive-across-a-rename/2026/07/full-text'],
  ['thai, no word breaks', 'บันทึกเหตุผลเบื้องหลังการตัดสินใจที่ไม่มีใครคิดว่าจะต้องอธิบายในภายหลังแต่กลับสำคัญที่สุด'],
  ['japanese', '記録は決定そのものよりも、その決定に至った理由のほうが後になって役に立つということについて'],
  ['right to left', 'الاستمرارية تخص الأرشيف وليس الواجهة التي تعرضه في هذه اللحظة'],
  ['emoji in the title', '📄 On Changing a Name 🗂️ — an account 🔍'],
  ['markup in the title', 'On <img src=x onerror="document.title=\'PWNED\'"> Changing a Name'],
  ['a script tag in the title', 'Naming <script>document.body.dataset.pwned="yes"</script> things'],
  ['only punctuation', '—: ()[]{} …'],
  ['a single character', 'x'],
  ['no title at all', ''],
  ['title of one long word', long('a', 90)],
  ['numerals only', '2026 07 20 51792 0x416a21'],
];

const BODIES = {
  'empty body': '',
  'whitespace body': '   \n\n   \n  ',
  'one enormous paragraph': paragraph.repeat(450),
  'no paragraph breaks': long('A sentence that never ends and never breaks. ', 300),
  'unclosed markdown': '**bold that never closes\n\n## heading\n\n> a quote that\n\n---\n\n*italic that never closes',
  'markup in the body': 'Before.\n\n<img src=x onerror="document.body.dataset.bodyPwned=1">\n\nAfter.',
  'a single word': 'Yes.',
  'only a heading': '## A heading and nothing else',
};

const papers = [];
let n = 0;
for (const [name, title] of CASES) {
  const bodyName = Object.keys(BODIES)[n % Object.keys(BODIES).length];
  papers.push({
    id: `h-${String(++n).padStart(3, '0')}`, sort_order: n, case: name, bodyCase: bodyName,
    slug: `hostile-${n}`, title,
    summary: n % 3 === 0 ? '' : `The ${name} case, kept because a real archive could be handed exactly this.`,
    body: BODIES[bodyName], status: 'published',
    published_at: new Date(Date.UTC(2026, 6, (n % 28) + 1)).toISOString(),
    created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  });
}
/* every body case at least once, whatever the titles did */
for (const [bodyName, body] of Object.entries(BODIES)) {
  papers.push({
    id: `h-${String(++n).padStart(3, '0')}`, sort_order: n, case: `body: ${bodyName}`, bodyCase: bodyName,
    slug: `hostile-${n}`, title: `A paper whose body is ${bodyName}`,
    summary: 'Ordinary title, hostile body.', body, status: 'published',
    published_at: new Date(Date.UTC(2026, 6, (n % 28) + 1)).toISOString(),
    created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  });
}

const json = JSON.stringify(papers, null, 1);
await writeFile(new URL('./papers-hostile.json', import.meta.url), json);
console.log(JSON.stringify({
  count: papers.length, md5: createHash('md5').update(json).digest('hex'),
  cases: papers.map(p => p.case),
}, null, 1));
