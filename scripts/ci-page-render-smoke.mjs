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
// A done job's badge: the success tone's own tint, nested in the card, no blur.
const BADGE_SUCCESS_NESTED = { bg: 'color(srgb 0.447059 0.654902 0.364706 / 0.18)', filter: 'none' };
// The unread count on the masthead's Messages control: accent tint, no
// blur, because the masthead under it is already glass.
const BADGE_ON_MASTHEAD = { bg: 'rgba(229, 236, 190, 0.16)', filter: 'none' };
// A control inside the glass masthead: card tint, no blur, same rule.
const CONTROL_ON_MASTHEAD = { bg: 'rgba(46, 39, 59, 0.3)', filter: 'none' };
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
  // Shell chrome added with sign-in: the logo is Home and frameless, the
  // account chip and the Messages icon are controls on the masthead, the
  // navbar sets are layout, the unread count is a badge on the masthead, and
  // a code well is a field well.
  ['.app-masthead-home', BARE], ['.app-masthead-account', CONTROL_ON_MASTHEAD], ['.app-masthead-action', CONTROL_ON_MASTHEAD], ['.app-masthead-tools', BARE], ['.app-navbar-set', BARE],
  ['.app-masthead-badge', BADGE_ON_MASTHEAD], ['.app-code input', FROSTED_WELL], ['.app-navbar[data-locked]', CARD],
  ['.app-sheet', OVERLAY], ['.app-toast', OVERLAY],
  ['.app-list-row', BARE], ['.app-metric', BARE], ['.app-figure', BARE],
  ['.app-card-section', BARE], ['.app-section-subhead', BARE],
  ['.app-track', BARE],
  ['.app-rail', BARE], ['.app-clamp', BARE],
  ['.app-action-card-meta', BARE], ['.app-action-card-actions', BARE], ['.app-hero-head', BARE], ['.app-utility-row', BARE], ['.app-action-card-when', BARE], ['.app-disclosure-end', BARE], ['.app-section-kicker-end', BARE], ['.app-metric-grid[data-columns="3"]', BARE],
  ['.app-check-box', BARE],
  // A job is a layout inside a plain card, like the business card.
  ['.app-job', BARE], ['.app-job-head', BARE], ['.app-job-deadline', BARE], ['.app-job-section', BARE], ['#job .app-badge[data-tone="success"]', BADGE_SUCCESS_NESTED],
  // The status control is a badge grown to a control (r23): it keeps the
  // badge's tint and, nested in the card, drops the blur like any badge.
  ['#job .app-select[data-compact="true"] .app-select-trigger:not([data-tone])', { bg: BADGE.bg, filter: 'none' }], ['#job .app-select[data-compact="true"] .app-select-trigger[data-tone="quiet"]', BADGE_NESTED],
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
  ['.app-masthead-account', `${FAST}, ${SETTLE}`, `${EASE}, ${LINEAR}`],
  ['.app-masthead-action', `${FAST}, ${SETTLE}`, `${EASE}, ${LINEAR}`],
  ['.app-navbar-set', `${SETTLE}, 0s`, 'ease-in-out, linear'],
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
  const smallText = ['.app-metric-label','.app-metric-delta','.app-metric-note','.app-list-row-meta','.app-list-row-end','.app-surface-label','.app-section-kicker','.app-disclosure-kicker','.app-disclosure-copy','.app-note','.app-field label','.app-field-note','.app-select-label','.app-dialog-kicker','.app-table','.app-table thead th','.app-state-label','.app-state-copy','.app-figure figcaption','.app-action-card-status','.app-action-card-date','.app-action-card-meta','.app-badge','.app-job-kicker','.app-job-copy']
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
if (report.sections < 23) failures.push(`only ${report.sections} sections rendered`);
if (report.specimens < 50) failures.push(`only ${report.specimens} specimens rendered`);
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

// View transitions: tap F&B in the specimen frame and read the host mid-move.
// The host must be running the push-in keyframes over --motion-view on the
// plain ease-in-out curve, and may not carry opacity, filter or clip-path -
// any of those on an ancestor switches the glass beneath off. Only the
// incoming page moves: there is no ghost of the outgoing one.
// The movement is read while it runs, so the specimen frame is slowed for the
// tap (a test-only sheet - the token itself is asserted at its real value);
// a CI runner otherwise finishes the 300ms before the read lands.
const VIEW = '300ms', TRAVEL = '32px';
const view = await (async () => {
  const frame = page.locator('[data-view-demo]');
  if (!(await frame.count())) return null;
  const token = await page.evaluate(() => ({ view: getComputedStyle(document.documentElement).getPropertyValue('--motion-view').trim(), travel: getComputedStyle(document.documentElement).getPropertyValue('--motion-view-travel').trim() }));
  await page.addStyleTag({ content: '[data-view-demo]{--motion-view:8s}' });
  await frame.locator('[data-demo-route="fnb"]').click();
  await page.waitForFunction(() => document.querySelector('[data-view-demo] > [data-view-host][data-run]'), null, { timeout: 2000 }).catch(() => {});
  return page.evaluate(() => {
    const host = document.querySelector('[data-view-demo] > [data-view-host]');
    const read = node => { if (!node) return null; const s = getComputedStyle(node); return { name: s.animationName, duration: s.animationDuration, timing: s.animationTimingFunction, play: s.animationPlayState, visibility: s.visibility, opacity: s.opacity, filter: s.filter, clip: s.clipPath, transform: s.transform }; };
    return { kind: host?.dataset.view, host: read(host), ghost: !!document.querySelector('.app-view-ghost'), title: host?.querySelector('.app-hero-title')?.textContent };
  }).then(result => ({ ...result, token }));
})();
if (!view) failures.push('[data-view-demo]: view-transition specimen missing');
else {
  if (view.kind !== 'push') failures.push(`view transition: Today → F&B should push, host has data-view="${view.kind}"`);
  if (view.title !== 'Promotions') failures.push(`view transition: the new page should be mounted before the movement runs, host shows "${view.title}"`);
  if (view.token.view !== VIEW) failures.push(`--motion-view is ${view.token.view}, expected ${VIEW}`);
  if (view.token.travel !== TRAVEL) failures.push(`--motion-view-travel is ${view.token.travel}, expected ${TRAVEL}`);
  if (view.ghost) failures.push('view transition: a ghost of the outgoing page was built; only the incoming page moves now');
  const style = view.host;
  if (!style || style.name !== 'app-view-push-in') failures.push(`view transition: host animation ${style?.name}, expected app-view-push-in`);
  if (style) {
    if (norm(style.duration) !== '8s') failures.push(`view transition: host animation-duration ${style.duration} does not follow --motion-view`);
    if (norm(style.timing) !== 'ease-in-out') failures.push(`view transition: host animation-timing-function ${style.timing}, expected ease-in-out`);
    if (style.play !== 'running') failures.push(`view transition: host animation is ${style.play}, expected running`);
    if (style.visibility !== 'visible') failures.push(`view transition: host is ${style.visibility} while running, expected visible`);
    if (style.opacity !== '1' || style.filter !== 'none' || style.clip !== 'none') failures.push(`view transition: host must move by transform only (opacity ${style.opacity}, filter ${style.filter}, clip-path ${style.clip})`);
    if (!/^matrix\(1, 0, 0, 1, /.test(style.transform)) failures.push(`view transition: host should be translating, not scaling (${style.transform})`);
  }
  await page.waitForFunction(() => !document.querySelector('[data-view-demo] > [data-view-host][data-view]'), null, { timeout: 12000 })
    .catch(() => failures.push('view transition: data-view left behind after the movement ended'));
}

// The confirm dialog builds the Dialog Standard from code: overlay material,
// danger ink on the confirm, Cancel focused, and nothing left behind on close.
const confirm = await (async () => {
  const open = page.locator('[data-confirm-open]');
  if (!(await open.count())) return null;
  await open.click();
  await page.waitForSelector('dialog[data-confirm][open]', { timeout: 2000 }).catch(() => {});
  const shown = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-confirm]');
    if (!dialog) return null;
    const s = getComputedStyle(dialog), confirmButton = dialog.querySelector('[data-dialog-confirm]');
    return { open: dialog.open, bg: s.backgroundColor, filter: String(s.backdropFilter || s.webkitBackdropFilter || 'none'), title: dialog.querySelector('.app-dialog-title')?.textContent, confirmColor: confirmButton && getComputedStyle(confirmButton).color, focusedCancel: document.activeElement === dialog.querySelector('[data-dialog-cancel]') };
  });
  await page.locator('dialog[data-confirm] [data-dialog-cancel]').click().catch(() => {});
  // close fires as a queued task after close(); give it one turn.
  await page.waitForFunction(() => !document.querySelector('dialog[data-confirm]'), null, { timeout: 2000 }).catch(() => {});
  const after = await page.evaluate(() => ({ remaining: document.querySelectorAll('dialog[data-confirm]').length, note: document.querySelector('[data-confirm-result]')?.textContent || '' }));
  return { shown, after };
})();
if (!confirm) failures.push('[data-confirm-open]: confirm specimen missing');
else if (!confirm.shown) failures.push('confirmDialog(): no dialog was built');
else {
  const { shown, after } = confirm;
  if (!shown.open) failures.push('confirmDialog(): dialog built but not open');
  if (norm(shown.bg) !== norm(OVERLAY.bg) || norm(shown.filter) !== norm(OVERLAY.filter)) failures.push(`confirmDialog(): material ${shown.bg} / ${shown.filter}, expected the overlay`);
  if (shown.title !== 'Sign out of this device?') failures.push(`confirmDialog(): title "${shown.title}"`);
  if (norm(shown.confirmColor) !== 'rgb(227, 162, 168)') failures.push(`confirmDialog(): danger confirm is ${shown.confirmColor}, expected --app-danger`);
  if (!shown.focusedCancel) failures.push('confirmDialog(): Cancel should hold focus when the dialog opens');
  if (after.remaining !== 0) failures.push(`confirmDialog(): ${after.remaining} dialog(s) left in the document after close`);
  if (!/^Cancelled/.test(after.note)) failures.push(`confirmDialog(): cancel should resolve false, note reads "${after.note}"`);
}

await browser.close();
server.close();

if (failures.length) {
  console.error('UI Library page render FAILED:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, sections: report.sections, specimens: report.specimens, canvas: report.canvas, components: EXPECT.length }));
