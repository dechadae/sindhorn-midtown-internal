import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-glass-preview';
await fs.mkdir(OUT_DIR,{recursive:true});
const assert=(value,message)=>{if(!value)throw new Error(message)};

const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'CI Developer',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=2');
`;

function includesBlur(value){return /blur\((?!0(?:px)?\))/i.test(String(value||''))}

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
    await page.waitForSelector('#ci-glass');
    await page.waitForFunction(()=>window.SindhornUiLibrary?.version==='1.3.0-preview');
    await page.waitForFunction(()=>document.querySelector('[data-ci-status-title]')?.textContent.trim()==='Design system status · PASS'&&document.querySelector('[data-ci-status-count]')?.textContent.trim()==='19/19');
    const report=await page.evaluate(()=>{
      const read=selector=>{const node=document.querySelector(selector);if(!node)return{selector,missing:true,filter:'none'};const style=getComputedStyle(node);return{selector,missing:false,filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor}};
      const probeHost=document.getElementById('route-view');
      if(!probeHost)throw new Error('route-view unavailable');
      const probes=document.createElement('div');
      probes.className='ci-route';
      probes.hidden=true;
      probes.innerHTML='<button class="fnb-expand" data-audit-expand>Show full</button><button class="fnb-action" data-audit-folder>View artwork folder</button><button class="action message-clear" data-audit-message>Clear all</button><button class="settings-add" data-audit-add>Add employee</button><article class="settings-planned settings-system-library-card" data-audit-system>System</article><button class="fnb-chip ci-betta-period-chip" data-audit-period>Golden Hour</button>';
      probeHost.appendChild(probes);
      const period=probes.querySelector('[data-audit-period]');
      const periodStyle=getComputedStyle(period);
      const result={
        version:window.SindhornUiLibrary?.version,
        sections:document.querySelectorAll('.ci-section').length,
        status:document.querySelector('[data-ci-status-title]')?.textContent.trim(),
        count:document.querySelector('[data-ci-status-count]')?.textContent.trim(),
        targets:[
          read('#ci-surfaces .fnb-card'),
          read('#ci-selectors .fnb-chip'),
          read('#ci-actions .app-back-control'),
          read('#ci-actions .app-quiet-action'),
          read('#ci-actions .settings-primary:not(:disabled)'),
          read('#ci-selectors .fnb-select-trigger'),
          read('#ci-disclosures .factsheet-room-card'),
          read('[data-ci-glass-picture]'),
          read('.ci-status'),
          read('.ci-index button'),
          read('[data-audit-expand]'),
          read('[data-audit-folder]'),
          read('[data-audit-message]'),
          read('[data-audit-add]'),
          read('[data-audit-system]')
        ],
        periodChip:{fontSize:periodStyle.fontSize,paddingTop:periodStyle.paddingTop,paddingRight:periodStyle.paddingRight},
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
      probes.remove();
      return result;
    });
    assert(report.sections===19,`${width}: expected 19 CI sections, got ${report.sections}`);
    assert(report.status==='Design system status · PASS'&&report.count==='19/19',`${width}: CI status ${JSON.stringify(report)}`);
    assert(report.overflow<=1,`${width}: horizontal overflow ${report.overflow}`);
    for(const target of report.targets){assert(!target.missing,`${width}: missing ${target.selector}`);assert(includesBlur(target.filter),`${width}: ${target.selector} has no blur (${target.filter})`)}
    assert(report.periodChip.fontSize==='12px',`${width}: Betta period chip font ${report.periodChip.fontSize}`);
    if(width<=430){assert(report.periodChip.paddingTop==='7px'&&report.periodChip.paddingRight==='10px',`${width}: mobile Betta period chip padding ${JSON.stringify(report.periodChip)}`)}
    assert(errors.length===0,`${width}: browser error ${errors[0]}`);
    if(width===390){
      await page.waitForFunction(()=>Boolean(document.getElementById('ci-glass')));
      await page.evaluate(()=>document.getElementById('ci-glass')?.scrollIntoView({block:'start',behavior:'auto'}));
      await page.waitForTimeout(180);
      await page.screenshot({path:path.join(OUT_DIR,'ci-glass-390x844.png'),fullPage:false});
      await page.evaluate(()=>document.querySelector('[data-ci-betta-day-cycle]')?.scrollIntoView({block:'center',behavior:'auto'}));
      await page.waitForTimeout(120);
      await page.screenshot({path:path.join(OUT_DIR,'ci-betta-chips-390x844.png'),fullPage:false});
    }
    return report;
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const mobile=await runViewport(browser,390,844);
  const tablet=await runViewport(browser,768,1024);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,mobile,tablet,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
