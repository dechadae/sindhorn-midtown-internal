import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-library-preview';
await fs.mkdir(OUT_DIR,{recursive:true});
const assert=(value,message)=>{if(!value)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'CI Developer',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(25000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
try{
  await page.goto(`${BASE_URL}/settings?section=system`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  await page.waitForSelector('[data-system-ui-library]');await page.waitForTimeout(220);
  await page.screenshot({path:path.join(OUT_DIR,'developer-system-ui-library-390x844.png'),fullPage:false});
  await page.locator('[data-system-ui-library]').click();await page.waitForURL(url=>url.pathname==='/ci');await page.waitForSelector('.ci-route');await page.waitForFunction(()=>window.SindhornUiLibrary?.version);await page.waitForFunction(()=>document.querySelector('.ci-route .app-route-title')?.textContent.trim()==='Sindhorn Midtown UI Library');await page.waitForTimeout(220);
  await page.evaluate(()=>scrollTo({top:0,behavior:'auto'}));await page.waitForTimeout(80);
  const top=await page.evaluate(()=>({scrollY,heroTop:document.querySelector('.ci-route .app-route-hero')?.getBoundingClientRect().top||0,title:document.querySelector('.ci-route .app-route-title')?.textContent.trim()}));
  assert(top.scrollY===0&&top.title==='Sindhorn Midtown UI Library',`CI top framing failed ${JSON.stringify(top)}`);
  await page.screenshot({path:path.join(OUT_DIR,'ci-top-390x844.png'),fullPage:false});

  for(const [id,file] of [['foundations','ci-foundations-390x844.png'],['actions','ci-actions-390x844.png'],['blueprint','ci-blueprint-390x844.png']]){
    await page.evaluate(sectionId=>document.getElementById(`ci-${sectionId}`)?.scrollIntoView({block:'start',behavior:'auto'}),id);await page.waitForTimeout(90);
    const geometry=await page.evaluate(sectionId=>{const section=document.getElementById(`ci-${sectionId}`),header=document.getElementById('app-header');return{sectionTop:section?.getBoundingClientRect().top||0,headerBottom:header?.getBoundingClientRect().bottom||0,title:section?.querySelector('h2')?.textContent.trim()||''}},id);
    assert(geometry.sectionTop>=geometry.headerBottom-1,`${id} hides behind masthead ${JSON.stringify(geometry)}`);
    await page.screenshot({path:path.join(OUT_DIR,file),fullPage:false});
  }
  assert(errors.length===0,`Visual smoke browser error: ${errors[0]}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await context.close();await browser.close()}
