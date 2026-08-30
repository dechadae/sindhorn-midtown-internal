import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/brand-factsheet-preview';
await fs.mkdir(OUT_DIR,{recursive:true});
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Brand Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const weight=value=>Number.parseInt(String(value||'0'),10)||0;

async function waitForShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
const errors=[];
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/share/fnb-public-data.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const FNB_PUBLIC_DATA=[]; export default [];'}));
page.on('pageerror',error=>errors.push({type:'pageerror',text:error.message}));
page.on('console',msg=>{if(msg.type()==='error')errors.push({type:'console',text:msg.text(),url:msg.location()?.url||''})});

try{
  await page.goto(`${BASE_URL}/brand`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.brand-card');await page.waitForTimeout(240);
  const brandBefore=await page.evaluate(()=>({
    h1:document.querySelector('.brand-hero h1')?.textContent.trim(),
    h1Weight:getComputedStyle(document.querySelector('.brand-hero h1')).fontWeight,
    cardTitles:[...document.querySelectorAll('.brand-card h2')].map(node=>({text:node.textContent.trim(),weight:getComputedStyle(node).fontWeight}))
  }));
  assert(brandBefore.h1==='Know Our Hotel'&&weight(brandBefore.h1Weight)>=400,'Brand H1 title/weight mismatch');
  assert(brandBefore.cardTitles.map(x=>x.text).join('|')==='Our History|Hotel Factsheet','Brand card titles mismatch');
  assert(brandBefore.cardTitles.every(x=>weight(x.weight)>=400),`Brand card title is thin ${JSON.stringify(brandBefore.cardTitles)}`);

  // Load the exact F&B stylesheet through the same URL used by fnb.js, then render
  // a neutral reference card in-place. This compares the real computed F&B recipe
  // without depending on an unrelated route-transition race.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const existing=document.querySelector('link[data-fnb-style]');if(existing){resolve();return}
    const link=document.createElement('link');link.rel='stylesheet';link.href='/fnb.css?v=2&ui=2';link.dataset.fnbStyle='true';link.onload=resolve;link.onerror=reject;document.head.appendChild(link);
  }));
  const fnbCard=await page.evaluate(()=>{
    const ref=document.createElement('article');ref.className='fnb-card';ref.style.position='fixed';ref.style.left='-10000px';ref.style.top='0';
    ref.innerHTML='<button class="fnb-card-button" type="button"><h2 class="fnb-card-title">Reference Promotion</h2><p class="fnb-card-outlets">Reference Outlet</p></button>';
    document.body.appendChild(ref);
    const button=ref.querySelector('.fnb-card-button'),title=ref.querySelector('.fnb-card-title'),copy=ref.querySelector('.fnb-card-outlets');
    const rs=getComputedStyle(ref),bs=getComputedStyle(button),ts=getComputedStyle(title),cs=getComputedStyle(copy);
    const out={borderRadius:rs.borderRadius,borderTopWidth:rs.borderTopWidth,borderTopColor:rs.borderTopColor,backgroundColor:rs.backgroundColor,backdropFilter:rs.backdropFilter||rs.webkitBackdropFilter||'none',paddingTop:bs.paddingTop,paddingRight:bs.paddingRight,paddingBottom:bs.paddingBottom,paddingLeft:bs.paddingLeft,titleSize:ts.fontSize,titleWeight:ts.fontWeight,titleLineHeight:ts.lineHeight,copySize:cs.fontSize};
    ref.remove();return out;
  });
  const brandCard=await page.evaluate(()=>{
    const ref=document.querySelector('.brand-card'),title=ref.querySelector('h2'),copy=ref.querySelector('p');
    const rs=getComputedStyle(ref),ts=getComputedStyle(title),cs=getComputedStyle(copy);
    return {borderRadius:rs.borderRadius,borderTopWidth:rs.borderTopWidth,borderTopColor:rs.borderTopColor,backgroundColor:rs.backgroundColor,backdropFilter:rs.backdropFilter||rs.webkitBackdropFilter||'none',paddingTop:rs.paddingTop,paddingRight:rs.paddingRight,paddingBottom:rs.paddingBottom,paddingLeft:rs.paddingLeft,titleSize:ts.fontSize,titleWeight:ts.fontWeight,titleLineHeight:ts.lineHeight,copySize:cs.fontSize};
  });
  for(const key of Object.keys(fnbCard)){
    if(key==='paddingBottom')continue;
    assert(brandCard[key]===fnbCard[key],`Brand card ${key} diverges from F&B: ${brandCard[key]} vs ${fnbCard[key]}`);
  }
  assert(brandCard.backgroundColor==='rgba(46, 39, 59, 0.48)'&&brandCard.backdropFilter==='blur(18px) saturate(1.18)','Brand card final F&B surface mismatch');

  await page.locator('.brand-card').nth(1).click();await page.waitForURL(url=>url.pathname==='/hotel-factsheet');await page.waitForSelector('.factsheet-route');await page.waitForTimeout(320);
  const headings=await page.evaluate(()=>({
    major:[document.querySelector('.factsheet-hero h1'),...document.querySelectorAll('.factsheet-section-head h2')].filter(Boolean).map(node=>({text:node.textContent.trim(),weight:getComputedStyle(node).fontWeight})),
    secondFooter:document.querySelectorAll('#app-footer [data-shell-context="factsheet"]').length,
    mainFooter:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(x=>x.textContent.trim())
  }));
  const expectedMajor=['Hotel Factsheet','Hotel at a Glance','Rooms & Suites','Dining','Facilities & Guest Experience','Meetings & Events','Location & Contacts'];
  assert(headings.major.map(x=>x.text).join('|')===expectedMajor.join('|'),`Factsheet major titles mismatch ${JSON.stringify(headings.major)}`);
  assert(headings.major.every(x=>weight(x.weight)>=400),`Factsheet major title is thin ${JSON.stringify(headings.major)}`);
  assert(headings.secondFooter===0,'Factsheet second footer still rendered');
  assert(headings.mainFooter.join('|')==='Today|F&B|Messages|Brand','Main footer changed on Factsheet');

  await page.locator('[data-factsheet-section-target="access"]').scrollIntoViewIfNeeded();await page.waitForTimeout(180);
  const access=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('.factsheet-contacts a')];
    const values=rows.map(row=>row.querySelector('b')?.getBoundingClientRect().left||0),labels=rows.map(row=>row.querySelector('span')?.getBoundingClientRect().left||0);
    const source=document.querySelector('[data-factsheet-section-target="access"]>.factsheet-inline-source a');
    return {rows:rows.length,values,labels,align:rows.map(row=>getComputedStyle(row).alignItems),sourceLeft:source?.getBoundingClientRect().left||0,footerCount:document.querySelectorAll('#app-footer [data-shell-context="factsheet"]').length};
  });
  assert(access.rows===4&&access.align.every(x=>x==='baseline'),`Access row alignment mismatch ${JSON.stringify(access)}`);
  assert(Math.max(...access.values)-Math.min(...access.values)<=1,'Access values are not aligned');
  assert(Math.max(...access.labels)-Math.min(...access.labels)<=1,'Access labels are not aligned');
  assert(Math.abs(access.sourceLeft-access.values[0])<=1.5,'Location source is not aligned to contact values');
  assert(access.footerCount===0,'Factsheet second footer returned after scrolling');
  await page.screenshot({path:path.join(OUT_DIR,'factsheet-access-aligned-390x844.png'),fullPage:false});

  const relevantErrors=errors.filter(e=>/brand|factsheet|fnb|footer/i.test(e.url||'')||/brand|factsheet|fnb|footer/i.test(e.text||''));
  assert(relevantErrors.length===0,`Navigation/card browser errors ${JSON.stringify(relevantErrors[0])}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,fnbCard,brandCard,headings,access,relevantErrors}));
}finally{
  await context.close();await browser.close();
}
