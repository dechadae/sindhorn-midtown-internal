import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/app-ci-parity';
await mkdir(OUT_DIR,{recursive:true});
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Parity Developer',departmentName:'Marketing Communications',positionTitle:'Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',renderer:'system',sortOrder:40,config:{}}]};
const authShim=`window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Parity Developer',pin_configured_at:new Date().toISOString()};await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});await import('/bootstrap.js');`;
const ROUTES=[
  {key:'today',path:'/',selector:'.report'},
  {key:'fnb',path:'/fnb',selector:'.fnb-route'},
  {key:'messages',path:'/messages',selector:'#messageList'},
  {key:'brand',path:'/brand',selector:'.brand-route'},
  {key:'ihgHistory',path:'/ihg-history',selector:'.ihg-history-route'},
  {key:'hotelFactsheet',path:'/hotel-factsheet',selector:'.factsheet-route'},
  {key:'settings',path:'/settings',selector:'.settings-route'},
  {key:'ci',path:'/ci',selector:'.ci-route'}
];
const NATURAL=/sun|moon|celestial|star|cloud|rain|weather|atmosphere|sky|solar|lunar|scale-track/i;

async function harness(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=430,hasTouch:width<=430,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[];
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  return{context,page,errors};
}
async function shell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
}
async function noOverflow(page,label){
  const size=await page.evaluate(()=>({root:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth}));
  assert(size.root<=size.client+1&&size.body<=size.client+1,`${label}: horizontal overflow ${JSON.stringify(size)}`);
}
async function footer(page,label){
  const labels=await page.locator('#app-footer .app-tabbar .nav-chip span').allTextContents();
  assert(labels.map(x=>x.trim()).join('|')==='Today|F&B|Messages|Brand',`${label}: footer drift ${JSON.stringify(labels)}`);
}
async function radiusAudit(page,label){
  const violations=await page.evaluate(naturalSource=>{
    const natural=new RegExp(naturalSource,'i');
    return [...document.querySelectorAll('body *')].flatMap(node=>{
      if(!(node instanceof HTMLElement)||natural.test(node.className||'')||node.closest('.environment-stage'))return[];
      const s=getComputedStyle(node),r=node.getBoundingClientRect();
      if(r.width<5||r.height<5||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)===0)return[];
      const radius=parseFloat(s.borderTopLeftRadius)||0,min=Math.min(r.width,r.height);
      if(radius>80||(min<=80&&radius>=min*.49))return[{tag:node.tagName,className:String(node.className||''),width:r.width,height:r.height,radius,snippet:(node.textContent||'').trim().slice(0,50)}];
      return[];
    }).slice(0,20);
  },NATURAL.source);
  assert(violations.length===0,`${label}: circular/capsule UI detected ${JSON.stringify(violations)}`);
}
async function routeSnapshot(page,route,width,height){
  await page.goto(`${BASE_URL}${route.path}`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector(route.selector,{state:'attached'});await page.waitForTimeout(320);
  await noOverflow(page,`${route.key} ${width}`);await footer(page,`${route.key} ${width}`);await radiusAudit(page,`${route.key} ${width}`);
  const font=await page.locator('#route-view').evaluate(node=>getComputedStyle(node).fontFamily);
  assert(font.includes('LINE Seed Sans TH'),`${route.key} ${width}: font drift ${font}`);
  if(width===390||route.key==='brand')await page.screenshot({path:`${OUT_DIR}/${route.key}-${width}x${height}.png`,fullPage:false});
}
async function cardParity(page,width){
  await page.goto(`${BASE_URL}/fnb`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.fnb-card .fnb-card-button');await page.waitForTimeout(250);
  const fnb=await page.locator('.fnb-card').first().evaluate(node=>{const s=getComputedStyle(node),button=node.querySelector('.fnb-card-button'),bs=getComputedStyle(button);return{radius:s.borderRadius,padding:bs.padding,outerDuration:s.transitionDuration,innerDuration:bs.transitionDuration}});
  await page.goto(`${BASE_URL}/brand`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.brand-card.app-action-card .app-action-card-control');await page.waitForTimeout(250);
  const brand=await page.locator('.brand-card.app-action-card').first().evaluate(node=>{const s=getComputedStyle(node),control=node.querySelector('.app-action-card-control'),cs=getComputedStyle(control);return{radius:s.borderRadius,padding:cs.padding,outerDuration:s.transitionDuration,innerDuration:cs.transitionDuration,filter:s.backdropFilter||s.webkitBackdropFilter}});
  assert(fnb.radius===brand.radius&&brand.radius==='14px',`${width}: Brand/F&B radius mismatch ${JSON.stringify({fnb,brand})}`);
  assert(fnb.padding===brand.padding,`${width}: Brand/F&B control padding mismatch ${JSON.stringify({fnb,brand})}`);
  assert(brand.outerDuration.includes('0.26s')&&brand.innerDuration.includes('0.16s'),`${width}: semantic card motion mismatch ${JSON.stringify(brand)}`);
  assert(/blur\(18px\)/.test(brand.filter),`${width}: Brand material changed unexpectedly ${JSON.stringify(brand)}`);
  return{fnb,brand};
}
async function persistentShell(browser){
  const {context,page,errors}=await harness(browser,390,844);
  try{
    await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});await shell(page);await page.evaluate(()=>window.__parityRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')});
    for(const route of ['fnb','brand','ihgHistory','hotelFactsheet','messages','settings','ci']){
      await page.evaluate(async key=>{await window.SindhornNavigation.transitionToRoute(key,{historyMode:'replace',scroll:false})},route);
      await page.waitForFunction(key=>document.body.dataset.route===key||document.querySelector(`#route-view[data-shell-route="${key}"]`),route);
      await page.waitForTimeout(320);
      const stable=await page.evaluate(()=>window.__parityRefs.header===document.getElementById('app-header')&&window.__parityRefs.footer===document.getElementById('app-footer')&&window.__parityRefs.atmosphere===document.getElementById('environmentStage'));
      assert(stable,`Persistent shell node replaced while navigating to ${route}`);
    }
    const relevant=errors.filter(x=>/route|brand|ci|settings|footer|action-card/i.test(x));assert(relevant.length===0,`Persistent-shell browser error: ${relevant[0]}`);
    return{stable:true};
  }finally{await context.close()}
}
async function standalone(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();
  try{
    await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.login-page .auth-card');await noOverflow(page,'login 390');await radiusAudit(page,'login 390');
    const loginFont=await page.locator('.auth-card').evaluate(node=>getComputedStyle(node).fontFamily);assert(loginFont.includes('LINE Seed Sans TH'),`Login font drift ${loginFont}`);await page.screenshot({path:`${OUT_DIR}/login-390x844.png`,fullPage:false});
    await page.goto(`${BASE_URL}/business-card.html`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-business-card-root]');await page.waitForTimeout(500);await noOverflow(page,'business card 390');await radiusAudit(page,'business card 390');await page.screenshot({path:`${OUT_DIR}/business-card-390x844.png`,fullPage:false});
    return{login:true,businessCard:true};
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const reports=[];
  for(const [width,height] of [[360,800],[390,844],[768,1024]]){
    const {context,page,errors}=await harness(browser,width,height);
    try{
      for(const route of ROUTES)await routeSnapshot(page,route,width,height);
      const cards=await cardParity(page,width);
      const relevant=errors.filter(x=>/brand|action-card|route|footer|ci|settings/i.test(x));assert(relevant.length===0,`${width}: browser error ${relevant[0]}`);
      reports.push({width,height,cards});
    }finally{await context.close()}
  }
  const shellReport=await persistentShell(browser);const standaloneReport=await standalone(browser);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,reports,shellReport,standaloneReport}));
}finally{await browser.close()}
