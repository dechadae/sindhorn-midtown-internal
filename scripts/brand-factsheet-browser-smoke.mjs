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
async function waitForHeroReady(page,selector){
  await page.waitForFunction(selector=>{
    const hero=document.querySelector(selector),title=hero?.querySelector('h1');
    return Boolean(hero&&hero.querySelector('p:first-child')&&title&&title.nextElementSibling);
  },selector,{timeout:10000});
}
async function assertNoOverflow(page,label){
  const size=await page.evaluate(()=>({root:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth}));
  assert(size.root<=size.client+1&&size.body<=size.client+1,`${label} horizontal overflow ${JSON.stringify(size)}`);
}
async function heroSnapshot(page,selector){
  return page.evaluate(selector=>{
    const hero=document.querySelector(selector),kicker=hero?.querySelector('p:first-child'),title=hero?.querySelector('h1');
    const copy=title?.nextElementSibling;
    if(!hero||!kicker||!title||!copy)return null;
    const hs=getComputedStyle(hero),ks=getComputedStyle(kicker),ts=getComputedStyle(title),cs=getComputedStyle(copy);
    return {paddingTop:hs.paddingTop,paddingBottom:hs.paddingBottom,borderBottomWidth:hs.borderBottomWidth,
      kickerSize:ks.fontSize,kickerMarginBottom:ks.marginBottom,titleSize:ts.fontSize,titleWeight:ts.fontWeight,titleLineHeight:ts.lineHeight,
      copySize:cs.fontSize,copyMarginTop:cs.marginTop};
  },selector);
}
function sameHero(a,b){return JSON.stringify(a)===JSON.stringify(b)}
async function captureViewport(browser,width,height){
  const {context,page,errors}=await newPage(browser,width,height);
  try{
    await page.goto(`${BASE_URL}/brand`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.brand-card');
    await page.waitForTimeout(250);await assertNoOverflow(page,`Brand ${width}x${height}`);
    const brand=await page.evaluate(()=>({
      route:document.body.dataset.route,
      title:document.querySelector('.brand-hero h1')?.textContent.trim(),
      cards:document.querySelectorAll('.brand-card').length,
      titles:[...document.querySelectorAll('.brand-card h2')].map(x=>x.textContent.trim()),
      footer:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(x=>x.textContent.trim()),
      brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false,
      font:getComputedStyle(document.querySelector('.brand-route')).fontFamily,
      spacing:getComputedStyle(document.querySelector('.brand-card')).letterSpacing,
      overlay:getComputedStyle(document.querySelector('.brand-route'),'::before').content
    }));
    assert(brand.route==='brand',`${width}: wrong Brand route ${brand.route}`);
    assert(brand.title==='Know Our Hotel',`${width}: Brand title case mismatch`);
    assert(brand.cards===2,`${width}: expected 2 Brand cards`);
    assert(brand.titles.join('|')==='Our History|Hotel Factsheet',`${width}: Brand card titles mismatch`);
    assert(brand.footer.join('|')==='Today|F&B|Messages|Brand',`${width}: footer navigation changed`);
    assert(brand.brandCurrent,`${width}: Brand footer is not current`);
    assert(brand.font.includes('LINE Seed Sans TH'),`${width}: Brand font mismatch`);
    assert(brand.spacing==='0px'||brand.spacing==='normal',`${width}: Brand letter spacing mismatch`);
    assert(brand.overlay==='none',`${width}: Brand background overlay still exists`);
    const brandHero=await heroSnapshot(page,'.brand-hero');
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'brand-390x844.png'),fullPage:false});

    await page.evaluate(()=>{window.__previewRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')};});

    // F&B is the visual authority: wait for its complete hero markup before reading computed styles.
    await page.locator('#app-footer [data-fnb-nav="fnb"]').click();await page.waitForURL(url=>url.pathname==='/fnb');await page.waitForSelector('.fnb-hero');await waitForHeroReady(page,'.fnb-hero');await page.waitForTimeout(320);
    const fnbHero=await heroSnapshot(page,'.fnb-hero');
    assert(sameHero(fnbHero,brandHero),`${width}: Brand hero does not match F&B authority ${JSON.stringify({fnbHero,brandHero})}`);
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'fnb-hero-reference-390x844.png'),fullPage:false});
    await page.locator('#app-footer [data-app-route="brand"]').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-card');await page.waitForTimeout(280);

    await page.locator('.brand-card').first().click();await page.waitForURL(url=>url.pathname==='/ihg-history');await page.waitForSelector('.ihg-history-route');await page.waitForTimeout(320);
    const history=await page.evaluate(()=>({
      title:document.querySelector('.ihg-history-hero h1')?.textContent.trim(),
      transform:getComputedStyle(document.querySelector('.ihg-history-hero h1')).textTransform,
      overlay:getComputedStyle(document.querySelector('.ihg-history-route'),'::before').content,
      brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false
    }));
    assert(history.title==='Our history'&&history.transform==='capitalize',`${width}: History title-case presentation mismatch ${JSON.stringify(history)}`);
    assert(history.overlay==='none',`${width}: History overlay exists`);
    assert(history.brandCurrent,`${width}: Brand footer not current on History`);
    const historyHero=await heroSnapshot(page,'.ihg-history-hero');
    assert(sameHero(fnbHero,historyHero),`${width}: History hero does not match F&B authority ${JSON.stringify({fnbHero,historyHero})}`);
    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'history-hero-390x844.png'),fullPage:false});

    await page.locator('#app-footer [data-app-route="brand"]').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-card');await page.waitForTimeout(280);
    await page.locator('.brand-card').nth(1).click();await page.waitForURL(url=>url.pathname==='/hotel-factsheet');await page.waitForSelector('.factsheet-route');await page.waitForTimeout(420);
    await assertNoOverflow(page,`Factsheet ${width}x${height}`);

    const facts=await page.evaluate(()=> {
      const context=document.querySelector('#app-footer [data-shell-context="factsheet"]');
      const roomHead=document.querySelector('.factsheet-table-wrap tbody th');
      return {
        route:document.body.dataset.route,
        title:document.querySelector('.factsheet-hero h1')?.textContent.trim(),
        stats:[...document.querySelectorAll('.factsheet-summary b')].map(x=>x.textContent.trim()),
        sourceRails:[...document.querySelectorAll('#route-view .factsheet-section-rail button')].map(x=>x.textContent.trim()),
        footerRails:[...document.querySelectorAll('#app-footer [data-factsheet-section-nav] span')].map(x=>x.textContent.trim()),
        sourceRailDisplay:getComputedStyle(document.querySelector('#route-view .factsheet-section-rail')).display,
        contextOverflow:context?getComputedStyle(context).overflowX:'',
        contextScrollable:context?context.scrollWidth>context.clientWidth:false,
        rooms:document.querySelectorAll('.factsheet-room-card').length,
        dining:document.querySelectorAll('.factsheet-dining-card').length,
        provenance:document.querySelectorAll('.factsheet-provenance').length,
        included:document.querySelectorAll('.factsheet-included-card').length,
        roomColumnWidth:roomHead?roomHead.getBoundingClientRect().width:null,
        brandCurrent:document.querySelector('#app-footer [data-app-route="brand"]')?.hasAttribute('aria-current')||false,
        shellStable:window.__previewRefs.header===document.getElementById('app-header')&&window.__previewRefs.footer===document.getElementById('app-footer')&&window.__previewRefs.atmosphere===document.getElementById('environmentStage'),
        historyRouteKnown:Boolean(window.SindhornNavigation?.routeForPath?.('/ihg-history')),
        factsheetRouteKnown:Boolean(window.SindhornNavigation?.routeForPath?.('/hotel-factsheet')),
        overlay:getComputedStyle(document.querySelector('.factsheet-route'),'::before').content
      };
    });
    assert(facts.route==='hotelFactsheet',`${width}: wrong factsheet route ${facts.route}`);
    assert(facts.title==='Hotel Factsheet',`${width}: Factsheet title case mismatch`);
    assert(facts.stats.join('|')==='393|12|5|120',`${width}: summary values mismatch ${facts.stats.join('|')}`);
    assert(facts.sourceRails.join('|')==='Overview|Stay|Dine|Facilities|Meet|Access',`${width}: source section rail mismatch`);
    assert(facts.footerRails.join('|')==='Overview|Stay|Dine|Facilities|Meet|Access',`${width}: cloned second footer mismatch`);
    assert(facts.sourceRailDisplay==='none',`${width}: route-local section rail still paints`);
    assert(['auto','scroll'].includes(facts.contextOverflow),`${width}: factsheet second footer is not horizontally scrollable`);
    if(width<=390)assert(facts.contextScrollable,`${width}: factsheet second footer does not require side scroll`);
    assert(facts.rooms===12,`${width}: expected 12 room accordions`);
    assert(facts.dining===5,`${width}: expected 5 dining cards`);
    assert(facts.provenance===0,`${width}: Sources section still visible`);
    assert(facts.included===1,`${width}: standardized Included card missing`);
    assert(facts.roomColumnWidth!==null&&facts.roomColumnWidth<=112,`${width}: meeting room column too wide ${facts.roomColumnWidth}`);
    assert(facts.brandCurrent,`${width}: Brand footer not current on factsheet child`);
    assert(facts.shellStable,`${width}: SPA transition replaced persistent shell`);
    assert(facts.historyRouteKnown&&facts.factsheetRouteKnown,`${width}: route registry incomplete`);
    assert(facts.overlay==='none',`${width}: Factsheet background overlay still exists`);
    const factsHero=await heroSnapshot(page,'.factsheet-hero');
    assert(sameHero(fnbHero,factsHero),`${width}: Factsheet hero does not match F&B authority ${JSON.stringify({fnbHero,factsHero})}`);

    if(width===390)await page.screenshot({path:path.join(OUT_DIR,'factsheet-top-390x844.png'),fullPage:false});
    const studio=page.locator('.factsheet-room-card').filter({hasText:'Studio'}).first();
    await studio.locator('.factsheet-room-card-button').click();
    await page.waitForFunction(()=>document.querySelector('.factsheet-room-card.is-open .factsheet-room-card-button')?.getAttribute('aria-expanded')==='true');
    await page.waitForTimeout(520);
    assert(await studio.locator('.factsheet-room-card-button').getAttribute('aria-expanded')==='true',`${width}: room accordion did not open`);
    if(width===390){
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-room-390x844.png'),fullPage:false});
      await page.locator('#app-footer [data-factsheet-section-nav="meet"]').click();
      await page.waitForFunction(()=>{
        const section=document.querySelector('[data-factsheet-section-target="meet"]');if(!section)return false;
        const rect=section.getBoundingClientRect();return rect.top>=-8&&rect.top<innerHeight*.35&&rect.bottom>innerHeight*.45;
      },null,{timeout:8000});
      await page.waitForTimeout(220);
      const meet=await page.evaluate(()=>({
        title:document.querySelector('[data-factsheet-section-target="meet"] h2')?.textContent?.trim()||'',
        active:document.querySelector('#app-footer [data-factsheet-section-nav="meet"]')?.hasAttribute('aria-current')||false,
        included:Boolean(document.querySelector('.factsheet-included-card')),
        footerVisible:Boolean(document.querySelector('#app-footer .app-tabbar'))
      }));
      assert(meet.title==='Meetings & Events'&&meet.active&&meet.included&&meet.footerVisible,`390: Meet footer jump/state mismatch ${JSON.stringify(meet)}`);
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-meet-390x844.png'),fullPage:false});
      await page.locator('.factsheet-included-card').scrollIntoViewIfNeeded();await page.waitForTimeout(180);
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-included-390x844.png'),fullPage:false});
      await page.locator('#app-footer [data-factsheet-section-nav="access"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-factsheet-section-target="access"]')?.getBoundingClientRect().top<innerHeight*.35,null,{timeout:8000});
      await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'auto'}));await page.waitForTimeout(160);
      assert(await page.locator('.factsheet-provenance').count()===0,'390: Sources section reappeared at document bottom');
      await page.screenshot({path:path.join(OUT_DIR,'factsheet-bottom-no-sources-390x844.png'),fullPage:false});
    }
    const relevantErrors=errors.filter(e=>/brand|factsheet|history/i.test(e.url||'')||/brand|factsheet|history/i.test(e.text||''));
    assert(relevantErrors.length===0,`${width}: Brand/Factsheet browser error ${JSON.stringify(relevantErrors[0])}`);
    return {width,height,brand,history,facts,fnbHero,relevantErrors};
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const results=[];
  for(const [width,height] of [[360,800],[390,844],[768,1024]])results.push(await captureViewport(browser,width,height));
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,results,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
