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
import {RPC} from './release-brief-fixtures.mjs';

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
/* The document pages stamp the service worker they were built with, so a
   builder run before the VERSION bump leaves them stale and the deploy guard
   rejects the release. That happened in r61 and cost a red build; the brief
   checks it here, where it is a one-line fix rather than a failed deploy. */
for (const b of ['build-idui', 'build-evidence', 'build-origarium', 'build-betta'])
  gateResults.push({gate: `${b} --check`, ...run('node', [`scripts/${b}.mjs`, '--check'])});
const broken = gateResults.filter(g => !g.ok);

/* Vocabulary is reported, never merely failed: a stop is a question. */
const vocab = run('node', ['scripts/vocabulary-admission-gate.mjs']);
let newVocabulary = [];
try { newVocabulary = JSON.parse(vocab.out.slice(vocab.out.indexOf('{'))).stops || []; } catch {}

/* ---- pixels ------------------------------------------------------------- */
/* Every page, signed in. The shell answers its RPCs from the synthetic read
   models in release-brief-fixtures.mjs, so Today, F&B, Jobs, Messages and
   the four Settings pages render their populated compositions - the ones the
   search-well regression (r37 to r66) lived in while the six static routes
   diffed clean. The shell's hash routes are one document; the diff names
   them by hash. */
const ROUTES = ['/index.html', '/index.html#fnb', '/index.html#jobs', '/index.html#messages', '/index.html#brand',
  '/index.html#settings/me', '/index.html#settings/admin', '/index.html#settings/broadcast', '/index.html#settings/system',
  '/ci.html', '/voice.html', '/idui.html', '/evidence.html', '/origarium.html', '/betta.html'];
/* Two widths. A change that only appears on a wide screen is invisible to a
   phone-only diff, and the brief would report "no pixels moved" about a page
   it had just rearranged. */
const WIDTHS = [390, 1280];
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
  /* One server for both sides, its root switched per shot, so the page has
     the same origin on each side: the business card prints location.origin
     in its URL line and inside its QR, and two ports made Settings › Me
     differ by a port number on every release (r67). Service workers are
     blocked in these contexts so one side's precache can never answer the
     other side's navigation on the shared origin, and nothing is cached
     between shots. */
  const sides = {head: path.join(base, 'site'), tree: path.join(root, 'site')};
  let dir = sides.head;
  const server = await new Promise(res => { const s = createServer((req, r) => {
      let n = decodeURIComponent(req.url.split('?')[0]); if (n === '/') n = '/index.html';
      const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
      let body = null; const f = path.join(dir, n);
      try { body = readFileSync(f); } catch { r.writeHead(404); return r.end(); }
      r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store'}); r.end(body);
    }); s.listen(0, '127.0.0.1', () => res({port: s.address().port, close: () => s.close()})); });
  const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));
  const contexts = {};
  for (const w of WIDTHS) contexts[w] = await browser.newContext({viewport: {width: w, height: 844}, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block'});
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({alg:'none',typ:'JWT'})}.${b64({sub:'00000000-0000-0000-0000-000000000001',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})}.brief`;
  const open = async (side, route, width) => {
    dir = sides[side];
    const page = await contexts[width].newPage();
    await page.addInitScript(t => localStorage.setItem('sindhorn-midtown-auth-session-v1', JSON.stringify(
      {access_token: t, refresh_token: 'brief', expires_at: Math.floor(Date.now()/1000)+86400, token_type: 'bearer', user: null})), token);
    /* The session above is the fixtures' developer; each read model answers
       from the fixtures by RPC name, and anything unnamed - every write, the
       atmosphere periods - answers [] as it always did. */
    await page.route(/supabase\.co\/rest\/v1\//, r => {
      const name = r.request().url().match(/\/rpc\/([a-z0-9_]+)/)?.[1];
      return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(RPC[name]?.() ?? [])});
    });
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
       change the layout around it.
       The badge is masked for a second reason: /idui prints the stamp in its
       masthead badge, and a slug of a different length changed the page's
       height, which short-circuits the pixel compare into a size line. The
       longest route reported nothing but its own height for two releases. */
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('code, .app-note, .app-metric-value, .app-badge')) {
        /* Both forms: the full worker name, and the short v137-slug-r58 that
           build-origarium stamps. */
        if (/(sindhorn-midtown-internal-pwa-)?v\d+-[a-z0-9-]*r\d+/.test(el.textContent || '')) el.style.visibility = 'hidden';
      }
    }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const c = document.querySelector('.environment-canvas'); if (c) c.remove(); });
    return page;
  };
  /* A document taller than the compositor's surface limit cannot be captured
     with fullPage. Chromium returns an image of the right size whose content
     past the limit is not this render: measured 9 September 2026, two builds
     of /idui came back byte-identical while five links on the page had changed
     colour - the same region clipped in the viewport differed by 370 pixels,
     and the older side's capture held no blue pixel although three of its
     links were blue in the DOM. Every route under the limit diffed correctly
     (/origarium at 15,516px), so the brief was silently blind to exactly one
     page, the longest one it has. Above the limit the page is read a viewport
     at a time and each slice is compared as it is taken, which also keeps a
     61,000px document out of a 96MB buffer.
     The fixed chrome is hidden for those slices: it would otherwise repeat at
     every scroll position and hide the band of content behind it. The navbar
     and masthead are the same on the three short document routes, which are
     compared whole. */
  const SURFACE_LIMIT = 16000;
  const metrics = page => page.evaluate(() => ({w: document.scrollingElement.clientWidth, h: document.scrollingElement.scrollHeight}));
  const slice = async (page, top, y, w, h) => {
    await page.evaluate(t => scrollTo(0, t), top);
    await page.waitForTimeout(60);
    return PNG.sync.read(await page.screenshot({clip: {x: 0, y, width: w, height: h}, animations: 'disabled'}));
  };
  pixels = {};
  for (const width of WIDTHS) for (const route of ROUTES) {
    const key = `${route} @${width}`;
    let a = null, b = null;
    try {
      a = await open('head', route, width); b = await open('tree', route, width);
      const [ma, mb] = [await metrics(a), await metrics(b)];
      if (ma.w !== mb.w || ma.h !== mb.h) { pixels[key] = {size: [ma.w, ma.h, mb.w, mb.h]}; continue; }
      /* 0.05, not pixelmatch's 0.1: a --app-line hairline is 9% white over the
         dark ground and falls under 0.1 - r71 widened the head hairline of
         every sectioned card and the brief reported zero moved pixels on
         Today and Jobs. Measured 8 Sep 2026 on this same shot path: the same
         tree shot twice differs by zero pixels at every threshold down to 0,
         so the lower number adds no noise; r70 against r71 at 0.05 shows
         exactly the widened lines and nothing else. Owner-approved. */
      const match = (x, y, w, h, out) => pixelmatch(x.data, y.data, out.data, w, h, {threshold: 0.05});
      if (ma.h <= SURFACE_LIMIT) {
        const [x, y] = [PNG.sync.read(await a.screenshot({fullPage: true, animations: 'disabled'})), PNG.sync.read(await b.screenshot({fullPage: true, animations: 'disabled'}))];
        if (x.width !== y.width || x.height !== y.height) { pixels[key] = {size: [x.width, x.height, y.width, y.height]}; continue; }
        const diff = new PNG({width: x.width, height: x.height});
        pixels[key] = {differing: match(x, y, x.width, x.height, diff), of: x.width * x.height};
        if (pixels[key].differing) writeFileSync(path.join(root, `.brief-${key.replace(/\W/g, '_')}.png`), PNG.sync.write(diff));
      } else {
        const hide = () => { for (const el of document.querySelectorAll('.app-navbar,.app-masthead')) el.style.visibility = 'hidden'; };
        await a.evaluate(hide); await b.evaluate(hide);
        const vh = a.viewportSize().height;
        let differing = 0; const bands = [];
        for (let y = 0; y < ma.h; y += vh) {
          const h = Math.min(vh, ma.h - y), top = Math.min(y, ma.h - vh);
          const [x1, y1] = [await slice(a, top, y - top, ma.w, h), await slice(b, top, y - top, ma.w, h)];
          const d = new PNG({width: ma.w, height: h});
          const n = match(x1, y1, ma.w, h, d);
          if (n) { differing += n; bands.push({y, h, png: d}); }
        }
        pixels[key] = {differing, of: ma.w * ma.h, slices: Math.ceil(ma.h / vh), bands: bands.map(x => x.y)};
        if (bands.length) {
          /* Only the slices that differ are written, stacked, each labelled by
             the scroll position it was read at in the result. */
          const out = new PNG({width: ma.w, height: bands.reduce((n, x) => n + x.h, 0)});
          let at = 0;
          for (const band of bands) { band.png.bitblt(out, 0, 0, ma.w, band.h, 0, at); at += band.h; }
          writeFileSync(path.join(root, `.brief-${key.replace(/\W/g, '_')}.png`), PNG.sync.write(out));
        }
      }
    } catch (e) { pixels[key] = {error: String(e.message).slice(0, 60)}; }
    finally { if (a) await a.close().catch(() => {}); if (b) await b.close().catch(() => {}); }
  }
  await browser.close(); server.close(); rmSync(base, {recursive: true, force: true});
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
  else console.log(`  ${pad('PIXELS MOVED', 18)}${moved.length ? moved.map(([r, v]) => `${r} ${v.size ? `size ${v.size.slice(0,2).join('x')} → ${v.size.slice(2).join('x')}` : v.differing + ' px'}`).join('\n' + ' '.repeat(20)) : `none across ${ROUTES.length} routes at ${WIDTHS.join(' and ')}`}`);
  console.log('');
  if (broken.length) { console.log(`  BROKEN: ${broken.map(b => b.gate).join(', ')}\n`); for (const b of broken) console.log(b.out.trim().split('\n').slice(-4).map(l => '    ' + l).join('\n')); }
  else console.log(`  ${GATES.length} gates green`);
  console.log('  ' + '─'.repeat(58));
  console.log(broken.length ? '  BROKEN — nothing to ask about yet\n'
    : flagged ? '  GREEN LIGHT REQUIRED — nothing has been pushed\n'
    : '  CLEAR — no vocabulary, no governed file, no pixel moved\n');
}
process.exit(broken.length ? 1 : flagged ? 10 : 0);
