import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/app-control-standard';
await fs.mkdir(OUT_DIR,{recursive:true});
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Control Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function waitForShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
}
async function recipe(page,selector){
  return page.$eval(selector,node=>{const s=getComputedStyle(node),svg=node.querySelector('svg');return{
    width:s.width,height:s.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,
    background:s.backgroundColor,border:s.borderTopColor,display:s.display,iconWidth:svg?getComputedStyle(svg).width:''
  }});
}
function assertRoundedSquare(value,label){
  assert(value.width==='36px'&&value.height==='36px'&&value.minWidth==='36px'&&value.minHeight==='36px',`${label}: size mismatch ${JSON.stringify(value)}`);
  assert(value.radius==='12px',`${label}: radius mismatch ${JSON.stringify(value)}`);
  assert(value.background==='rgba(46, 39, 59, 0.55)'&&value.border==='rgba(250, 247, 245, 0.14)',`${label}: surface mismatch ${JSON.stringify(value)}`);
  assert(value.iconWidth==='16px',`${label}: icon mismatch ${JSON.stringify(value)}`);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(35000);
const errors=[];
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_fnb_*',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});

try{
  await page.goto(`${BASE_URL}/fnb`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.fnb-card');
  await page.locator('.fnb-card-button').first().click();await page.waitForSelector('.fnb-back');await page.waitForTimeout(220);
  const fnb=await recipe(page,'.fnb-back');assertRoundedSquare(fnb,'F&B');
  await page.screenshot({path:path.join(OUT_DIR,'fnb-rounded-square-390x844.png'),fullPage:false});

  await page.goto(`${BASE_URL}/ihg-history`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.ihg-history-route .app-back-control');await page.waitForTimeout(180);
  const history=await recipe(page,'.ihg-history-route .app-back-control');assertRoundedSquare(history,'History');
  assert(await page.locator('.ihg-history-route [data-route-back-to-top]').count()===1,'History Back to top missing');
  await page.screenshot({path:path.join(OUT_DIR,'history-rounded-square-390x844.png'),fullPage:false});
  await page.evaluate(()=>{window.__controlShell={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')};});
  await page.locator('.ihg-history-route .app-back-control').click();await page.waitForURL(url=>url.pathname==='/brand');await page.waitForSelector('.brand-route');
  assert(await page.evaluate(()=>window.__controlShell.header===document.getElementById('app-header')&&window.__controlShell.footer===document.getElementById('app-footer')&&window.__controlShell.atmosphere===document.getElementById('environmentStage')),'History back replaced persistent shell');

  await page.goto(`${BASE_URL}/hotel-factsheet`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.factsheet-route .app-back-control');await page.waitForTimeout(180);
  const factsheet=await recipe(page,'.factsheet-route .app-back-control');assertRoundedSquare(factsheet,'Factsheet');
  assert(await page.locator('.factsheet-route [data-route-back-to-top]').count()===1,'Factsheet Back to top missing');
  await page.screenshot({path:path.join(OUT_DIR,'factsheet-rounded-square-390x844.png'),fullPage:false});

  assert(JSON.stringify(fnb)===JSON.stringify(history)&&JSON.stringify(history)===JSON.stringify(factsheet),`Back controls are not identical ${JSON.stringify({fnb,history,factsheet})}`);
  const token=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--app-back-radius').trim());
  assert(token==='12px',`Central radius token mismatch ${token}`);
  const relevantErrors=errors.filter(text=>/control|fnb|history|factsheet|route/i.test(text));
  assert(relevantErrors.length===0,`Relevant browser errors ${JSON.stringify(relevantErrors)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,centralRadius:token,fnb,history,factsheet,shellStable:true,relevantErrors}));
}finally{
  await context.close();await browser.close();
}
