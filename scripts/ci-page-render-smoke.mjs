/* Renders the standalone UI Library page locally and asserts every component's
   computed material. No deployment, no secrets, no preview URL — so it can gate
   the deploy rather than report after it.

   This exists because the structural gates cannot see a broken page. They check
   blur and fill on elements that have them; they cannot tell that a class has no
   CSS behind it, that a <table> carries no class at all, or that the atmosphere
   is a still image because the bootstrap runtime was imported instead of the
   full one. Every one of those shipped at least once.

   Usage: node scripts/ci-page-render-smoke.mjs
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'site';
const CARD = { bg: 'rgba(46, 39, 59, 0.3)', filter: 'blur(18px) saturate(1.18)' };
const OVERLAY = { bg: 'rgba(38, 32, 49, 0.72)', filter: 'blur(18px) saturate(1.18)' };
const WELL = { bg: 'rgba(250, 247, 245, 0.055)', filter: 'none' };
// The sticky column carries the same weight as every other glass surface.
const STICKY = CARD;
const BARE = { bg: 'rgba(0, 0, 0, 0)', filter: 'none' };

const EXPECT = [
  ['.app-card', CARD], ['.app-action-card', CARD], ['.app-surface', CARD],
  ['.app-disclosure', CARD], ['.app-primary', CARD], ['.app-chip', CARD],
  ['.app-select-trigger', CARD], ['.app-overlay', OVERLAY],
  ['.app-field input', WELL], ['.app-table tbody th', STICKY],
  ['.app-select-option', BARE],
  ['.app-utility-action', BARE], ['.app-action-card-button', BARE],
  // Centralized layout and state modules: every page consumes these, so a
  // regression here breaks every page rather than one.
  ['.app-state', CARD], ['.app-skeleton-line', WELL],
  ['.app-hero', BARE], ['.app-section', BARE], ['.app-page', BARE]
];

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/ci') p = '/ci.html';
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, resolve));
const port = server.address().port;

const { chromium } = await import('playwright');
let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }

const failures = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', error => failures.push(`page error: ${error.message}`));
await page.goto(`http://127.0.0.1:${port}/ci`, { waitUntil: 'load' });
await page.waitForSelector('.app-page');
await page.waitForTimeout(3500);

const report = await page.evaluate(expect => {
  const read = selector => {
    const node = document.querySelector(selector);
    if (!node) return { selector, missing: true };
    const style = getComputedStyle(node);
    return { selector, bg: style.backgroundColor, filter: String(style.backdropFilter || style.webkitBackdropFilter || 'none'), border: style.borderTopWidth+' '+style.borderTopStyle };
  };
  const canvas = document.getElementById('environmentCanvas');
  return {
    sections: document.querySelectorAll('.app-section').length,
    specimens: document.querySelectorAll('.ci-specimen').length,
    measured: expect.map(([selector]) => read(selector)),
    // A frame around a specimen would make it glass inside glass.
    specimenPainted: getComputedStyle(document.querySelector('.ci-specimen')).backgroundColor,
    // The full WebGL runtime sizes this. The bootstrap preview leaves it 300x150.
    canvas: canvas ? `${canvas.width}x${canvas.height}` : 'none',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
}, EXPECT);

const norm = value => String(value).replace(/\s+/g, ' ').trim();
for (const [selector, want] of EXPECT) {
  const got = report.measured.find(entry => entry.selector === selector);
  if (got.missing) { failures.push(`${selector}: not present on the page`); continue; }
  if (norm(got.bg) !== norm(want.bg)) failures.push(`${selector}: fill ${got.bg}, expected ${want.bg}`);
  if (norm(got.filter) !== norm(want.filter)) failures.push(`${selector}: filter ${got.filter}, expected ${want.filter}`);
}
if (report.sections < 14) failures.push(`only ${report.sections} sections rendered`);
if (report.specimens < 12) failures.push(`only ${report.specimens} specimens rendered`);
if (report.specimenPainted !== 'rgba(0, 0, 0, 0)') failures.push(`specimen rows must stay unpainted, got ${report.specimenPainted}`);
if (report.canvas === '300x150') failures.push('atmosphere is the bootstrap preview, not the full runtime — import betta-runtime-full.js');
if (report.canvas === 'none') failures.push('no atmosphere canvas on the page');
const sticky=report.measured.find(e=>e.selector==='.app-table tbody th');
if (sticky && !sticky.border.startsWith('0px')) failures.push(`sticky column must not be boxed on four sides, border is ${sticky.border}`);
const overlay=report.measured.find(e=>e.selector==='.app-overlay');
if (overlay && overlay.border.startsWith('0px')) failures.push('.app-overlay lost its edge');
if (report.overflow > 1) failures.push(`horizontal overflow ${report.overflow}px`);

await browser.close();
server.close();

if (failures.length) {
  console.error('UI Library page render FAILED:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, sections: report.sections, specimens: report.specimens, canvas: report.canvas, components: EXPECT.length }));
