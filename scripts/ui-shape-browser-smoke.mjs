import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const SCREENSHOT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-library-preview';
await mkdir(SCREENSHOT_DIR,{recursive:true});
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Shape Audit',departmentName:'Marketing Communications',positionTitle:'Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',renderer:'system',sortOrder:40,config:{}}]};
const authShim=`window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Shape Audit',pin_configured_at:new Date().toISOString()};await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});await import('/bootstrap.js');`;

async function harness(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(25000);
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
  return{context,page};
}
async function shell(page){await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');await page.waitForSelector('#app-header .masthead-tools');await page.waitForSelector('#app-footer .app-tabbar')}
async function ensureHeaderAvatar(page){
  await page.evaluate(()=>{
    const tools=document.querySelector('#app-header .masthead-tools');if(!tools)return;
    document.querySelector('[data-shape-audit-avatar]')?.remove();
    const avatar=document.createElement('span');avatar.className='masthead-user-avatar';avatar.dataset.shapeAuditAvatar='';avatar.textContent='SA';avatar.setAttribute('aria-hidden','true');tools.appendChild(avatar);
  });
  await page.waitForSelector('[data-shape-audit-avatar]',{state:'visible'});
}
async function ensureSettingsAvatar(page){
  await page.evaluate(()=>{
    document.querySelector('[data-shape-audit-settings-avatar]')?.remove();
    const avatar=document.createElement('div');avatar.className='settings-avatar';avatar.dataset.shapeAuditSettingsAvatar='';avatar.textContent='SA';avatar.setAttribute('aria-hidden','true');
    avatar.style.width='48px';avatar.style.height='48px';
    document.body.appendChild(avatar);
  });
  await page.waitForSelector('[data-shape-audit-settings-avatar]',{state:'attached'});
}
async function style(page,selector,{visible=false}={}){
  const resolvedSelector=visible?`${selector}:visible`:selector;
  if(visible)await page.waitForSelector(resolvedSelector,{state:'visible'});else await page.waitForSelector(resolvedSelector,{state:'attached'});
  return page.locator(resolvedSelector).first().evaluate((node,sel)=>{const s=getComputedStyle(node),r=node.getBoundingClientRect(),radius=parseFloat(s.borderTopLeftRadius)||0,width=r.width||parseFloat(s.width)||0,height=r.height||parseFloat(s.height)||0;return{selector:sel,width,height,radius,radiusText:s.borderRadius,display:s.display,visibility:s.visibility}},selector);
}
function rounded(item,label,maxRatio=.45){const min=Math.min(item.width||1,item.height||1);assert(item.radius<min*maxRatio,`${label} still reads as circular/pill: ${JSON.stringify(item)}`);return item}
function exact(item,label,radius){assert(Math.abs(item.radius-radius)<.6,`${label} radius expected ${radius}px: ${JSON.stringify(item)}`);return item}

const browser=await chromium.launch({headless:true});
const {context,page}=await harness(browser);
const report={};
try{
  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForTimeout(250);await ensureHeaderAvatar(page);
  report.headerAvatar=exact(await style(page,'[data-shape-audit-avatar]',{visible:true}),'Header avatar',12);
  report.footer=exact(await style(page,'#app-footer .app-tabbar .nav-chip',{visible:true}),'Main footer item',13);
  report.connection=exact(await style(page,'.connection-dot',{visible:true}),'Connection indicator',2);
  await page.screenshot({path:`${SCREENSHOT_DIR}/shape-today-390x844.png`,fullPage:false});

  await page.goto(`${BASE_URL}/fnb`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.fnb-card');
  report.fnbChip=exact(await style(page,'.fnb-chip',{visible:true}),'F&B source chip',9);
  await page.locator('.fnb-card-button').first().click();await page.waitForSelector('.fnb-back',{state:'visible'});
  report.fnbBack=exact(await style(page,'.fnb-back',{visible:true}),'F&B back',12);

  await page.goto(`${BASE_URL}/hotel-factsheet`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.factsheet-route');
  report.nearby=exact(await style(page,'.factsheet-nearby span',{visible:true}),'Factsheet metadata',9);

  await page.goto(`${BASE_URL}/settings`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.settings-route');await ensureSettingsAvatar(page);
  report.settingsAvatar=exact(await style(page,'[data-shape-audit-settings-avatar]'),'Settings avatar',12);
  await page.screenshot({path:`${SCREENSHOT_DIR}/shape-settings-390x844.png`,fullPage:false});

  await page.goto(`${BASE_URL}/ci`,{waitUntil:'domcontentloaded'});await shell(page);await page.waitForSelector('.ci-route');
  report.ciStatus=exact(await style(page,'.ci-status-dot',{visible:true}),'CI status indicator',2);
  report.ciChip=exact(await style(page,'.ci-chip-row .fnb-chip',{visible:true}),'CI chip specimen',9);
  await page.locator('#ci-selectors').scrollIntoViewIfNeeded();await page.waitForTimeout(120);
  await page.screenshot({path:`${SCREENSHOT_DIR}/shape-ci-chips-390x844.png`,fullPage:false});

  const central=await (await context.request.get(`${BASE_URL}/app-shapes.css?v=1`)).text();
  assert(central.includes('--app-radius-avatar:12px')&&central.includes('--app-radius-chip:9px'),'Shape tokens missing from central authority');
  assert(!/border-radius\s*:\s*(50%|999(?:9)?px)/i.test(central),'Central shape authority reintroduced a circle/pill');
  Object.entries(report).forEach(([label,item])=>rounded(item,label,.49));
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,report,screenshots:['shape-today-390x844.png','shape-settings-390x844.png','shape-ci-chips-390x844.png']}));
}finally{await context.close();await browser.close()}
