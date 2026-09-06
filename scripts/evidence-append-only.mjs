#!/usr/bin/env node
/* Evidence is append-only by experimental state.

   A later run may supersede an interpretation; it may never overwrite the
   observation it corrected. The rule exists because re-running the Test 02.3
   hostile harness after the repair once erased the failing numbers, leaving a
   file whose meaning depended on which run happened most recently.

   So a manifest names its states, each state file carries its own commit and
   outcome, and this gate proves nothing under a manifest has moved since it was
   recorded. A manifest that holds measurements of its own is itself a finding:
   that is the generic result file the rule forbids.

     node scripts/evidence-append-only.mjs */
import {readdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sha = buf => createHash('sha256').update(buf).digest('hex');
const findings = [];
let manifests = 0, states = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') await walk(full); continue; }
    if (!entry.name.endsWith('.json')) continue;
    let doc; try { doc = JSON.parse(await readFile(full, 'utf8')); } catch { continue; }
    if (!doc || !Array.isArray(doc.states)) continue;
    manifests++;
    const rel = path.relative(root, full);

    /* A manifest points; it does not measure. */
    for (const key of Object.keys(doc)) {
      if (!['test', 'note', 'fixture', 'states'].includes(key)) {
        findings.push(`${rel}: manifest carries "${key}" - a manifest points at states, it never holds measurements`);
      }
    }
    if (doc.fixture?.file) {
      const fixture = path.join(dir, doc.fixture.file);
      const got = await readFile(fixture).then(sha, () => null);
      if (got === null) findings.push(`${rel}: fixture ${doc.fixture.file} is missing`);
      else if (doc.fixture.sha256 && got !== doc.fixture.sha256) findings.push(`${rel}: fixture ${doc.fixture.file} changed since it was frozen`);
    }
    const seen = new Set();
    for (const s of doc.states) {
      states++;
      if (seen.has(s.state)) findings.push(`${rel}: two states named "${s.state}"`);
      seen.add(s.state);
      for (const need of ['state', 'file', 'commit', 'sha256']) {
        if (!s[need]) findings.push(`${rel}: state "${s.state || '?'}" declares no ${need}`);
      }
      const body = await readFile(path.join(dir, s.file || '')).catch(() => null);
      if (!body) { findings.push(`${rel}: state "${s.state}" points at ${s.file}, which is not there`); continue; }
      if (sha(body) !== s.sha256) findings.push(`${rel}: ${s.file} has changed since it was recorded - an observation was overwritten`);
      const state = JSON.parse(body);
      if (state.state !== s.state) findings.push(`${rel}: ${s.file} calls itself "${state.state}", the manifest calls it "${s.state}"`);
    }
  }
}

for (const dir of ['idui-core/evidence']) await walk(path.join(root, dir));
const ok = findings.length === 0;
console.log(JSON.stringify({ok, manifests, states, findings}, null, findings.length ? 1 : 0));
if (!ok) process.exit(1);
