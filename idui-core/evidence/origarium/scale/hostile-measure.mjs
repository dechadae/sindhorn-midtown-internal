/* Test 02.3 — the hostile fixture, both implementations, same contracts.

     node idui-core/evidence/origarium/scale/hostile-measure.mjs   # from the repo root */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {CONTRACTS} from './contracts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const papers = JSON.parse(await readFile(path.join(here, 'papers-hostile.json'), 'utf8'));
const COUNT = papers.length;
const VIEWPORTS = [{name: '390', width: 390, height: 844}, {name: '1240', width: 1240, height: 900}];

const types = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json'};
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  /* /papers is the frozen snapshot; /papers-fixed is a scratch copy carrying
     the equivalent of the core's rule, written outside the repository and
     never back to the source, so the cost of the fix can be measured on both
     sides without editing another application's code. */
  const file = name === '/papers' ? path.join(repo, 'idui-core/evidence/origarium/source/papers.html')
    : name === '/papers-fixed' ? process.env.ORIGARIUM_FIXED
    : path.join(repo, name);
  try { const body = await readFile(file); res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'}); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));

async function run(label, {url, cardSel, thumbSel, openSel, readerReady, closeSel}) {
  const result = {label, viewports: {}, escaping: {}, reader: {}};
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    await context.route('**/papers.fixture.json', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(papers)}));
    await context.route('**://*.supabase.co/**', r => {
      if (r.request().method() !== 'GET') return r.abort();
      if (/\/papers\?/.test(r.request().url())) return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(papers)});
      return r.fulfill({status: 200, contentType: 'application/json', body: '[]'});
    });
    await page.goto(url, {waitUntil: 'networkidle'});
    await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [cardSel, COUNT], {timeout: 45000})
      .catch(async () => { throw new Error(`${label} @${viewport.name}: only ${await page.evaluate(s => document.querySelectorAll(s).length, cardSel)} of ${COUNT}`); });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(1000);
    const checked = await page.evaluate(new Function('return ' + CONTRACTS)(), [cardSel, thumbSel]);
    result.viewports[viewport.name] = {...checked, errors: errors.length,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)};
    if (viewport.name === '390') {
      /* markup in content must be shown, never run */
      result.escaping = await page.evaluate(() => ({
        titleExecuted: document.title === 'PWNED',
        bodyExecuted: document.body.dataset.bodyPwned === '1' || document.body.dataset.pwned === 'yes',
        injectedImages: [...document.images].filter(i => i.getAttribute('src') === 'x').length,
        injectedScripts: [...document.querySelectorAll('script')].filter(s => /document\.body\.dataset/.test(s.textContent || '')).length,
      }));
      await page.screenshot({path: path.join(here, `shots/hostile-${label}-390-top.png`), fullPage: false});
      const failures = [];
      for (let i = 0; i < COUNT; i++) {
        try {
          await page.evaluate(([sel, n]) => document.querySelectorAll(sel)[n].click(), [openSel, i]);
          await page.waitForFunction(readerReady, null, {timeout: 6000});
          const problem = await page.evaluate(() => {
            const sheet = document.querySelector('#readerOverlay.open .reader-sheet, [data-reader]:not([hidden])');
            if (!sheet) return 'no reader';
            if (sheet.getBoundingClientRect().height < innerHeight * 0.6) return 'reader not full height';
            if (document.documentElement.scrollWidth - document.documentElement.clientWidth > 1) return 'reader overflows sideways';
            return null;
          });
          if (problem) failures.push({index: i, case: papers[i].case, reason: problem});
          await page.evaluate(sel => document.querySelector(sel)?.click(), closeSel);
          await page.waitForTimeout(50);
        } catch (error) { failures.push({index: i, case: papers[i].case, reason: String(error.message).split('\n')[0].slice(0, 60)}); }
      }
      result.reader = {opened: COUNT - failures.length, of: COUNT, failures};
    }
    await context.close();
  }
  return result;
}

const route = process.env.ORIGARIUM_ROUTE || '/papers';
const origarium = await run('origarium', {url: `${base}${route}`, cardSel: '.paper-card', thumbSel: '.paper-thumb',
  openSel: '.paper-card', readerReady: () => !!document.querySelector('#readerOverlay.open'), closeSel: '.reader-close'});
const idui = await run('idui', {url: `${base}/idui-core/evidence/origarium/after/papers.html`, cardSel: '[data-paper]', thumbSel: '[data-mode="preview"]',
  openSel: '[data-open]', readerReady: () => document.querySelector('[data-reader]')?.hidden === false, closeSel: '[data-reader-close]'});

await mkdir(path.join(here, 'shots'), {recursive: true});
/* Written into a named phase, never over the whole file: re-running after a
   repair once erased the failing numbers, and a record that shows only 22/22
   says nothing happened. ORIGARIUM_ROUTE=/papers-fixed selects afterRepair. */
const phase = process.env.ORIGARIUM_ROUTE === '/papers-fixed' ? 'afterRepair' : 'beforeRepair';
const file = path.join(here, 'hostile.json');
const existing = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
existing.test = 'IDUI Test 02.3 — hostile content';
existing.fixture = {count: COUNT, md5: 'b676142dda0567a4fda9f1d67a2d6c47'};
existing[phase] = {origarium, idui, measuredAt: new Date().toISOString()};
await writeFile(file, JSON.stringify(existing, null, 1));
console.log(`written to ${phase}`);
await browser.close(); server.close();

for (const r of [origarium, idui]) {
  const bad = v => new Set(v.failures.map(f => f.index)).size;
  console.log(`${r.label.padEnd(10)} valid ${String(COUNT - bad(r.viewports['390'])).padStart(2)}/${COUNT} @390  ${String(COUNT - bad(r.viewports['1240'])).padStart(2)}/${COUNT} @1240  reader ${String(r.reader.opened).padStart(2)}/${COUNT}  overflow ${r.viewports['390'].overflow}  escaping ${JSON.stringify(r.escaping)}`);
  const named = [...new Map(r.viewports['390'].failures.map(f => [f.index, f])).values()];
  for (const f of named.slice(0, 6)) console.log(`   card ${String(f.index).padStart(2)} ${(papers[f.index]?.case || '').padEnd(24)} ${f.reason}`);
  for (const f of r.reader.failures.slice(0, 6)) console.log(`   reader ${String(f.index).padStart(2)} ${f.case.padEnd(22)} ${f.reason}`);
}
