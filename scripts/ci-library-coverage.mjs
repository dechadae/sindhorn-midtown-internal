#!/usr/bin/env node
/* /ci is the master UI library — the only place a component is designed.

   This proves it is complete: every class and every variant value the Sindhorn
   app renders must also be rendered by /ci, or be a declared exception. It
   exists because that rule had no gate for 33 releases, and the page audit
   passed green the whole time while primitives were being designed elsewhere
   and never specimened.

   It reads the RENDERED page, not the source, because ci-library.js injects
   markup (the business card's QR) that a text scan cannot see — the same
   mistake the earlier audit made: testing the text instead of the applied
   state.

     node scripts/ci-library-coverage.mjs [--json] */
import {readFileSync, readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const site = path.join(root, 'site');

/* Vocabulary a page declares but the library has no component for. */
const EXCEPTIONS = [
  { key: 'data-public="doc"', since: '2026-09-06',
    reason: 'A <body> attribute that zeroes the navbar height on a public document page. Page plumbing, not a component; there is nothing to specimen.' },
  { key: 'data-betta-mode', since: '2026-09-06',
    reason: 'The atmosphere runtime stamps the period on <body>; the renderer is not a library component.' },
];

const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = createServer(async (req, res) => {
  let name = decodeURIComponent(req.url.split('?')[0]);
  if (name === '/') name = '/index.html';
  let body = null, file = path.join(site, name);
  try { body = readFileSync(file); } catch { body = null; }
  if (!body) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'});
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));

/* What /ci actually renders, after its own script has run. */
const page = await (await browser.newContext({viewport: {width: 390, height: 900}})).newPage();
/* /ci opens only for the developer account, so the library never renders
   without a session - the gate state does. Same fixture the render smoke uses. */
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = `${b64({alg: 'none', typ: 'JWT'})}.${b64({sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400})}.smoke`;
await page.addInitScript(t => localStorage.setItem('sindhorn-midtown-auth-session-v1', JSON.stringify(
  {access_token: t, refresh_token: 'smoke', expires_at: Math.floor(Date.now() / 1000) + 86400, token_type: 'bearer', user: null})), token);
await page.route('**/rest/v1/rpc/sindhorn_current_employee_profile', r => r.fulfill({status: 200, contentType: 'application/json',
  body: JSON.stringify({id: '00000000-0000-0000-0000-000000000001', employee_number: '10639', display_name: 'CI Developer', role: 'super_admin', account_type: 'developer', work_email: null, pin_configured_at: new Date().toISOString(), active: true})}));
await page.route(/supabase\.co\/rest\/v1\/(?!rpc\/sindhorn_current_employee_profile)/, r => r.fulfill({status: 200, contentType: 'application/json', body: '[]'}));
await page.goto(`${base}/ci.html`, {waitUntil: 'networkidle'});
await page.waitForTimeout(1200);
/* No interaction. A contract that has to click to find something is not
   deterministic - this gate passed locally and failed in CI on exactly that,
   because the clicks landed differently. If the library only shows a state
   when someone opens it, the library does not show it: specimen it open. */
const shown = await page.evaluate(() => {
  const classes = new Set(), variants = new Set();
  for (const el of document.querySelectorAll('*')) {
    for (const c of el.classList) if (c.startsWith('app-')) classes.add(c);
    for (const a of el.attributes) if (a.name.startsWith('data-') && a.value) variants.add(`${a.name}="${a.value}"`);
  }
  return {classes: [...classes], variants: [...variants]};
});
await browser.close(); server.close();

/* What the Sindhorn app declares. Static read: the app's own pages and modules,
   never the doc pages and never the evidence reconstructions. */
const appFiles = readdirSync(site).filter(f => /\.(js|html)$/.test(f))
  /* The doc pages count. They ship from this origin under this service worker on
   this library, so they are Sindhorn, and vocabulary they render must be in
   /ci like any other. Treating them as a lesser category is what let a whole
   private vocabulary grow outside the library in the first place. */
  .filter(f => !['ci.html','betta-vignette-test.html','betta-vignette-test.js','sw.js','_worker.js'].includes(f))
  .map(f => path.join(site, f));
const src = appFiles.map(f => readFileSync(f, 'utf8')).join('\n');
const used = {classes: new Set(), variants: new Set()};
for (const m of src.matchAll(/class="([^"$]*?)"/g)) for (const c of m[1].split(/\s+/)) if (c.startsWith('app-')) used.classes.add(c);
for (const m of src.matchAll(/classList\.(?:add|toggle)\(\s*'([\w-]+)'/g)) if (m[1].startsWith('app-')) used.classes.add(m[1]);
/* Only vocabulary the library styles. A page carries plenty of script hooks -
   data-route, data-format, data-transport - which are behaviour, not variants,
   and the library has nothing to show for them. */
const stylesheet = ['app-components.css','app-glass.css','app-compositions.css','app-shell.css']
  .map(f => readFileSync(path.join(site, f), 'utf8')).join('\n');
const styledValues = new Set([...stylesheet.matchAll(/\[data-(\w[\w-]*)="([\w-]+)"\]/g)].map(m => `data-${m[1]}="${m[2]}"`));
for (const m of src.matchAll(/(data-[\w-]+)="([\w-]+)"/g)) { const k = `${m[1]}="${m[2]}"`; if (styledValues.has(k)) used.variants.add(k); }
const camel = a => { const p = a.split('-'); return p[0] + p.slice(1).map(x => x[0].toUpperCase() + x.slice(1)).join(''); };
/* dataset.view = 'push' — a value the library styles but no markup spells out. */
for (const [, attr, value] of stylesheet.matchAll(/\[data-(\w[\w-]*)="([\w-]+)"\]/g)) {
  const key = `data-${attr}="${value}"`;
  if (used.variants.has(key)) continue;
  const set = new RegExp(`dataset\\.${camel(attr)}\\s*=|setAttribute\\(\\s*['"\`]data-${attr}`);
  if (set.test(src) && new RegExp(`['"\`]${value}['"\`]`).test(src)) used.variants.add(key);
}

const excepted = new Set(EXCEPTIONS.map(e => e.key));
const findings = [];
for (const c of [...used.classes].sort()) if (!shown.classes.includes(c) && !excepted.has(c)) findings.push(`.${c}: the app renders it, /ci does not`);
for (const v of [...used.variants].sort()) if (!shown.variants.includes(v) && !excepted.has(v) && !excepted.has(v.split('=')[0])) findings.push(`${v}: the app renders it, /ci does not`);

const ok = findings.length === 0;
console.log(JSON.stringify({ok, shown: {classes: shown.classes.length, variants: shown.variants.length},
  used: {classes: used.classes.size, variants: used.variants.size}, exceptions: EXCEPTIONS.length, findings}, null, findings.length ? 1 : 0));
if (!ok) process.exit(1);
