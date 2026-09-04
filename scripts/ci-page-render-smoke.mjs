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
// A skeleton line is a placeholder, not a surface — no edge, so no blur.
const WELL = { bg: 'rgba(250, 247, 245, 0.055)', filter: 'none' };
// A form well draws an edge too, so it frosts like everything else — it just
// keeps its own quieter tint instead of the card's fill.
const FROSTED_WELL = { bg: 'rgba(250, 247, 245, 0.055)', filter: 'blur(18px) saturate(1.18)' };
// A badge's fill is its own tint, not the card's — same reasoning. Two tones,
// same blur.
const BADGE = { bg: 'rgba(229, 236, 190, 0.16)', filter: 'blur(18px) saturate(1.18)' };
const BADGE_QUIET = { bg: 'rgba(250, 247, 245, 0.055)', filter: 'blur(18px) saturate(1.18)' };
// A badge nested inside a card is glass inside glass - it must keep the tint
// and drop the blur, same as any other nested surface.
const BADGE_NESTED = { bg: 'rgba(250, 247, 245, 0.055)', filter: 'none' };
// The sticky column carries the same weight as every other glass surface.
const STICKY = CARD;
const BARE = { bg: 'rgba(0, 0, 0, 0)', filter: 'none' };

const EXPECT = [
  ['.app-card', CARD], ['.app-action-card', CARD], ['.app-surface', CARD],
  ['.app-disclosure', CARD], ['.app-primary', CARD], ['.app-chip', CARD],
  ['.app-select-trigger', CARD], ['.app-overlay', OVERLAY],
  ['.app-field input', FROSTED_WELL], ['.app-table tbody th', STICKY],
  ['.app-select-option', BARE],
  ['.app-utility-action', BARE], ['.app-action-card-button', BARE],
  // Centralized layout and state modules: every page consumes these, so a
  // regression here breaks every page rather than one.
  ['.app-state', CARD], ['.app-skeleton-line', WELL],
  ['.app-hero', BARE], ['.app-section', BARE], ['.app-page', BARE],
  // The public app shell (masthead, navbar) and the modules added while
  // finalizing the library: same rule either way — an edge takes the
  // material, a layout container takes nothing.
  ['.app-back-control', CARD], ['.app-masthead', CARD], ['.app-navbar', CARD],
  ['.app-sheet', OVERLAY], ['.app-toast', OVERLAY],
  ['.app-list-row', BARE], ['.app-metric', BARE], ['.app-figure', BARE],
  ['.app-card-section', BARE], ['.app-section-subhead', BARE],
  ['.app-track', BARE],
  ['.app-rail', BARE], ['.app-clamp', BARE],
  ['.app-action-card-meta', BARE], ['.app-action-card-actions', BARE], ['.app-hero-head', BARE], ['.app-utility-row', BARE], ['.app-action-card-when', BARE], ['.app-disclosure-end', BARE], ['.app-section-kicker-end', BARE], ['.app-metric-grid[data-columns="3"]', BARE],
  ['.app-check-box', BARE],
  // Scoped to the Badge section itself: the List section also uses a quiet
  // badge, nested inside .app-card, where it correctly renders with no blur.
  ['#badge .app-badge:not([data-tone])', BADGE], ['#badge .app-badge[data-tone="quiet"]', BADGE_QUIET],
  ['#list .app-badge', BADGE_NESTED],
  // The section-jump nav at the top of the page draws a real border for a
  // real link, so it takes the material like anything else that does.
  ['.ci-index a', CARD]
];

// Two durations, one easing, documented live in 04 Shape & Motion. A route
// that invents its own value drifts silently — this reads what the browser
// actually computed, not what a comment claims app-components.css declares.
// getComputedStyle normalizes ms to s.
const FAST = '0.16s', SETTLE = '0.28s', EASE = 'cubic-bezier(0.22, 1, 0.36, 1)', LINEAR = 'ease';
const REVEAL = '0.92s';
const MOTION = [
  ['.app-track-bar', REVEAL, EASE],
  ['.app-primary', `${FAST}, ${SETTLE}, ${SETTLE}`, `${EASE}, ${LINEAR}, ${LINEAR}`],
  ['.app-chip', `${SETTLE}, ${SETTLE}, ${FAST}`, `${LINEAR}, ${LINEAR}, ${EASE}`],
  ['.app-back-control', `${FAST}, ${SETTLE}`, `${EASE}, ${LINEAR}`],
  ['.app-navbar-button', `${SETTLE}, ${FAST}`, `${LINEAR}, ${EASE}`],
  ['.app-disclosure-chevron', SETTLE, EASE],
  ['.app-disclosure-panel', SETTLE, EASE],
  ['.app-select-trigger svg', FAST, EASE]
];
const SKELETON_ANIMATION = { name: 'app-skeleton-pulse', duration: '1.4s', timing: EASE, iteration: 'infinite' };

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

const report = await page.evaluate(([expect, motionSelectors]) => {
  const read = selector => {
    const node = document.querySelector(selector);
    if (!node) return { selector, missing: true };
    const style = getComputedStyle(node);
    return { selector, bg: style.backgroundColor, filter: String(style.backdropFilter || style.webkitBackdropFilter || 'none'), border: style.borderTopWidth+' '+style.borderTopStyle, borderColor: style.borderTopColor };
  };
  const readMotion = selector => {
    const node = document.querySelector(selector);
    if (!node) return { selector, missing: true };
    const style = getComputedStyle(node);
    return { selector, duration: style.transitionDuration, timing: style.transitionTimingFunction };
  };
  // Secondary text has to stay legible on a phone: every muted label, delta,
  // meta and note in the library must sit at or above this floor.
  const smallText = ['.app-metric-label','.app-metric-delta','.app-metric-note','.app-list-row-meta','.app-list-row-end','.app-surface-label','.app-section-kicker','.app-disclosure-kicker','.app-disclosure-copy','.app-note','.app-field label','.app-field-note','.app-select-label','.app-dialog-kicker','.app-table','.app-table thead th','.app-state-label','.app-state-copy','.app-figure figcaption','.app-action-card-status','.app-action-card-date','.app-action-card-meta','.app-badge']
    .map(selector => { const node = document.querySelector(selector); return { selector, size: node ? parseFloat(getComputedStyle(node).fontSize) : null }; });
  const trackDrawn = (() => { const bar = document.querySelector('.app-track-bar'); if (!bar) return null; const m = new DOMMatrix(getComputedStyle(bar).transform); return { ready: document.querySelector('.app-page').dataset.trackReady === 'true', scaleX: m.a }; })();
  const sectionDivider = (() => { const node = document.querySelector('.app-card-section+.app-card-section'); if (!node) return null; const style = getComputedStyle(node); return { border: `${style.borderTopWidth} ${style.borderTopStyle}`, color: style.borderTopColor }; })();
  const skeleton = document.querySelector('.app-skeleton-line');
  const skeletonStyle = skeleton && getComputedStyle(skeleton);
  const canvas = document.getElementById('environmentCanvas');
  return {
    sections: document.querySelectorAll('.app-section').length,
    specimens: document.querySelectorAll('.ci-specimen').length,
    measured: expect.map(([selector]) => read(selector)),
    motion: motionSelectors.map(([selector]) => readMotion(selector)),
    smallText, sectionDivider, trackDrawn,
    skeletonAnimation: skeletonStyle ? { name: skeletonStyle.animationName, duration: skeletonStyle.animationDuration, timing: skeletonStyle.animationTimingFunction, iteration: skeletonStyle.animationIterationCount } : null,
    // A frame around a specimen would make it glass inside glass.
    specimenPainted: getComputedStyle(document.querySelector('.ci-specimen')).backgroundColor,
    // The full WebGL runtime sizes this. The bootstrap preview leaves it 300x150.
    canvas: canvas ? `${canvas.width}x${canvas.height}` : 'none',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
}, [EXPECT, MOTION]);

const norm = value => String(value).replace(/\s+/g, ' ').trim();
for (const [selector, want] of EXPECT) {
  const got = report.measured.find(entry => entry.selector === selector);
  if (got.missing) { failures.push(`${selector}: not present on the page`); continue; }
  if (norm(got.bg) !== norm(want.bg)) failures.push(`${selector}: fill ${got.bg}, expected ${want.bg}`);
  if (norm(got.filter) !== norm(want.filter)) failures.push(`${selector}: filter ${got.filter}, expected ${want.filter}`);
}
for (const [selector, duration, timing] of MOTION) {
  const got = report.motion.find(entry => entry.selector === selector);
  if (!got || got.missing) { failures.push(`${selector}: not present on the page for the motion check`); continue; }
  if (norm(got.duration) !== norm(duration)) failures.push(`${selector}: transition-duration ${got.duration}, expected ${duration}`);
  if (norm(got.timing) !== norm(timing)) failures.push(`${selector}: transition-timing-function ${got.timing}, expected ${timing}`);
}
if (!report.skeletonAnimation) failures.push('.app-skeleton-line: not present for the animation check');
else {
  const { name, duration, timing, iteration } = report.skeletonAnimation;
  if (name !== SKELETON_ANIMATION.name) failures.push(`.app-skeleton-line: animation-name ${name}, expected ${SKELETON_ANIMATION.name}`);
  if (duration !== SKELETON_ANIMATION.duration) failures.push(`.app-skeleton-line: animation-duration ${duration}, expected ${SKELETON_ANIMATION.duration}`);
  if (norm(timing) !== norm(SKELETON_ANIMATION.timing)) failures.push(`.app-skeleton-line: animation-timing-function ${timing}, expected ${SKELETON_ANIMATION.timing}`);
  if (iteration !== SKELETON_ANIMATION.iteration) failures.push(`.app-skeleton-line: animation-iteration-count ${iteration}, expected ${SKELETON_ANIMATION.iteration}`);
}
for (const { selector, size } of report.smallText) {
  if (size === null) failures.push(`${selector}: not present on the page for the type-floor check`);
  else if (size < 11) failures.push(`${selector}: font-size ${size}px is below the 11px floor for secondary text`);
}
if (!report.trackDrawn) failures.push('.app-track-bar: not present on the page');
else if (!report.trackDrawn.ready || report.trackDrawn.scaleX < 0.99) failures.push(`.app-track-bar: not drawn in after ready (ready=${report.trackDrawn.ready}, scaleX=${report.trackDrawn.scaleX})`);
if (!report.sectionDivider) failures.push('.app-card-section+.app-card-section: not present on the page');
else if (report.sectionDivider.border !== '1px solid' || norm(report.sectionDivider.color) !== 'rgba(250, 247, 245, 0.09)') failures.push(`.app-card-section: divider ${report.sectionDivider.border} ${report.sectionDivider.color}, expected 1px solid --app-line`);
if (report.sections < 20) failures.push(`only ${report.sections} sections rendered`);
if (report.specimens < 24) failures.push(`only ${report.specimens} specimens rendered`);
if (report.specimenPainted !== 'rgba(0, 0, 0, 0)') failures.push(`specimen rows must stay unpainted, got ${report.specimenPainted}`);
if (report.canvas === '300x150') failures.push('atmosphere is the bootstrap preview, not the full runtime — import betta-runtime-full.js');
if (report.canvas === 'none') failures.push('no atmosphere canvas on the page');
const sticky=report.measured.find(e=>e.selector==='.app-table tbody th');
if (sticky && !sticky.border.startsWith('0px')) failures.push(`sticky column must not be boxed on four sides, border is ${sticky.border}`);
const overlay=report.measured.find(e=>e.selector==='.app-overlay');
if (overlay && overlay.border.startsWith('0px')) failures.push('.app-overlay lost its edge');
// .app-chip used to declare its own border, which silently won the cascade
// over .app-control's glass-border token and left the edge almost invisible.
const chip=report.measured.find(e=>e.selector==='.app-chip');
if (chip && norm(chip.borderColor) !== 'rgba(250, 247, 245, 0.14)') failures.push(`.app-chip: border-color ${chip.borderColor}, expected the glass border token rgba(250, 247, 245, 0.14) from .app-control`);
if (report.overflow > 1) failures.push(`horizontal overflow ${report.overflow}px`);

await browser.close();
server.close();

if (failures.length) {
  console.error('UI Library page render FAILED:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, sections: report.sections, specimens: report.specimens, canvas: report.canvas, components: EXPECT.length }));
