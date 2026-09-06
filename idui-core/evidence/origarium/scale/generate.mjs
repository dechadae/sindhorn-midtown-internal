/* Test 02.2 — the 100-paper fixture, generated once and frozen.

   The same hundred records go to both implementations, in the same order. The
   point is not that either can render a hundred cards; it is whether content
   variation is absorbed by existing rules or manufactures exceptions.

   The variation envelope is not invented. It is measured from the eight real
   papers - title 9-114 characters and 1-16 words, summary 142-273, body
   3,243-51,792, six titles of eight carrying punctuation - and extended by a
   stated factor at the extremes, so the difficulty is derived rather than
   hand-picked by whoever wants a result. A generator whose author chooses the
   hard cases is measuring its author.

   Deliberately not included: malformed input. Torture strings test parsers,
   not editorial architecture. Everything here is a paper someone could
   plausibly have written.

     node idui-core/evidence/origarium/scale/generate.mjs     # from the repo root */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const SEED = 0x0416A21;   // frozen, and never changed after a run
const COUNT = 100;

/* mulberry32: small, deterministic, and identical on any platform. */
function rng(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(SEED);
const pick = list => list[Math.floor(r() * list.length)];
const between = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

const SUBJECT = ['the archive','a decision','continuity','a name','the record','provenance','a system','the canon','an interface','memory','a method','the log','a constitution','drift','the ledger','an exception'];
const VERB = ['Designing','Documenting','Reading','Keeping','Losing','Naming','Measuring','Refusing','Rebuilding','Holding'];
const QUALIFIER = ['Notes on','A Short Account of','One Question about','Against','Toward','On','What Happens to','Why We Keep'];
const ORG = ['Origarium Research','Origarium','Origarium Research · Archive Division','Wardline','Origarium Research and the Long Record Group'];
const AUTHORS = [['Dae'],['Dae'],['Dae'],['Dae','A. Somchai'],['Dae','A. Somchai','P. Wattana'],['The Archive']];
const SENTENCE = [
  'A decision is only useful later if the reasoning behind it survives the decision itself.',
  'The archive is not a backup; it is the argument, kept where it can be checked.',
  'Every claim below is drawn from the record rather than assembled from memory.',
  'What changed is easy to write down, and almost never the part worth reading.',
  'A system that cannot say why it refused something has not refused it, only failed.',
  'The names we give things outlive the reasons we gave them, which is the problem.',
  'Nothing here is invented to make the argument tidier.',
  'It is a plain account of one decision, written so it can be understood without prior context.',
  'The measure of a method is what it does with the case it did not anticipate.',
  'Continuity belongs to the archive, not to the interface that happens to be showing it.',
];

function title(){
  const shape = r();
  if (shape < .06) return pick(SUBJECT).replace(/^(a|an|the) /, '').replace(/^./, c => c.toUpperCase());  // one or two words
  if (shape < .82) return `${pick(QUALIFIER)} ${pick(SUBJECT)}`.replace(/^./, c => c.toUpperCase());
  /* the long tail: the real set's longest title is 114 characters, so the
     envelope reaches roughly twice that and no further */
  const clauses = between(2, 4);
  return Array.from({length: clauses}, () => `${pick(VERB)} ${pick(SUBJECT)}`).join(', ') + ': ' + pick(SUBJECT);
}
function paragraph(){ return Array.from({length: between(2, 6)}, () => pick(SENTENCE)).join(' '); }
function body(chars){
  const out = [];
  let n = 0;
  while (n < chars) {
    if (out.length && r() < .18) { const h = `## ${pick(QUALIFIER)} ${pick(SUBJECT)}`; out.push(h); n += h.length; continue; }
    const p = paragraph(); out.push(p); n += p.length;
  }
  return out.join('\n\n');
}

const papers = Array.from({length: COUNT}, (_, i) => {
  const t = title();
  /* one paper in eight had no summary in a real archive of this kind; the
     measured eight all had one, so this is the stated extension */
  const hasSummary = r() > .12;
  /* body length follows the measured shape: mostly short, one very long */
  const long = i === 7;
  const chars = long ? 51000 : between(2800, r() < .15 ? 26000 : 9000);
  const authors = pick(AUTHORS);
  return {
    id: `p-${String(i + 1).padStart(3, '0')}`,
    sort_order: i + 1,
    slug: `paper-${String(i + 1).padStart(3, '0')}-${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`,
    title: t,
    summary: hasSummary ? paragraph().slice(0, between(120, 300)) : '',
    body: `${t}\n\n**${authors.join(', ')}**\n${pick(ORG)}\n${['January','March','May','July','September','November'][between(0,5)]} 2026\n\n---\n\n${body(chars)}`,
    status: 'published',
    published_at: new Date(Date.UTC(2026, between(0, 8), between(1, 28))).toISOString(),
    created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };
});

const json = JSON.stringify(papers, null, 1);
await writeFile(new URL('./papers-100.json', import.meta.url), json);
const lengths = papers.map(p => p.title.length);
console.log(JSON.stringify({
  count: papers.length,
  seed: `0x${SEED.toString(16)}`,
  md5: createHash('md5').update(json).digest('hex'),
  bytes: Buffer.byteLength(json),
  title: {min: Math.min(...lengths), max: Math.max(...lengths)},
  body: {min: Math.min(...papers.map(p => p.body.length)), max: Math.max(...papers.map(p => p.body.length))},
  withoutSummary: papers.filter(p => !p.summary).length,
}, null, 1));
