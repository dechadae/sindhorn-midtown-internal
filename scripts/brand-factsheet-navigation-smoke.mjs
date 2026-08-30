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
  await page.goto(`${BASE_URL}/brand`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.brand-card');await page.waitForTimeout(260);
  const brandBefore=await page.evaluate(()=>({
    h1:document.querySelector('.brand-hero h1')?.textContent.trim(),
    h1Weight:getComputedStyle(document.querySelector('.brand-hero h1')).fontWeight,
    cardTitles:[...document.querySelectorAll('.brand-card h2')].map(node=>({text:node.textContent.trim(),weight:getComputedStyle(node).fontWeight}))
  }));
  assert(brandBefore.h1==='Know Our Hotel','Brand H1 is not Title Case');
  assert(weight(brandBefore.h1Weight)>=400,`Brand H1 is thin (${brandBefore.h1Weight})`);
  assert(brandBefore.cardTitles.map(x=>x.text).join('|')==='Our History|Hotel Factsheet','Brand card titles are not the approved Title Case labels');
  assert(brandBefore.cardTitles.every(x=>weight(x.weight)>=400),`Brand card title is thin ${JSON.stringify(brandBefore.cardTitles)}`);

  // Load the actual F&B card CSS authority, then read a neutral reference card's computed style.
  await page.locator('#app-footer [data-fnb-nav="fnb"]').click();await page.waitForURL(url=>url.pathname==='/fnb');await page.waitForSelector('.fnb-hero');await page.waitForTimeout(340);
  const fnbCard=await page.evaluate(()=>{
    const ref=document.createElement('article');ref.className='fnb-card';ref.style.position='fixed';ref.style.left='-10000px';ref.style.top='0';
    ref.innerHTML='<button class="fnb-card-button" type="button"><h2 class="fnb-card-title">Reference Promotion</h2><p class="fnb-card-outlets">Reference Outlet</p></button>';
    document.body.appendChild(ref);
    const button=ref.querySelector('.fnb-card-button'),title=ref.querySelector('.fnb-card-title'),copy=ref.querySelector('.fnb-card-outlets');
    const rs=getComputedStyle(ref),bs=getComputedStyle(button),ts=getComputedStyle(title),cs=getComputedStyle(copy);
    const out={borderRadius:rs.borderRadius,borderTopWidth:rs.borderTopWidth,borderTopColor:rs.borderTopColor,backgroundColor:rs.backgroundColor,backdropFilter:rs.backdropFilter||rs.webkitBackdropFilter||'none',transitionDuration:rs.transitionDuration,paddingTop:bs.paddingTop,paddingRight:bs.paddingRight,paddingBottom:bs.paddingBottom,paddingLeft:bs.paddingLeft,titleSize:ts.fontSize,titleWeight:ts.fontWeight,titleLineHeight:ts.lineHeight,copySize:cs.fontSize};
    ref.remove();return out;
  });

  await page.locator('#app-footer [data-app-route="brand"]').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-card');await page.waitForTimeout(300);
  const brandCard=await page.evaluate(()=>{
    const ref=document.querySelector('.brand-card'),title=ref.querySelector('h2'),copy=ref.querySelector('p');
    const rs=getComputedStyle(ref),ts=getComputedStyle(title),cs=getComputedStyle(copy);
    return {borderRadius:rs.borderRadius,borderTopWidth:rs.borderTopWidth,borderTopColor:rs.borderTopColor,backgroundColor:rs.backgroundColor,backdropFilter:rs.backdropFilter||rs.webkitBackdropFilter||'none',transitionDuration:rs.transitionDuration,paddingTop:rs.paddingTop,paddingRight:rs.paddingRight,paddingBottom:rs.paddingBottom,paddingLeft:rs.paddingLeft,titleSize:ts.fontSize,titleWeight:ts.fontWeight,titleLineHeight:ts.lineHeight,copySize:cs.fontSize};
  });
  for(const key of ['borderRadius','borderTopWidth','borderTopColor','backgroundColor','backdropFilter','paddingTop','paddingRight','paddingBottom','paddingLeft','titleSize','titleWeight','titleLineHeight','copySize']){
    assert(brandCard[key]===fnbCard[key],`Brand card ${key} diverges from F&B: ${brandCard[key]} vs ${fnbCard[key]}`);
  }
  assert(brandCard.backgroundColor==='rgba(46, 39, 59, 0.48)',`Brand card is not using rendered F&B surface ${brandCard.backgroundColor}`);
  assert(brandCard.backdropFilter==='none',`Brand card still uses blur ${brandCard.backdropFilter}`);
  await page.screenshot({path:path.join(OUT_DIR,'brand-fnb-card-parity-390x844.png'),fullPage:false});

  await page.locator('.brand-card').nth(1).click();await page.waitForURL(url=>url.pathname==='/hotel-factsheet');await page.waitForSelector('.factsheet-route');await page.waitForSelector('#app-footer [data-shell-context="factsheet"]');await page.waitForTimeout(420);
  const headings=await page.evaluate(()=>({
    major:[document.querySelector('.factsheet-hero h1'),...document.querySelectorAll('.factsheet-section-head h2')].filter(Boolean).map(node=>({text:node.textContent.trim(),weight:getComputedStyle(node).fontWeight})),
    cardWeights:[...document.querySelectorAll('.factsheet-card h3,.factsheet-room-card-copy strong,.factsheet-disclosure summary strong')].map(node=>getComputedStyle(node).fontWeight)
  }));
  const expectedMajor=['Hotel Factsheet','Hotel at a Glance','Rooms & Suites','Dining','Facilities & Guest Experience','Meetings & Events','Location & Contacts'];
  assert(headings.major.map(x=>x.text).join('|')===expectedMajor.join('|'),`Factsheet major titles mismatch ${JSON.stringify(headings.major)}`);
  assert(headings.major.every(x=>weight(x.weight)>=400),`Factsheet major title is thin ${JSON.stringify(headings.major)}`);
  assert(headings.cardWeights.every(value=>weight(value)>=400),`Factsheet card/disclosure title is thin ${JSON.stringify(headings.cardWeights)}`);

  const sections=[['overview','Overview'],['stay','Stay'],['dine','Dine'],['facilities','Facilities'],['meet','Meet'],['access','Access']];
  const initial=await page.evaluate(()=>{
    const rail=document.querySelector('#app-footer [data-shell-context="factsheet"]'),first=rail?.querySelector('[data-factsheet-section-nav="overview"]');
    if(!rail||!first)return null;const rr=rail.getBoundingClientRect(),fr=first.getBoundingClientRect(),pad=parseFloat(getComputedStyle(rail).paddingLeft)||0;
    return {paddingLeft:pad,relativeLeft:fr.left-rr.left,scrollLeft:rail.scrollLeft,labels:[...rail.querySelectorAll('[data-factsheet-section-nav]')].map(x=>x.textContent.trim())};
  });
  assert(initial,'Factsheet second footer missing');
  assert(initial.labels.join('|')===sections.map(x=>x[1]).join('|'),`Footer labels do not match sections ${initial.labels}`);
  assert(Math.abs(initial.relativeLeft-initial.paddingLeft)<=1.5,`First footer chip does not respect live edge inset ${JSON.stringify(initial)}`);
  assert(initial.paddingLeft>=10,`Factsheet footer left inset is too small ${initial.paddingLeft}`);

  const navigation=[];
  for(const [id,label] of sections){
    const shell=`#app-footer [data-factsheet-section-nav="${id}"]`;
    await page.locator(shell).click();
    await page.waitForFunction(id=>{
      const shell=document.querySelector(`#app-footer [data-factsheet-section-nav="${id}"]`),source=document.querySelector(`#route-view [data-factsheet-section="${id}"]`),target=document.querySelector(`[data-factsheet-section-target="${id}"]`);
      if(!shell||!source||!target)return false;
      const rect=target.getBoundingClientRect();
      return shell.hasAttribute('aria-current')&&source.classList.contains('is-active')&&rect.top<innerHeight*.42&&rect.bottom>0;
    },id,{timeout:10000});
    await page.waitForTimeout(700);
    const state=await page.evaluate(({id,label})=>{
      const rail=document.querySelector('#app-footer [data-shell-context="factsheet"]'),shell=document.querySelector(`#app-footer [data-factsheet-section-nav="${id}"]`),source=document.querySelector(`#route-view [data-factsheet-section="${id}"]`),target=document.querySelector(`[data-factsheet-section-target="${id}"]`);
      const rr=rail.getBoundingClientRect(),cr=shell.getBoundingClientRect(),pad=parseFloat(getComputedStyle(rail).paddingLeft)||0;
      return {id,label,shellLabel:shell.textContent.trim(),sourceLabel:source.textContent.trim(),active:shell.hasAttribute('aria-current'),sourceActive:source.classList.contains('is-active'),relativeLeft:cr.left-rr.left,paddingLeft:pad,scrollLeft:rail.scrollLeft,targetId:target.dataset.factsheetSectionTarget,targetTop:target.getBoundingClientRect().top};
    },{id,label});
    assert(state.shellLabel===label&&state.sourceLabel===label,`${id}: cloned chip/source label mismatch ${JSON.stringify(state)}`);
    assert(state.targetId===id&&state.active&&state.sourceActive,`${id}: chip is not linked to matching section ${JSON.stringify(state)}`);
    assert(Math.abs(state.relativeLeft-state.paddingLeft)<=3,`${id}: active chip did not become first visible chip ${JSON.stringify(state)}`);
    navigation.push(state);
    if(id==='meet'||id==='access')await page.screenshot({path:path.join(OUT_DIR,`factsheet-footer-${id}-390x844.png`),fullPage:false});
  }

  const relevantErrors=errors.filter(e=>/brand|factsheet|fnb|footer/i.test(e.url||'')||/brand|factsheet|fnb|footer/i.test(e.text||''));
  assert(relevantErrors.length===0,`Navigation/card browser errors ${JSON.stringify(relevantErrors[0])}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,fnbCard,brandCard,headings,navigation,relevantErrors}));
}finally{
  await context.close();await browser.close();
}
