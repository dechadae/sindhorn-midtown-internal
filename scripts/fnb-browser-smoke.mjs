import {chromium} from 'playwright';

const baseUrl=(process.env.BASE_URL||'').replace(/\/$/,'');
if(!baseUrl)throw new Error('BASE_URL is required');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});

async function setFilter(kind,value){
  await page.click(`[data-filter-trigger="${kind}"]`);
  await page.click(`[data-filter-option="${kind}"][data-value="${value.replace(/"/g,'\\"')}"]`);
  await page.waitForTimeout(100);
}

await page.goto(`${baseUrl}/__fnb-footer-smoke.html`,{waitUntil:'domcontentloaded',timeout:45000});
await page.waitForSelector('[data-fnb-nav="fnb"]',{timeout:15000});
await page.click('[data-fnb-nav="fnb"]');
await page.waitForSelector('#route-view .fnb-route',{timeout:20000});
await page.waitForFunction(()=>document.querySelectorAll('.fnb-card').length===18);
await page.waitForFunction(()=>[...document.querySelectorAll('[data-filter-option="outlet"]')].some(x=>x.dataset.value==='In-room Dining'));
await page.waitForSelector('[data-fnb-data-updated]');
await page.waitForTimeout(500);

const index=await page.evaluate(()=>({
  path:location.pathname,
  title:document.querySelector('.fnb-hero h1')?.textContent?.trim(),
  cards:document.querySelectorAll('.fnb-card').length,
  footer:[...document.querySelectorAll('#app-footer .nav-chip')].map(x=>x.textContent.trim()),
  outletOptions:[...document.querySelectorAll('[data-filter-option="outlet"]')].map(x=>x.dataset.value),
  updated:document.querySelector('[data-fnb-data-updated]')?.textContent?.trim(),
  updatedUnderPeriod:document.querySelector('.fnb-period')?.nextElementSibling?.matches('[data-fnb-data-updated]')||false
}));
if(index.path!=='/fnb'||index.title!=='Promotions'||index.cards!==18)throw new Error(`index mismatch ${JSON.stringify(index)}`);
if(index.footer.join('|')!=='Today|F&B|Messages')throw new Error(`footer mismatch ${JSON.stringify(index.footer)}`);
if(!index.updatedUnderPeriod||!/^Updated \d{1,2} [A-Z][a-z]+ \d{4} · \d{1,2}:\d{2} (am|pm)$/.test(index.updated||''))throw new Error(`update timestamp mismatch ${JSON.stringify(index.updated)}`);
for(const outlet of ['ALL','ANJU',"Bangkok'78",'Sip & Co.','Horizon Pool Bar','The Lobby Lounge','In-room Dining'])if(!index.outletOptions.includes(outlet))throw new Error(`missing outlet ${outlet}`);

for(const [month,count] of Object.entries({SEP:4,OCT:6,NOV:10,DEC:11})){
  await setFilter('month',month);
  const cards=await page.locator('.fnb-card').count();
  if(cards!==count)throw new Error(`${month}: expected ${count}, got ${cards}`);
}
await setFilter('month','ALL');
for(const [outlet,count] of Object.entries({ANJU:8,"Bangkok'78":4,'Sip & Co.':4,'Horizon Pool Bar':2,'The Lobby Lounge':4,'In-room Dining':1})){
  await setFilter('outlet',outlet);
  const cards=await page.locator('.fnb-card').count();
  if(cards!==count)throw new Error(`${outlet}: expected ${count}, got ${cards}`);
}
await setFilter('outlet','ALL');
await page.waitForFunction(()=>document.querySelectorAll('.fnb-card').length===18);
await page.waitForTimeout(300);

const ids=await page.locator('[data-open]').evaluateAll(nodes=>nodes.map(n=>n.dataset.open));
if(ids.length!==18||new Set(ids).size!==18)throw new Error(`promotion cards are not unique: ${JSON.stringify(ids)}`);
for(const id of ids){
  const expected=await page.locator(`[data-open="${id}"] .fnb-progress-meta b`).textContent();
  await page.click(`[data-open="${id}"]`);
  await page.waitForSelector('.fnb-detail:not([hidden])');
  await page.waitForFunction(expectedText=>document.querySelector('.fnb-section-count')?.textContent?.trim()===`${expectedText.trim()} complete`,expected,{timeout:5000});
  const detail=await page.evaluate(()=>({
    title:document.querySelector('.fnb-detail-title')?.textContent?.trim(),
    sections:['overview','brief','copy','artwork'].map(id=>!!document.getElementById(id)),
    text:document.querySelector('.fnb-detail')?.textContent||'',
    thai:[...document.querySelectorAll('.fnb-text-copy[lang="th"]:not(.fnb-missing)')].map(x=>x.textContent),
    visibleEmptyArtwork:[...document.querySelectorAll('.fnb-art-card')].filter(card=>card.offsetParent!==null&&/^0\/0/.test(card.querySelector('.fnb-art-tally')?.textContent?.trim()||'')).length
  }));
  if(!detail.title||detail.sections.some(x=>!x)||detail.text.includes('undefined')||detail.text.includes('\uFFFD')||detail.text.includes('\u200B'))throw new Error(`${id}: malformed detail`);
  if(detail.visibleEmptyArtwork)throw new Error(`${id}: visible 0/0 artwork group`);
  for(const text of detail.thai)if(text&&!/[\u0E00-\u0E7F]/.test(text))throw new Error(`${id}: Thai copy lost Unicode`);
  await page.click('[data-back]');
  await page.waitForSelector('.fnb-index:not([hidden])');
}
if(errors.length)throw new Error(errors.join('\n'));

const fried=await browser.newPage({viewport:{width:390,height:844}});
await fried.addInitScript(()=>{window.__opened=[];window.open=url=>{window.__opened.push(url);return null}});
await fried.goto(`${baseUrl}/share/fnb/fried-chicken-waffles`,{waitUntil:'networkidle'});
await fried.waitForSelector('.fnb-detail-title');
await fried.waitForSelector('[data-fnb-data-updated]');
await fried.waitForFunction(()=>{
  const indexCount=document.querySelector('[data-open="fried-chicken-waffles"] .fnb-progress-meta b')?.textContent?.trim();
  return !!indexCount&&document.querySelector('.fnb-section-count')?.textContent?.trim()===`${indexCount} complete`;
},{timeout:5000});
const friedState=await fried.evaluate(()=>({
  updated:document.querySelector('[data-fnb-data-updated]')?.textContent?.trim(),
  updatedUnderPeriod:document.querySelector('.fnb-period')?.nextElementSibling?.matches('[data-fnb-data-updated]')||false,
  visibleEmptyArtwork:[...document.querySelectorAll('.fnb-art-card')].filter(card=>card.offsetParent!==null&&/^0\/0/.test(card.querySelector('.fnb-art-tally')?.textContent?.trim()||'')).length
}));
if(!friedState.updatedUnderPeriod||!/^Updated \d{1,2} [A-Z][a-z]+ \d{4} · \d{1,2}:\d{2} (am|pm)$/.test(friedState.updated||''))throw new Error(`public timestamp missing ${JSON.stringify(friedState)}`);
if(friedState.visibleEmptyArtwork)throw new Error('public Fried Chicken shows a 0/0 artwork group');
if(await fried.locator('[data-folder-edit]').count())throw new Error('public folder editor exposed');
await fried.click('[data-folder-open]');
const opened=await fried.evaluate(()=>window.__opened);
if(opened.length!==1||!opened[0].includes('sharepoint.com'))throw new Error(`fried chicken folder missing ${JSON.stringify(opened)}`);

const negroni=await browser.newPage({viewport:{width:390,height:844}});
await negroni.goto(`${baseUrl}/share/fnb/negroni-week`,{waitUntil:'networkidle'});
await negroni.waitForSelector('.fnb-detail-title');
await negroni.click('[data-folder-open]');
await negroni.waitForSelector('.fnb-sheet-layer.is-open');
const hrefs=await negroni.locator('.fnb-link-list a').evaluateAll(nodes=>nodes.map(n=>n.href));
if(hrefs.length!==2||hrefs.some(x=>!x.includes('sharepoint.com')))throw new Error(`Negroni public folder links bad ${JSON.stringify(hrefs)}`);

await browser.close();
console.log(JSON.stringify({ok:true,promotions:18,viewport:'390x844',updated:index.updated}));
