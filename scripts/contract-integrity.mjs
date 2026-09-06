#!/usr/bin/env node
/* The contracts cannot be weakened quietly.

   Nothing inside a repository can stop the process that writes the repository.
   A gate is a file, and the author of the gate is the author of the code it
   judges. This does not pretend otherwise. What it does is remove the quiet
   option: every weakening of the architecture's enforcement becomes a visible
   edit in one known file, instead of a silent change buried in a release.

   It records, in governance/idui-contract.json:

     the hash of every contract script          - editing one fails until re-seeded
     the gates the deploy guard invokes         - deleting one from CI fails
     the assertion count of each gate           - removing a check fails
     the size of the admitted vocabulary        - it may shrink freely, never grow
     the size of every exception list           - same

   Growing an allowance or shrinking a check is not forbidden here. It is made
   loud: it cannot happen without a diff to the registry, which is the one file
   the owner reviews. That is the difference between tamper-proof, which is not
   available, and tamper-evident, which is.

     node scripts/contract-integrity.mjs           check
     node scripts/contract-integrity.mjs --seed    record today's state (owner) */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const registryPath = path.join(root, 'governance/idui-contract.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const seed = process.argv.includes('--seed');

const GATES = [
  'scripts/material-authority-gate.mjs',
  'scripts/vocabulary-admission-gate.mjs',
  'scripts/ci-library-coverage.mjs',
  'scripts/page-centralization-audit.mjs',
  'scripts/idui-constitution-completeness.mjs',
  'scripts/idui-core-parity-smoke.mjs',
  'scripts/idui-invariants-smoke.mjs',
  'scripts/ui-shape-source-audit.mjs',
  'scripts/evidence-append-only.mjs',
  'scripts/contract-integrity.mjs',
];

const sha = f => createHash('sha256').update(readFileSync(path.join(root, f))).digest('hex').slice(0, 16);
/* Every place a gate can report a violation. Fewer than recorded means a check
   was taken out. */
const assertions = f => (readFileSync(path.join(root, f), 'utf8')
  .match(/(?:findings|failures|stops|drift|coverage)\.push|process\.exit\(1\)|exitCode\s*=\s*1/g) || []).length;

const workflow = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
const vocab = registry.core.vocabulary;
const exceptionCounts = () => {
  const counts = {};
  const scan = (o, at) => { for (const [k, v] of Object.entries(o || {})) {
    if (Array.isArray(v) && /exception/i.test(k)) counts[`${at}${k}`] = v.length;
    else if (v && typeof v === 'object') scan(v, `${at}${k}.`); } };
  scan(registry, '');
  /* Declared exceptions living in the gates themselves. */
  for (const f of ['scripts/page-centralization-audit.mjs', 'scripts/ci-library-coverage.mjs'])
    counts[f] = (readFileSync(path.join(root, f), 'utf8').match(/since:\s*'/g) || []).length;
  return counts;
};

if (seed) {
  registry.integrity = {
    $comment: 'Recorded state of the contracts. Changing any number here is the visible act of changing what the architecture enforces; scripts/contract-integrity.mjs fails until it is re-seeded, and re-seeding is a registry diff the owner reviews.',
    seeded: new Date().toISOString().slice(0, 10),
    gates: Object.fromEntries(GATES.map(f => [f, {sha256: sha(f), assertions: assertions(f)}])),
    guardInvokes: GATES.filter(f => workflow.includes(f)),
    limits: {admittedRoots: vocab.primitiveRoots.length, variantValues: vocab.variantValues.length,
      variantAttributes: vocab.variantAttributes.length, exceptions: exceptionCounts()},
  };
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(JSON.stringify({seeded: true, gates: GATES.length, guardInvokes: registry.integrity.guardInvokes.length}, null, 1));
  process.exit(0);
}

const rec = registry.integrity;
const findings = [];
if (!rec) findings.push('the registry records no integrity state — run --seed');
else {
  for (const [f, want] of Object.entries(rec.gates)) {
    if (!existsSync(path.join(root, f))) { findings.push(`${f}: a contract script was deleted`); continue; }
    if (sha(f) !== want.sha256) findings.push(`${f}: changed since it was recorded — re-seed the registry so the change is on the record`);
    const now = assertions(f);
    if (now < want.assertions) findings.push(`${f}: ${want.assertions} checks recorded, ${now} present — a check was removed`);
  }
  for (const f of rec.guardInvokes) if (!workflow.includes(f)) findings.push(`${f}: the deploy guard no longer runs it`);
  /* A duplicate key inside a step is accepted by most YAML readers - last one
     wins - and rejected by the workflow parser, which fails the whole file and
     runs nothing. r54 shipped exactly that: two `if:` keys on one step, a local
     parse that passed for the wrong reason, and a guard that never ran. */
  {
    let step = null, seen = new Set();
    workflow.split('\n').forEach((line, i) => {
      const name = /^ {6}- name: (.+)$/.exec(line);
      if (name) { step = name[1]; seen = new Set(); return; }
      const key = /^ {8}([a-z-]+):/.exec(line);
      if (!key || !step) return;
      if (seen.has(key[1])) findings.push(`.github/workflows/deploy.yml line ${i + 1}: "${key[1]}" is defined twice on step "${step}" — the workflow parser rejects the file and nothing runs`);
      seen.add(key[1]);
    });
  }
  const lim = rec.limits;
  if (vocab.primitiveRoots.length > lim.admittedRoots) findings.push(`admitted primitives grew ${lim.admittedRoots} → ${vocab.primitiveRoots.length} — admission is the owner's`);
  if (vocab.variantValues.length > lim.variantValues) findings.push(`admitted variant values grew ${lim.variantValues} → ${vocab.variantValues.length} — admission is the owner's`);
  if (vocab.variantAttributes.length > lim.variantAttributes) findings.push(`admitted variant attributes grew ${lim.variantAttributes} → ${vocab.variantAttributes.length}`);
  const now = exceptionCounts();
  for (const [k, was] of Object.entries(lim.exceptions || {}))
    if ((now[k] ?? 0) > was) findings.push(`exceptions in ${k} grew ${was} → ${now[k]} — an allowance widened`);
}

const ok = findings.length === 0;
console.log(JSON.stringify({ok, gates: GATES.length, findings}, null, findings.length ? 1 : 0));
if (!ok) process.exit(1);
