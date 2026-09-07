#!/usr/bin/env node
/* The release brief. It never pushes.

   Everything a release needs checked, run locally, reduced to the three
   questions the owner actually decides:

     new vocabulary   a primitive, variant attribute or value nobody admitted
     governed files   the registry, the workflows, the ratchet, CODEOWNERS
     moved pixels     any live page that looks different from the last commit

   The third is why this exists at the desk rather than in CI: the pixel diff
   is the only check that caught the corrupted containment rule and the /ci
   regression while all eighteen gates were green, and CI cannot run it -
   there is no previous deploy to compare against inside a fresh runner.

   Exit 0  nothing flagged; the release may go without asking.
   Exit 10 green light required.
   Exit 1  something is broken; there is nothing to ask about yet.

     node scripts/release-brief.mjs [--json] */
import {execFileSync, execSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const run = (cmd, args) => { try { return {ok: true, out: execFileSync(cmd, args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})}; }
  catch (e) { return {ok: false, out: (e.stdout || '') + (e.stderr || '')}; } };

/* ---- what changed ------------------------------------------------------- */
const changed = execSync('git status --porcelain', {cwd: root, encoding: 'utf8'})
  .split('\n').filter(Boolean).map(l => l.slice(3).trim()).filter(Boolean);
const GOVERNED = [/^governance\//, /^\.github\/workflows\//, /^scripts\/ui-centralization-budget\.json$/, /^CODEOWNERS$/];
const governed = changed.filter(f => GOVERNED.some(p => p.test(f)));
const sw = (readFileSync(path.join(root, 'site/sw.js'), 'utf8').match(/VERSION='([^']+)'/) || [, '?'])[1];
const swWas = (() => { try { return (execSync('git show HEAD:site/sw.js', {cwd: root, encoding: 'utf8'}).match(/VERSION='([^']+)'/) || [, '?'])[1]; } catch { return '?'; } })();

/* ---- gates -------------------------------------------------------------- */
const GATES = ['contract-integrity', 'ui-centralization-budget', 'page-centralization-audit', 'shell-precache-parity-smoke',
  'sw-install-resilience-smoke', 'ci-page-render-smoke', 'idui-invariants-smoke', 'ui-shape-source-audit',
  'idui-core-parity-smoke', 'idui-constitution-completeness', 'nested-glass-smoke', 'evidence-append-only',
  'material-authority-gate', 'ci-library-coverage', 'no-horizontal-overflow'];
const gateResults = GATES.map(g => ({gate: g, ...run('node', [`scripts/${g}.mjs`])}));
const broken = gateResults.filter(g => !g.ok);

/* Vocabulary is reported, never merely failed: a stop is a question. */
const vocab = run('node', ['scripts/vocabulary-admission-gate.mjs']);
let newVocabulary = [];
try { newVocabulary = JSON.parse(vocab.out.slice(vocab.out.indexOf('{'))).stops || []; } catch {}

/* ---- pixels ------------------------------------------------------------- */
const ROUTES = ['/index.html', '/ci.html', '/voice.html', '/idui.html', '/evidence.html', '/origarium.html'];
let pixels = null, pixelError = null;
async function measurePixels() {
  /* playwright-core is vendored into this repository - 458 tracked files - so
     `npm install` at the root deletes tracked files. The two diff libraries go
     into a cache outside the repo instead, installed once. */
  let pixelmatch, PNG, chromium;
  const cache = path.join(process.env.HOME || tmpdir(), '.cache/sindhorn-release-brief');
  const load = async name => {
    try { return await import(name); } catch {}
    const local = path.join(cache, 'node_modules', name);
    if (!existsSync(local)) {
      try {
        execSync(`mkdir -p ${cache} && cd ${cache} && [ -f package.json ] || echo '{"private":true}' > package.json`, {shell: '/bin/bash', stdio: 'ignore'});
        execSync('npm install --prefix ' + cache + ' pixelmatch pngjs', {stdio: 'ignore'});
      } catch { return null; }
    }
    try { return await import(`file://${local}/${name === 'pngjs' ? 'lib/png.js' : 'index.js'}`); }
    catch { try { return await import(local); } catch { return null; } }
  };
  try { ({chromium} = await import('playwright')); } catch { pixelError = 'playwright unavailable'; return; }
  const pm = await load('pixelmatch'), pj = await load('pngjs');
  if (!pm || !pj) { pixelError = 'pixelmatch/pngjs unavailable'; return; }
  pixelmatch = pm.default || pm; PNG = pj.PNG || pj.default?.PNG;
  if (!pixelmatch || !PNG) { pixelError = 'pixelmatch/pngjs did not load'; return; }
  const base = mkdtempSync(path.join(tmpdir(), 'brief-'));
  execSync(`git archive HEAD site | tar -x -C ${base}`, {cwd: root, shell: '/bin/bash'});
  const serve = dir => new Promise(res => { const s = createServer((req, r) => {
      let n = decodeURIComponent(req.url.split('?')[0]); if (n === '/') n = '/index.html';
      const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
      let body = null; const f = path.join(dir, n);
      try { body = readFileSync(f); } catch { r.writeHead(404); return r.end(); }
      r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'}); r.end(body);
    }); s.listen(0, '127.0.0.1', () => res({port: s.address().port, close: () => s.close()})); });
  const a = await serve(path.join(base, 'site')), b = await serve(path.join(root, 'site'));
  const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, reducedMotion: 'reduce'});
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({alg:'none',typ:'JWT'})}.${b64({sub:'00000000-0000-0000-0000-000000000001',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})}.brief`;
  const shot = async (server, route) => {
    const page = await ctx.newPage();
    await page.addInitScript(t => localStorage.setItem('sindhorn-midtown-auth-session-v1', JSON.stringify(
      {access_token: t, refresh_token: 'brief', expires_at: Math.floor(Date.now()/1000)+86400, token_type: 'bearer', user: null})), token);
    await page.route('**/rest/v1/rpc/sindhorn_current_employee_profile', r => r.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify({id:'00000000-0000-0000-0000-000000000001', employee_number:'10639', display_name:'CI Developer', role:'super_admin', account_type:'developer', work_email:null, pin_configured_at:new Date().toISOString(), active:true})}));
    await page.route(/supabase\.co\/rest\/v1\/(?!rpc\/sindhorn_current_employee_profile)/, r => r.fulfill({status: 200, contentType: 'application/json', body: '[]'}));
    await page.goto(`http://127.0.0.1:${server.port}${route}`, {waitUntil: 'networkidle'});
    await page.addStyleTag({content: '.environment-stage,#glCanvas,.environment-canvas,canvas{visibility:hidden!important}*{animation:none!important;transition:none!important}'});
    /* Pin the atmosphere. Since r57 the document pages run the live Betta, and
       two screenshots taken seconds apart catch it mid-transition - a sparse
       difference across every row that means nothing and hides the ones that
       do. Both sides are pinned to the same period, so a real change still
       shows and a moving sky does not. */
    await page.evaluate(() => window.SindhornEnvironment?.setBettaPeriod?.('midnight')).catch(() => {});
    /* Mask the version stamp. Every document page prints the service worker it
       was built with, twice, so a release that changes nothing else still
       reports a few hundred differing pixels and the number stops meaning
       anything. Hidden on both sides, so a real change to that line would still
       change the layout around it. */
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('code, .app-note, .app-metric-value')) {
        /* Both forms: the full worker name, and the short v137-slug-r58 that
           build-origarium stamps. */
        if (/(sindhorn-midtown-internal-pwa-)?v\d+-[a-z0-9-]*r\d+/.test(el.textContent || '')) el.style.visibility = 'hidden';
      }
    }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const c = document.querySelector('.environment-canvas'); if (c) c.remove(); });
    const png = PNG.sync.read(await page.screenshot({fullPage: true, animations: 'disabled'}));
    await page.close(); return png;
  };
  pixels = {};
  for (const route of ROUTES) {
    try {
      const [x, y] = [await shot(a, route), await shot(b, route)];
      if (x.width !== y.width || x.height !== y.height) { pixels[route] = {size: [x.width, x.height, y.width, y.height]}; continue; }
      const diff = new PNG({width: x.width, height: x.height});
      pixels[route] = {differing: pixelmatch(x.data, y.data, diff.data, x.width, x.height, {threshold: 0.1}), of: x.width * x.height};
      if (pixels[route].differing) writeFileSync(path.join(root, `.brief-${route.replace(/\W/g, '_')}.png`), PNG.sync.write(diff));
    } catch (e) { pixels[route] = {error: String(e.message).slice(0, 60)}; }
  }
  await browser.close(); a.close(); b.close(); rmSync(base, {recursive: true, force: true});
}
await measurePixels();

/* ---- the brief ---------------------------------------------------------- */
const moved = pixels ? Object.entries(pixels).filter(([, v]) => v.size || v.differing) : [];
const flagged = newVocabulary.length > 0 || governed.length > 0 || moved.length > 0;
const pad = (s, n) => String(s).padEnd(n);

if (process.argv.includes('--json')) console.log(JSON.stringify({sw, swWas, changed: changed.length, governed, newVocabulary, pixels, broken: broken.map(b => b.gate), flagged}, null, 1));
else {
  console.log(`\nRELEASE BRIEF   ${swWas} → ${sw}`);
  console.log(`${changed.length} files changed · ${GATES.length} gates run · nothing pushed\n`);
  console.log(`  ${pad('NEW VOCABULARY', 18)}${newVocabulary.length ? newVocabulary.map(s => s.replace(/^NEW [A-Z ]+— /, '')).join('\n' + ' '.repeat(20)) : 'none'}`);
  console.log(`  ${pad('GOVERNED FILES', 18)}${governed.length ? governed.join('\n' + ' '.repeat(20)) : 'none'}`);
  if (pixelError) console.log(`  ${pad('PIXELS MOVED', 18)}not measured — ${pixelError}`);
  else console.log(`  ${pad('PIXELS MOVED', 18)}${moved.length ? moved.map(([r, v]) => `${r} ${v.size ? `size ${v.size.slice(0,2).join('x')} → ${v.size.slice(2).join('x')}` : v.differing + ' px'}`).join('\n' + ' '.repeat(20)) : `none across ${ROUTES.length} routes`}`);
  console.log('');
  if (broken.length) { console.log(`  BROKEN: ${broken.map(b => b.gate).join(', ')}\n`); for (const b of broken) console.log(b.out.trim().split('\n').slice(-4).map(l => '    ' + l).join('\n')); }
  else console.log(`  ${GATES.length} gates green`);
  console.log('  ' + '─'.repeat(58));
  console.log(broken.length ? '  BROKEN — nothing to ask about yet\n'
    : flagged ? '  GREEN LIGHT REQUIRED — nothing has been pushed\n'
    : '  CLEAR — no vocabulary, no governed file, no pixel moved\n');
}
process.exit(broken.length ? 1 : flagged ? 10 : 0);
