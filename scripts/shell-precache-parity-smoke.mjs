/* Every asset the shell loads must also be precached by the service worker.
   This is a static check on purpose: the browser smoke suites all run with
   serviceWorkers:'block', so none of them can see a precache gap.

   The gap this guards against is not cosmetic. Measured on preview-ci-glass:
     - app-glass.css unavailable  -> the masthead falls back to the Supabase
       pack's own recipe, rgba(46,39,59,0.52) + saturate(1.3): a solid purple
       bar instead of canonical 0.30 frosted glass.
     - app-glass-runtime.js unavailable -> bootstrap.js statically imports it,
       so the module graph fails and the authenticated shell never boots at all
       (0 children in #app-header and #route-view).
*/
import fs from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve('site');
const index = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(siteDir, 'sw.js'), 'utf8');

const shellMatch = sw.match(/const SHELL=\[(.*?)\];/s);
if (!shellMatch) throw new Error('Could not locate the SHELL precache array in site/sw.js');
const shellEntries = [...shellMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const precached = new Set(shellEntries.map(p => p.split('?')[0]));

const referenced = [];
for (const m of index.matchAll(/(?:href|src)="(\/[^"]+?)(?:\?[^"]*)?"/g)) {
  if (/\.(css|js)$/.test(m[1])) referenced.push(m[1]);
}

const missing = [...new Set(referenced)].filter(r => !precached.has(r));
if (missing.length) {
  console.error('Shell assets referenced by index.html but NOT precached by sw.js:');
  for (const m of missing) console.error(`  ${m}`);
  console.error('\nAdd them to SHELL in site/sw.js and bump VERSION.');
  process.exit(1);
}

const onDisk = shellEntries.filter(p => p !== '/' && !fs.existsSync(path.join(siteDir, p.split('?')[0])));
if (onDisk.length) {
  console.error('SHELL lists paths that do not exist on disk (precacheShell would throw and the SW would fail to install):');
  for (const p of onDisk) console.error(`  ${p}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  shellEntries: shellEntries.length,
  referencedShellAssets: [...new Set(referenced)].length,
  unprecached: 0,
  missingOnDisk: 0
}));
