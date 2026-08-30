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
async function waitForShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
}
async function controlSnapshot(page,routeSelector){
  return page.evaluate(selector=>{
    const route=document.querySelector(selector),back=route?.querySelector('.route-back-control'),top=route?.querySelector('.route-quiet-action');
    const bs=back?getComputedStyle(back):null,ts=top?getComputedStyle(top):null,bi=back?.querySelector('svg'),ti=top?.querySelector('svg');
    return {
      backCount:route?.querySelectorAll('.route-back-control').length||0,
      topCount:route?.querySelectorAll('.route-quiet-action').length||0,
      backHref:back?.getAttribute('href')||'',backRoute:back?.dataset.appRoute||'',
      back:{width:bs?.width,height:bs?.height,radius:bs?.borderRadius,marginBottom:bs?.marginBottom,background:bs?.backgroundColor,border:bs?.borderTopColor,iconWidth:bi?getComputedStyle(bi).width:''},
      top:{height:ts?.height,minHeight:ts?.minHeight,fontSize:ts?.fontSize,fontWeight:ts?.fontWeight,color:ts?.color,background:ts?.backgroundColor,iconWidth:ti?getComputedStyle(ti).width:''},
      topText:top?.textContent.trim()||''
    };
  },routeSelector);
}
function assertRecipe(value,label){
  assert(value.backCount===1&&value.topCount===1,`${label}: controls missing/duplicated ${JSON.stringify(value)}`);
  assert(value.backHref==='/brand'&&value.backRoute==='brand',`${label}: back route mismatch`);
  assert(value.back.width==='36px'&&value.back.height==='36px'&&value.back.radius==='12px'&&value.back.marginBottom==='16px'&&value.back.iconWidth==='16px',`${label}: F&B back recipe mismatch ${JSON.stringify(value.back)}`);
  assert(value.top.height==='36px'&&value.top.minHeight==='36px'&&value.top.fontSize==='12px'&&value.top.fontWeight==='400'&&value.top.iconWidth==='15px'&&value.topText==='Back to top',`${label}: Share-style top recipe mismatch ${JSON.stringify(value.top)}`);
}
async function exerciseTop(page,routeSelector,label,screenshot){
  const top=page.locator(`${routeSelector} [data-route-back-to-top]`);
  await top.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  const visible=await top.evaluate(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight});
  assert(visible,`${label}: Back to top is not visible at the actual page end`);
  assert((await page.evaluate(()=>window.scrollY))>100,`${label}: page did not scroll to the end action`);
  if(screenshot)await page.screenshot({path:path.join(OUT_DIR,screenshot),fullPage:false});
  await top.click();
  await page.waitForFunction(()=>window.scrollY<5,{timeout:5000});
  assert((await page.evaluate(()=>window.scrollY))<5,`${label}: Back to top did not reach top`);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
const errors=[];
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/share/fnb-public-data.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const FNB_PUBLIC_DATA=[]; export default [];'}));
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});

try{
  await page.goto(`${BASE_URL}/ihg-history`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.ihg-history-route .route-back-control');
  await page.evaluate(()=>{window.__controlsRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')};});
  const history=await controlSnapshot(page,'.ihg-history-route');assertRecipe(history,'History');
  await page.screenshot({path:path.join(OUT_DIR,'history-back-control-390x844.png'),fullPage:false});
  await exerciseTop(page,'.ihg-history-route','History','history-back-to-top-390x844.png');
  await page.locator('.ihg-history-route .route-back-control').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-route');
  assert(await page.evaluate(()=>window.__controlsRefs.header===document.getElementById('app-header')&&window.__controlsRefs.footer===document.getElementById('app-footer')&&window.__controlsRefs.atmosphere===document.getElementById('environmentStage')),'History back replaced persistent shell');

  await page.locator('.brand-card').nth(1).click();await page.waitForURL(url=>url.pathname==='/hotel-factsheet');await page.waitForSelector('.factsheet-route .route-back-control');
  const factsheet=await controlSnapshot(page,'.factsheet-route');assertRecipe(factsheet,'Factsheet');
  await page.screenshot({path:path.join(OUT_DIR,'factsheet-back-control-390x844.png'),fullPage:false});
  await exerciseTop(page,'.factsheet-route','Factsheet','factsheet-back-to-top-390x844.png');
  await page.locator('.factsheet-route .route-back-control').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-route');
  assert(await page.evaluate(()=>window.__controlsRefs.header===document.getElementById('app-header')&&window.__controlsRefs.footer===document.getElementById('app-footer')&&window.__controlsRefs.atmosphere===document.getElementById('environmentStage')),'Factsheet back replaced persistent shell');

  const relevantErrors=errors.filter(text=>/brand|history|factsheet|route|footer/i.test(text));
  assert(relevantErrors.length===0,`Control browser errors ${JSON.stringify(relevantErrors)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,history,factsheet,shellStable:true,relevantErrors}));
}finally{
  await context.close();await browser.close();
}
