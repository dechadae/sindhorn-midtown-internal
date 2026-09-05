#!/usr/bin/env node
/* Renders the two evidence pages in a real browser and records what the core
   resolved under each constitution: the same selectors, the computed values
   side by side, plus the structural checks the app's own gates make (no CSS
   in the page, no glass inside glass). Writes measurements.json and one
   full-page screenshot per constitution next to this file.

   node idui-core/evidence/transfer-smoke.mjs        (run from the repository)
   --shots <dir>   also write one JPEG per section and constitution there, for
                   a side-by-side report; not kept in the repository

   Serves the repository root so the Sindhorn constitution's /assets/fonts
   resolve to site/assets/fonts; the core does not carry the font files, and
   that is one of the findings. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PAGES = ['sindhorn', 'flipgazine'];
const shotsDir = process.argv.includes('--shots') ? path.resolve(process.argv[process.argv.indexOf('--shots') + 1]) : '';
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

for (const key of PAGES) {
  const html = fs.readFileSync(path.join(HERE, `${key}.html`), 'utf8');
  if (/<style[\s>]/.test(html) || /\sstyle=/.test(html)) { console.error(`${key}.html declares CSS`); process.exit(1); }
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  if (links.length !== 6 || !links[5].endsWith('/app-tokens.css')) { console.error(`${key}.html: expected the six core links with tokens last, got ${links.join(' ')}`); process.exit(1); }
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/assets/')) p = '/site' + p;
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import('playwright');
let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }

const PROBES = {
  'body': ['background-color', 'font-family', 'font-weight', 'font-size', 'line-height', 'color'],
  '.environment-stage': ['background-color'],
  '.app-masthead': ['background-color', 'backdrop-filter', 'border-bottom-color', 'min-height'],
  '.app-hero-title': ['font-size', 'font-weight', 'letter-spacing', 'line-height'],
  '.app-hero-eyebrow': ['font-size', 'letter-spacing', 'color', 'text-transform'],
  '.app-section-title': ['font-size', 'font-weight'],
  '.app-section-kicker': ['letter-spacing', 'color'],
  '.app-surface': ['background-color', 'backdrop-filter', 'border-color', 'border-radius'],
  '.app-action-card': ['border-radius'],
  '.app-action-card-title': ['color', 'font-weight'],
  '.app-primary': ['background-color', 'color', 'border-radius', 'font-weight', 'font-size', 'letter-spacing'],
  '.app-utility-action': ['color', 'background-color', 'border-radius', 'font-size'],
  '.app-chip.is-active': ['background-color', 'color', 'border-radius'],
  '.app-field input': ['background-color', 'border-radius', 'border-color'],
  '.app-check-box': ['border-radius', 'width'],
  '.app-badge': ['background-color', 'color', 'border-radius'],
  '.app-badge[data-tone="success"]': ['background-color', 'color'],
  '.app-badge[data-tone="danger"]': ['background-color', 'color'],
  '.app-state[data-tone="error"] .app-state-label': ['color'],
  '.app-list-row + .app-list-row': ['border-top-color'],
  '.app-metric-value': ['font-size', 'font-weight', 'font-variant-numeric'],
  '.app-table th': ['font-size', 'letter-spacing'],
  '.app-skeleton-line': ['background-color', 'border-radius'],
  '.app-utility-row': ['gap'],
  '.app-stack': ['gap']
};

const measurements = {};
for (const key of PAGES) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await context.newPage();
  const failures = [];
  page.on('requestfailed', r => failures.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${origin}/idui-core/evidence/${key}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate(({ PROBES }) => {
    const out = { computed: {}, controls: {}, fonts: [], nestedGlass: 0, glassCount: 0, tokens: {} };
    for (const [sel, props] of Object.entries(PROBES)) {
      const el = document.querySelector(sel); if (!el) { out.computed[sel] = null; continue; }
      const cs = getComputedStyle(el); out.computed[sel] = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
    }
    for (const sel of ['.app-primary', '.app-utility-action', '.app-chip', '.app-list-row', '.app-back-control', '.app-field input']) {
      const el = document.querySelector(sel); out.controls[sel] = el ? Math.round(el.getBoundingClientRect().height) : null;
    }
    for (const f of document.fonts) if (f.status === 'loaded') out.fonts.push(`${f.family} ${f.weight}`);
    out.fonts = [...new Set(out.fonts)].sort();
    const glass = el => { const v = getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter; return v && v !== 'none'; };
    for (const el of document.querySelectorAll('body *')) {
      if (!glass(el)) continue; out.glassCount++;
      let p = el.parentElement; while (p && p !== document.body) { if (glass(p)) { out.nestedGlass++; break; } p = p.parentElement; }
    }
    const rs = getComputedStyle(document.documentElement);
    for (const t of ['--font-ui', '--tracking', '--space-4', '--type-micro', '--motion-fade', '--app-accent', '--radius-pill', '--weight-bold']) out.tokens[t] = rs.getPropertyValue(t).trim();
    out.fontsUsed = [...new Set([...document.querySelectorAll('h1,h2,p,button,input,td,th,span')].map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))];
    out.weightsUsed = [...new Set([...document.querySelectorAll('h1,h2,p,button,input,td,th,span,label,b')].map(e => getComputedStyle(e).fontWeight))].sort();
    out.docHeight = document.documentElement.scrollHeight;
    return out;
  }, { PROBES });
  data.failedRequests = failures;
  measurements[key] = data;
  await page.screenshot({ path: path.join(HERE, `${key}.png`) });
  if (shotsDir) {
    /* The atmosphere is position:fixed at one viewport height, so a
       full-page capture would show the shell ground below the fold. Each
       section is captured on its own inside a taller viewport instead. */
    await page.setViewportSize({ width: 390, height: 1200 });
    for (const id of await page.$$eval('main > section[id]', els => els.map(e => e.id))) {
      const height = await page.evaluate(id => { const el = document.getElementById(id); const top = el.getBoundingClientRect().top + window.scrollY; window.scrollTo(0, top - 72); return Math.min(1128, Math.ceil(el.getBoundingClientRect().height) + 16); }, id);
      await page.screenshot({ path: path.join(shotsDir, `${key}-${id}.jpg`), type: 'jpeg', quality: 82, clip: { x: 0, y: 64, width: 390, height } });
    }
  }
  await context.close();
}
await browser.close();
server.close();

const diff = {};
for (const sel of Object.keys(PROBES)) {
  const a = measurements.sindhorn.computed[sel], b = measurements.flipgazine.computed[sel];
  if (!a || !b) { diff[sel] = a === b ? 'missing in both' : 'missing in one'; continue; }
  for (const p of PROBES[sel]) if (a[p] !== b[p]) (diff[sel] ||= {})[p] = [a[p], b[p]];
}
const ok = PAGES.every(k => measurements[k].nestedGlass === 0 && measurements[k].failedRequests.length === 0);
fs.writeFileSync(path.join(HERE, 'measurements.json'), JSON.stringify({ ok, measuredAt: new Date().toISOString(), pages: measurements, diff }, null, 2) + '\n');
console.log(JSON.stringify({ ok, nestedGlass: Object.fromEntries(PAGES.map(k => [k, measurements[k].nestedGlass])), glass: Object.fromEntries(PAGES.map(k => [k, measurements[k].glassCount])), fonts: Object.fromEntries(PAGES.map(k => [k, measurements[k].fontsUsed])), failed: Object.fromEntries(PAGES.map(k => [k, measurements[k].failedRequests])), changed: Object.keys(diff).length }));
process.exit(ok ? 0 : 1);
