import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-glass-preview';
const CI_FILTER='blur(18px) saturate(1.18)';
await fs.mkdir(OUT_DIR,{recursive:true});
const assert=(value,message)=>{if(!value)throw new Error(message)};

const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'CI Developer',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=3');
`;

function normalizedFilter(value){return String(value||'none').replace(/\s+/g,' ').trim()}
function hasNoBlur(value){return !/blur\((?!0(?:px)?\))/i.test(String(value||''))}

async function runViewport(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=430,hasTouch:width<=430,reducedMotion:'no-preference',serviceWorkers:'block'});
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  try{
    await page.goto(`${BASE_URL}/ci`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.ci-route');
    await page.waitForFunction(()=>window.SindhornUiLibrary?.version==='1.3.0-preview');
    await page.waitForSelector('#ci-glass');
    const report=await page.evaluate(()=>{
      const routeView=document.getElementById('route-view');
      if(!routeView)throw new Error('route-view unavailable');
      const probes=document.createElement('div');
      probes.className='ci-route';
      probes.style.cssText='position:fixed;left:-10000px;top:0;width:390px;visibility:hidden;pointer-events:none';
      probes.innerHTML=`
        <article class="fnb-card" data-probe="fnb-card"></article>
        <button class="fnb-chip" data-probe="fnb-chip">Chip</button>
        <button class="app-back-control" data-probe="back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
        <button class="settings-primary" data-probe="primary">Primary</button>
        <button class="fnb-select-trigger" data-probe="select">Select</button>
        <article class="factsheet-room-card" data-probe="room"></article>
        <figure class="factsheet-picture" data-probe="picture"></figure>
        <div class="ci-status" data-probe="ci-status"></div>
        <nav class="ci-index"><button data-probe="ci-index">Index</button></nav>
        <button class="fnb-expand" data-probe="expand">Show full</button>
        <button class="fnb-action" data-probe="folder">View artwork folder</button>
        <button class="action message-clear" data-probe="message">Clear all</button>
        <button class="settings-add" data-probe="add">Add employee</button>
        <article class="settings-planned settings-system-library-card" data-probe="system"></article>
        <button class="fnb-chip ci-betta-period-chip" data-betta-period="golden-hour" data-probe="period">Golden Hour</button>
        <button class="app-quiet-action" data-probe="legacy-utility">Back to top</button>
        <button class="app-utility-action" data-probe="utility">Share</button>`;
      routeView.appendChild(probes);
      const read=name=>{const node=probes.querySelector(`[data-probe="${name}"]`),style=getComputedStyle(node);return{name,filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor,border:style.borderTopColor,fontSize:style.fontSize,paddingTop:style.paddingTop,paddingRight:style.paddingRight}};
      const rootStyle=getComputedStyle(document.documentElement);
      const result={
        version:window.SindhornUiLibrary?.version,
        tokens:{surfaceFill:rootStyle.getPropertyValue('--app-glass-surface-fill').trim(),surfaceFilter:rootStyle.getPropertyValue('--app-glass-surface-filter').trim(),controlFilter:rootStyle.getPropertyValue('--app-glass-control-filter').trim()},
        targets:['fnb-card','fnb-chip','back','primary','select','room','picture','ci-status','ci-index','expand','folder','message','add','system'].map(read),
        utilities:['legacy-utility','utility'].map(read),
        periodChip:read('period'),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
      probes.remove();
      return result;
    });
    assert(report.version==='1.3.0-preview',`${width}: CI registry unavailable`);
    assert(report.tokens.surfaceFill==='rgba(46,39,59,.48)',`${width}: CI surface token drift ${JSON.stringify(report.tokens)}`);
    assert(normalizedFilter(report.tokens.surfaceFilter)===CI_FILTER,`${width}: CI surface-filter token drift ${JSON.stringify(report.tokens)}`);
    assert(normalizedFilter(report.tokens.controlFilter)===CI_FILTER,`${width}: CI control-filter token drift ${JSON.stringify(report.tokens)}`);
    assert(report.overflow<=1,`${width}: horizontal overflow ${report.overflow}`);
    for(const target of report.targets)assert(normalizedFilter(target.filter)===CI_FILTER,`${width}: ${target.name} is not using the CI blur recipe (${target.filter})`);
    for(const utility of report.utilities){assert(hasNoBlur(utility.filter),`${width}: ${utility.name} unexpectedly blurs (${utility.filter})`);assert(utility.background==='rgba(0, 0, 0, 0)',`${width}: ${utility.name} painted background ${utility.background}`);assert(utility.fontSize==='12px',`${width}: ${utility.name} font ${utility.fontSize}`)}
    assert(report.periodChip.fontSize==='12px',`${width}: Betta period chip font ${report.periodChip.fontSize}`);
    if(width<=430)assert(report.periodChip.paddingTop==='7px'&&report.periodChip.paddingRight==='10px',`${width}: mobile Betta period chip padding ${JSON.stringify(report.periodChip)}`);
    assert(errors.length===0,`${width}: browser error ${errors[0]}`);
    if(width===390){
      await page.evaluate(()=>document.getElementById('ci-glass')?.scrollIntoView({block:'start',behavior:'auto'}));
      await page.waitForTimeout(160);
      await page.screenshot({path:path.join(OUT_DIR,'ci-glass-390x844.png'),fullPage:false});
      await page.evaluate(()=>document.querySelector('[data-ci-top]')?.scrollIntoView({block:'center',behavior:'auto'}));
      await page.waitForTimeout(120);
      await page.screenshot({path:path.join(OUT_DIR,'ci-utility-actions-390x844.png'),fullPage:false});
    }
    return report;
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const mobile=await runViewport(browser,390,844);
  const tablet=await runViewport(browser,768,1024);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,ciAuthority:CI_FILTER,mobile,tablet,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
