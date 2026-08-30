import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/brand-factsheet-preview';
await fs.mkdir(OUT_DIR,{recursive:true});

const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Brand Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
});
await import('/bootstrap.js');
`;
function assert(condition,message){if(!condition)throw new Error(message)}
async function newPage(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
  const errors=[];
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/share/fnb-public-data.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const FNB_PUBLIC_DATA=[]; export default [];'}));
  page.on('pageerror',error=>errors.push({type:'pageerror',text:error.message}));
  page.on('console',msg=>{if(msg.type()==='error')errors.push({type:'console',text:msg.text(),url:msg.location()?.url||''})});
  return {context,page,errors};
}
async function waitForShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});
  await page.waitForSelector('#app-header .masthead');await page.waitForSelector('#app-footer .app-tabbar');
}
async function assertNoOverflow(page,label){
  const size=await page.evaluate(()=>({root:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth}));
  assert(size.root<=size.client+1&&size.body<=size.client+1,`${label} horizontal overflow ${JSON.stringify(size)}`);
}

async function captureViewport(browser,width,height){
  const {context,page,errors}=await newPage(browser,width,height);
  try{
    await page.goto(`${BASE_URL}/brand`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.brand-card');await page.waitForTimeout(240);
    await assertNoOverflow(page,`Brand ${width}x${height}`);
    const brand=await page.evaluate(()=>({
      route:document.body.dataset.route,
      title:document.querySelector('.brand-hero h1')?.textContent.trim(),
      cards:document.querySelectorAll('.brand-card').length,
      titles:[...document.querySelectorAll('.brand-card h2')].map(x=>x.textContent.trim()),
      footer:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(x=>x.textContent.trim()),
      brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false,
      font:getComputedStyle(document.querySelector('.brand-route')).fontFamily
    }));
    assert(brand.route==='brand'&&brand.title==='Know Our Hotel',`${width}: Brand route/title mismatch ${JSON.stringify(brand)}`);
    assert(brand.cards===2&&brand.titles.join('|')==='Our History|Hotel Factsheet',`${width}: Brand cards mismatch`);
    assert(brand.footer.join('|')==='Today|F&B|Messages|Brand'&&brand.brandCurrent,`${width}: main footer mismatch`);
    assert(brand.font.includes('LINE Seed Sans TH'),`${width}: Brand font mismatch`);
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'brand-390x844.png'),fullPage:false});

    await page.evaluate(()=>{window.__previewRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')};});
    await page.locator('.brand-card').first().click();await page.waitForURL(url=>url.pathname==='/ihg-history');await page.waitForSelector('.ihg-history-route');await page.waitForTimeout(260);
    const history=await page.evaluate(()=>({title:document.querySelector('.ihg-history-hero h1')?.textContent.trim(),transform:getComputedStyle(document.querySelector('.ihg-history-hero h1')).textTransform,brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false}));
    assert(history.title==='Our history'&&history.transform==='capitalize'&&history.brandCurrent,`${width}: History presentation mismatch ${JSON.stringify(history)}`);
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'history-hero-390x844.png'),fullPage:false});

    await page.locator('#app-footer [data-app-route="brand"]').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-card');await page.waitForTimeout(240);
    await page.locator('.brand-card').nth(1).click();await page.waitForURL(url=>url.pathname==='/hotel-factsheet');await page.waitForSelector('.factsheet-route');await page.waitForTimeout(360);
    await assertNoOverflow(page,`Factsheet ${width}x${height}`);
    const facts=await page.evaluate(()=>({
      route:document.body.dataset.route,
      title:document.querySelector('.factsheet-hero h1')?.textContent.trim(),
      stats:[...document.querySelectorAll('.factsheet-summary b')].map(x=>x.textContent.trim()),
      sourceRailDisplay:getComputedStyle(document.querySelector('#route-view .factsheet-section-rail')).display,
      secondFooterCount:document.querySelectorAll('#app-footer [data-shell-context="factsheet"]').length,
      footer:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(x=>x.textContent.trim()),
      rooms:document.querySelectorAll('.factsheet-room-card').length,
      dining:document.querySelectorAll('.factsheet-dining-card').length,
      included:document.querySelectorAll('.factsheet-included-card').length,
      brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false,
      shellStable:window.__previewRefs.header===document.getElementById('app-header')&&window.__previewRefs.footer===document.getElementById('app-footer')&&window.__previewRefs.atmosphere===document.getElementById('environmentStage')
    }));
    assert(facts.route==='hotelFactsheet'&&facts.title==='Hotel Factsheet',`${width}: factsheet route/title mismatch`);
    assert(facts.stats.join('|')==='393|12|5|120',`${width}: factsheet summary mismatch ${facts.stats}`);
    assert(facts.sourceRailDisplay==='none',`${width}: route-owned section rail is visible`);
    assert(facts.secondFooterCount===0,`${width}: Factsheet second footer still exists`);
    assert(facts.footer.join('|')==='Today|F&B|Messages|Brand',`${width}: Factsheet main footer changed`);
    assert(facts.rooms===12&&facts.dining===5&&facts.included===1,`${width}: Factsheet content counts mismatch`);
    assert(facts.brandCurrent&&facts.shellStable,`${width}: Factsheet shell/footer state mismatch`);
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'factsheet-top-390x844.png'),fullPage:false});

    const studio=page.locator('.factsheet-room-card').filter({hasText:'Studio'}).first();
    await studio.locator('.factsheet-room-card-button').click();
    await page.waitForFunction(()=>document.querySelector('.factsheet-room-card.is-open .factsheet-room-card-button')?.getAttribute('aria-expanded')==='true');
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'factsheet-room-390x844.png'),fullPage:false});

    if(width===390){
      const meet=page.locator('[data-factsheet-section-target="meet"]');await meet.scrollIntoViewIfNeeded();await page.waitForTimeout(180);
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-meet-390x844.png'),fullPage:false});
      const access=page.locator('[data-factsheet-section-target="access"]');await access.scrollIntoViewIfNeeded();await page.waitForTimeout(180);
      const accessLayout=await page.evaluate(()=>{
        const rows=[...document.querySelectorAll('.factsheet-contacts a')];
        const values=rows.map(row=>row.querySelector('b')?.getBoundingClientRect().left||0);
        const labels=rows.map(row=>row.querySelector('span')?.getBoundingClientRect().left||0);
        const rowAlign=rows.map(row=>getComputedStyle(row).alignItems);
        const source=document.querySelector('[data-factsheet-section-target="access"]>.factsheet-inline-source a');
        return {rows:rows.length,values,labels,rowAlign,sourceLeft:source?.getBoundingClientRect().left||0,secondFooter:document.querySelectorAll('#app-footer [data-shell-context="factsheet"]').length,mainFooterVisible:Boolean(document.querySelector('#app-footer .app-tabbar'))};
      });
      assert(accessLayout.rows===4,`Access contact row count mismatch ${JSON.stringify(accessLayout)}`);
      assert(accessLayout.rowAlign.every(value=>value==='baseline'),`Access rows are not baseline aligned ${JSON.stringify(accessLayout.rowAlign)}`);
      assert(Math.max(...accessLayout.values)-Math.min(...accessLayout.values)<=1,`Access values do not share one column ${JSON.stringify(accessLayout.values)}`);
      assert(Math.max(...accessLayout.labels)-Math.min(...accessLayout.labels)<=1,`Access labels do not share one column ${JSON.stringify(accessLayout.labels)}`);
      assert(Math.abs(accessLayout.sourceLeft-accessLayout.values[0])<=1.5,`Location source does not align with value column ${JSON.stringify(accessLayout)}`);
      assert(accessLayout.secondFooter===0&&accessLayout.mainFooterVisible,'Factsheet footer simplification failed');
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-access-single-footer-390x844.png'),fullPage:false});
    }

    // Shared F&B navigation must remain functional after the Factsheet-specific footer simplification.
    await page.locator('#app-footer [data-fnb-nav="fnb"]').click();await page.waitForURL(url=>url.pathname==='/fnb');await page.waitForSelector('.fnb-hero');
    const relevantErrors=errors.filter(e=>/brand|factsheet|history|fnb|footer/i.test(e.url||'')||/brand|factsheet|history|fnb|footer/i.test(e.text||''));
    assert(relevantErrors.length===0,`${width}: browser error ${JSON.stringify(relevantErrors[0])}`);
    return {width,height,brand,history,facts,relevantErrors};
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const results=[];
  for(const [width,height] of [[360,800],[390,844],[768,1024]])results.push(await captureViewport(browser,width,height));
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,results,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
