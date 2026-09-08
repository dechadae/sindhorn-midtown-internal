#!/usr/bin/env node
/* Content does not overflow sideways, and words do not shatter.

   Two rules, one check, because they are the same rule seen from two sides:
   what will not fit must be composed differently, not pushed off the screen or
   broken through the middle of a word.

     No page scrolls horizontally at 390px.
     Only a genuine multi-column table may scroll inside its own wrap. A text
     table that does not fit is a composition to redo, not content to hide.
     A word breaks only where a word may break - at a hyphen or a slash.
     "Cl / os / ed" is a defect; "golden-hour" over two lines is typography.

     node scripts/no-horizontal-overflow.mjs [--json] */
import {readFileSync, readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const site = path.join(root, 'site');
const ROUTES = ['/index.html', '/ci.html', '/voice.html', '/idui.html', '/evidence.html', '/origarium.html', '/betta.html'];
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = createServer((req, res) => {
  let name = decodeURIComponent(req.url.split('?')[0]); if (name === '/') name = '/index.html';
  let body = null; const file = path.join(site, name);
  try { body = readFileSync(file); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'}); res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch().catch(() => chromium.launch({channel: 'chrome'}));
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = `${b64({alg:'none',typ:'JWT'})}.${b64({sub:'00000000-0000-0000-0000-000000000001',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})}.smoke`;

const findings = [];
for (const route of ROUTES) {
  const page = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage();
  await page.addInitScript(t => localStorage.setItem('sindhorn-midtown-auth-session-v1', JSON.stringify(
    {access_token: t, refresh_token: 'smoke', expires_at: Math.floor(Date.now()/1000)+86400, token_type: 'bearer', user: null})), token);
  await page.route('**/rest/v1/rpc/sindhorn_current_employee_profile', r => r.fulfill({status: 200, contentType: 'application/json',
    body: JSON.stringify({id:'00000000-0000-0000-0000-000000000001', employee_number:'10639', display_name:'CI Developer', role:'super_admin', account_type:'developer', work_email:null, pin_configured_at:new Date().toISOString(), active:true})}));
  await page.route(/supabase\.co\/rest\/v1\/(?!rpc\/sindhorn_current_employee_profile)/, r => r.fulfill({status: 200, contentType: 'application/json', body: '[]'}));
  /* Not networkidle: the Betta runtime keeps the connection busy, so /ci never
     settles and the navigation times out on a runner. Wait for the document,
     then for the page's own mount, the way the render smoke does. */
  await page.goto(base + route, {waitUntil: 'load'});
  await page.waitForSelector('main', {timeout: 20000}).catch(() => {});
  await page.waitForSelector('.app-page[data-ready="true"]', {timeout: 8000}).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const found = await page.evaluate(() => {
    const out = [];
    const page = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (page > 0) out.push(`the page scrolls sideways by ${page}px`);
    for (const wrap of document.querySelectorAll('.app-table-wrap')) {
      const over = wrap.scrollWidth - wrap.clientWidth;
      if (over <= 0) continue;
      const table = wrap.querySelector('table');
      const head = table?.querySelector('thead th')?.textContent?.trim().slice(0, 24) || '?';
      if (table?.dataset.mode === 'text') out.push(`a text table scrolls ${over}px — "${head}" needs a different composition, not a sideways page`);
    }
    /* A break inside a word, where the word offers no break point. */
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node; const seen = new Set();
    while (node = walk.nextNode()) {
      const text = node.textContent; if (!/\S/.test(text)) continue;
      const el = node.parentElement; if (!el || el.closest('script,style')) continue;
      for (const m of text.matchAll(/[^\s—–]+/g)) {
        const word = m[0];
        if (word.length < 4 || /[-/_.:@]/.test(word)) continue;   // a hyphen is a break point
        const range = document.createRange();
        range.setStart(node, m.index); range.setEnd(node, m.index + word.length);
        const tops = new Set([...range.getClientRects()].filter(r => r.width > 0.5).map(r => Math.round(r.top)));
        if (tops.size > 1 && !seen.has(word)) { seen.add(word); out.push(`"${word}" is broken across ${tops.size} lines in ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`); }
      }
    }
    return out;
  });
  for (const f of found) findings.push(`${route}: ${f}`);
  await page.close();
}
await browser.close(); server.close();
const ok = findings.length === 0;
console.log(JSON.stringify({ok, routes: ROUTES.length, findings}, null, findings.length ? 1 : 0));
if (!ok) process.exit(1);
