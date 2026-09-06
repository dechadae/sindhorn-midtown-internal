/* Test 02.2 — the same hundred papers, both implementations.

   Contracts are checked, never repaired. Neither page is touched during the
   run: the question is how many of a hundred render correctly when nobody
   intervenes, which is the only comparison that is symmetric — the original
   belongs to another application and cannot be repaired here at all.

     node idui-core/evidence/origarium/scale/measure.mjs      # from the repo root */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {discretionary, semantic} from '../../metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const papers = JSON.parse(await readFile(path.join(here, 'papers-100.json'), 'utf8'));
const VIEWPORTS = [{name: '390', width: 390, height: 844}, {name: '1240', width: 1240, height: 900}];

const types = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json'};
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = name === '/papers' ? path.join(repo, 'idui-core/evidence/origarium/source/papers.html') : path.join(repo, name);
  try { const body = await readFile(file); res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'}); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));

/* Every contract is a property of the rendered result, not an opinion. */
const CONTRACTS = `([cardSel, thumbSel]) => {
  const out = [];
  const cards = [...document.querySelectorAll(cardSel)];
  const docWidth = document.documentElement.clientWidth;
  for (const [i, card] of cards.entries()) {
    const box = card.getBoundingClientRect();
    const fail = reason => out.push({index: i, reason});
    if (box.width < 8 || box.height < 8) fail('collapsed');
    if (box.right > docWidth + 1 || box.left < -1) fail('overflows the viewport');
    const thumb = card.querySelector(thumbSel);
    if (!thumb) fail('no document preview');
    else {
      const t = thumb.getBoundingClientRect();
      if (t.width < 8 || t.height < 8) fail('preview collapsed');
      if (t.width > box.width + 1) fail('preview wider than its card');
      const ratio = t.width / t.height;
      if (Math.abs(ratio - 0.7071) > 0.02) fail('preview is not a page (' + ratio.toFixed(3) + ')');
    }
    /* text that leaves its own box, which is what long titles do */
    for (const el of card.querySelectorAll('h3,h2,p,span')) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible') { fail('text overflows: ' + el.tagName.toLowerCase()); break; }
    }
  }
  /* rows must stay equal: peers laid side by side are the same width */
  const widths = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().width)))];
  return {failures: out, cards: cards.length, distinctCardWidths: widths.length,
    distinctPreviewSizes: [...new Set(cards.map(c => { const t = c.querySelector(thumbSel); if (!t) return 'none';
      const b = t.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); }))].length};
}`;

async function run(label, {url, route, cardSel, thumbSel, openSel, readerReady, closeSel}) {
  const result = {label, viewports: {}, reader: {}};
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    /* The rebuild reads its papers from a file rather than from Supabase, so
       the hundred are routed there too. Neither page is edited for this run:
       the reconstruction under test is byte-identical to the one being
       judged, and only what it is fed differs. */
    await context.route('**/papers.fixture.json', r =>
      r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(papers)}));
    await context.route('**://*.supabase.co/**', r => {
      if (r.request().method() !== 'GET') return r.abort();
      if (/\/papers\?/.test(r.request().url())) return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(papers)});
      return r.fulfill({status: 200, contentType: 'application/json', body: '[]'});
    });
    const started = Date.now();
    await page.goto(url, {waitUntil: 'networkidle'});
    await page.waitForFunction(sel => document.querySelectorAll(sel).length >= 100, cardSel, {timeout: 60000})
      .catch(async () => { throw new Error(`${label} @${viewport.name}: only ${await page.evaluate(s => document.querySelectorAll(s).length, cardSel)} of 100 cards rendered`); });
    const rendered = Date.now() - started;
    await page.evaluate(() => document.fonts.ready);
    /* let every scroll reveal fire, so nothing is judged while hidden */
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(1200);
    process.stdout.write(`  ${label} @${viewport.name}: ${rendered}ms to render\n`);
    const checked = await page.evaluate(new Function('return ' + CONTRACTS)(), [cardSel, thumbSel]);
    result.viewports[viewport.name] = {...checked, renderedMs: rendered,
      nodes: await page.evaluate(() => document.querySelectorAll('*').length),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      errors: errors.length};
    if (viewport.name === '390') {
      await page.screenshot({path: path.join(here, `shots/${label}-390-top.png`)});
      /* every paper must make the same transition */
      process.stdout.write(`  ${label}: archive ok, opening 100 readers…\n`);
      const readerFailures = [];
      for (let i = 0; i < 100; i++) {
        try {
          await page.evaluate(([sel, n]) => document.querySelectorAll(sel)[n].click(), [openSel, i]);
          await page.waitForFunction(readerReady, null, {timeout: 6000});
          const ok = await page.evaluate(() => {
            const sheet = document.querySelector('#readerOverlay.open .reader-sheet, [data-reader]:not([hidden])');
            if (!sheet) return 'no reader';
            const b = sheet.getBoundingClientRect();
            if (b.height < innerHeight * 0.6) return 'reader is not full height';
            const p = sheet.querySelector('p');
            if (!p || !p.textContent.trim()) return 'no prose';
            return null;
          });
          if (ok) readerFailures.push({index: i, reason: ok});
          await page.evaluate(sel => document.querySelector(sel)?.click(), closeSel);
          await page.waitForTimeout(60);
        } catch (error) { readerFailures.push({index: i, reason: String(error.message).split('\n')[0].slice(0, 60)}); }
      }
      result.reader = {opened: 100 - readerFailures.length, failures: readerFailures};
    }
    await context.close();
  }
  return result;
}

const before = await run('origarium', {
  url: `${base}/papers`, cardSel: '.paper-card', thumbSel: '.paper-thumb',
  openSel: '.paper-card', readerReady: () => !!document.querySelector('#readerOverlay.open'),
  closeSel: '.reader-close',
});
const after = await run('idui', {
  url: `${base}/idui-core/evidence/origarium/after/papers.html`, cardSel: '[data-paper]', thumbSel: '[data-mode="preview"]',
  openSel: '[data-open]', readerReady: () => document.querySelector('[data-reader]')?.hidden === false,
  closeSel: '[data-reader-close]',
});

/* appearance authority must not grow with the number of content instances */
const afterHtml = await readFile(path.join(repo, 'idui-core/evidence/origarium/after/papers.html'), 'utf8');
const afterJs = await readFile(path.join(repo, 'idui-core/evidence/origarium/after/papers.js'), 'utf8');
const sourceHtml = await readFile(path.join(repo, 'idui-core/evidence/origarium/source/papers.html'), 'utf8');
const sourceCss = [...sourceHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

const report = {
  test: 'IDUI Test 02.2 — one hundred papers',
  fixture: {count: papers.length, seed: '0x416a21', md5: '0a63c0bda455254ff20fa5f2a1679b11'},
  measuredAt: new Date().toISOString(),
  origarium: before,
  idui: after,
  appearanceAuthority: {
    origarium: discretionary(sourceCss, sourceHtml).total,
    idui: discretionary('', afterHtml + afterJs).total,
    note: 'unchanged by content volume: the page code is the same file that rendered eight',
  },
  vocabulary: {idui: semantic(afterHtml + afterJs).classes},
};
await mkdir(path.join(here, 'shots'), {recursive: true});
await writeFile(path.join(here, 'scale.json'), JSON.stringify(report, null, 1));
await browser.close();
server.close();

const line = (name, r) => `${name.padEnd(11)} ${String(100 - new Set(r.viewports['390'].failures.map(f => f.index)).size).padStart(3)}/100 valid at 390   ${String(100 - new Set(r.viewports['1240'].failures.map(f => f.index)).size).padStart(3)}/100 at 1240   reader ${String(r.reader.opened).padStart(3)}/100   widths ${r.viewports['390'].distinctCardWidths}   previews ${r.viewports['390'].distinctPreviewSizes}   ${r.viewports['390'].renderedMs}ms`;
console.log(line('origarium', before));
console.log(line('idui', after));
console.log('appearance decisions in page code:', JSON.stringify(report.appearanceAuthority));
