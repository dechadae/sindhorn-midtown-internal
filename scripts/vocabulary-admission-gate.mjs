#!/usr/bin/env node
/* The vocabulary boundary does not move without the owner.

   Two different things get confused, so this gate separates them:

     New vocabulary rendered by a page must be represented in /ci.
     That is ci-library-coverage.mjs, and it is closed.

     The vocabulary boundary ITSELF expanding - a new primitive identity, a new
     variant attribute, a new variant value - is not something a machine can
     judge. It can only detect it. So it stops, and the owner classifies:
     behaviour earned it, or it is appearance and must be recomposed.

   Adding a part to an admitted primitive is not a new identity. `.app-card`
   is admitted, so `.app-card-section` is structure, not vocabulary; it still
   has to appear in /ci like anything else.

   Admission is a change to governance/idui-contract.json, which CODEOWNERS
   covers. It is deliberately not a marker in the source that the builder could
   write for itself - that would rebuild the loophole in another shape.

     node scripts/vocabulary-admission-gate.mjs [--json] */
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const contract = JSON.parse(readFileSync(path.join(root, 'governance/idui-contract.json'), 'utf8'));
const vocab = contract.core.vocabulary;
const sheets = [...contract.core.sheets];
for (const group of ['products', 'evidence'])
  for (const scope of Object.values(contract[group] || {}))
    for (const f of scope.materialAuthorities || []) if (!sheets.includes(f)) sheets.push(f);

const css = sheets.map(f => readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
const classes = [...new Set([...css.matchAll(/\.(app-[\w-]+)/g)].map(m => m[1]))];
const admitted = new Set(vocab.primitiveRoots);
const partOfAdmitted = c => vocab.primitiveRoots.some(r => c.startsWith(r + '-'));

const stops = [];
for (const c of classes.sort()) {
  if (admitted.has(c) || partOfAdmitted(c)) continue;
  stops.push(`NEW PRIMITIVE — .${c} is not an admitted identity, and is not a part of one`);
}
const values = new Set(vocab.variantValues), attrs = new Set(vocab.variantAttributes);
for (const [, a, v] of css.matchAll(/\[data-(\w[\w-]*)="([\w-]+)"\]/g)) {
  if (!attrs.has(a)) { const s = `NEW VARIANT ATTRIBUTE — data-${a} is not in the admitted vocabulary`; if (!stops.includes(s)) stops.push(s); continue; }
  if (!values.has(`${a}=${v}`)) { const s = `NEW VARIANT VALUE — data-${a}="${v}" is not admitted`; if (!stops.includes(s)) stops.push(s); }
}

const ok = stops.length === 0;
if (!ok) {
  console.error('NEW VOCABULARY DETECTED — admission required.\n');
  for (const s of stops) console.error('  ' + s);
  console.error(`\nA machine cannot decide whether this earned its place. The owner does:\n` +
    `  behaviour, interaction, accessibility or state model earned it  -> admit it in\n` +
    `      governance/idui-contract.json, and specimen it in /ci\n` +
    `  it only looks different                                        -> recompose from what exists\n`);
}
console.log(JSON.stringify({ok, sheets: sheets.length, classes: classes.length,
  admittedRoots: vocab.primitiveRoots.length, admittedValues: vocab.variantValues.length, stops}, null, stops.length ? 1 : 0));
if (!ok) process.exit(1);
