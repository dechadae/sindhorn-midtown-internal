import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-glass-preview';
const CI_FILTER='blur(18px) saturate(1.18)';
const CI_FILL='rgba(46, 39, 59, 0.3)';
await fs.mkdir(OUT_DIR,{recursive:true});
const assert=(value,message)=>{if(!value)throw new Error(message)};

const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'CI Developer',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=4');
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
    await page.waitForFunction(()=>window.SindhornUiLibrary?.version==='1.4.0-preview');
    await page.waitForSelector('#ci-glass');
    await page.waitForSelector('.masthead.app-glass-surface');
    await page.waitForSelector('.app-tabbar.app-glass-surface,.shell-footer-rail.app-glass-surface');
    const report=await page.evaluate(()=>{
      const routeView=document.getElementById('route-view');
      if(!routeView)throw new Error('route-view unavailable');
      const probes=document.createElement('div');
      probes.className='ci-route';
      probes.style.cssText='position:fixed;left:-10000px;top:0;width:390px;visibility:hidden;pointer-events:none';
      probes.innerHTML=`
        <div class="ci-status app-glass-surface" data-probe="ci-status"></div>
        <article class="ci-specimen" data-probe="ci-specimen"></article>
        <article class="ci-token app-glass-surface" data-probe="ci-token"></article>
        <figure class="ci-image-demo app-glass-surface" data-probe="ci-image"></figure>
        <nav class="ci-index"><button class="app-glass-control" data-probe="ci-index">Index</button></nav>
        <button class="ci-primary app-glass-control" data-probe="ci-primary">Primary</button>
        <button class="fnb-chip ci-betta-period-chip app-glass-control" data-betta-period="golden-hour" data-probe="period">Golden Hour</button>
        <button class="app-quiet-action" data-probe="legacy-utility">Back to top</button>
        <button class="app-utility-action" data-probe="utility">Share</button>`;
      routeView.appendChild(probes);
      const readNode=node=>{const style=getComputedStyle(node);return{filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor,border:style.borderTopColor,fontSize:style.fontSize,paddingTop:style.paddingTop,paddingRight:style.paddingRight}};
      const read=name=>({name,...readNode(probes.querySelector(`[data-probe="${name}"]`))});
      const rootStyle=getComputedStyle(document.documentElement);
      const header=document.querySelector('.masthead');
      const footer=document.querySelector('.app-tabbar,.shell-footer-rail');
      const result={
        version:window.SindhornUiLibrary?.version,
        tokens:{fill:rootStyle.getPropertyValue('--app-glass-fill').trim(),filter:rootStyle.getPropertyValue('--app-glass-filter').trim()},
        shell:{header:readNode(header),footer:readNode(footer),headerClass:header.classList.contains('app-glass-surface'),footerClass:footer.classList.contains('app-glass-surface')},
        surfaces:['ci-status','ci-token','ci-image'].map(read),
          specimenFrame:read('ci-specimen'),
        controls:['ci-index','ci-primary'].map(read),
        utilities:['legacy-utility','utility'].map(read),
        periodChip:read('period'),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
      probes.remove();
      return result;
    });
    assert(report.version==='1.4.0-preview',`${width}: CI registry unavailable`);
    assert(report.tokens.fill==='rgba(46,39,59,.30)',`${width}: CI fill token drift ${JSON.stringify(report.tokens)}`);
    assert(normalizedFilter(report.tokens.filter)===CI_FILTER,`${width}: CI filter token drift ${JSON.stringify(report.tokens)}`);
    assert(report.overflow<=1,`${width}: horizontal overflow ${report.overflow}`);
    for(const target of [...report.surfaces,...report.controls]){assert(normalizedFilter(target.filter)===CI_FILTER,`${width}: ${target.name} is not using CI blur (${target.filter})`);assert(target.background===CI_FILL,`${width}: ${target.name} fill ${target.background}`)}
      assert(hasNoBlur(report.specimenFrame.filter),`${width}: ci-specimen is a demo frame and must not blur (${report.specimenFrame.filter})`);
      assert(report.specimenFrame.background==='rgba(0, 0, 0, 0)',`${width}: ci-specimen frame must stay unpainted so specimens inside touch the atmosphere (${report.specimenFrame.background})`);
    for(const [name,target] of Object.entries({header:report.shell.header,footer:report.shell.footer})){assert(normalizedFilter(target.filter)===CI_FILTER,`${width}: ${name} filter ${target.filter}`);assert(target.background===CI_FILL,`${width}: ${name} fill ${target.background}`)}
    assert(report.shell.headerClass&&report.shell.footerClass,`${width}: persistent shell not assigned canonical glass classes`);
    for(const utility of report.utilities){assert(hasNoBlur(utility.filter),`${width}: ${utility.name} unexpectedly blurs (${utility.filter})`);assert(utility.background==='rgba(0, 0, 0, 0)',`${width}: ${utility.name} painted background ${utility.background}`);assert(utility.fontSize==='12px',`${width}: ${utility.name} font ${utility.fontSize}`)}
    assert(normalizedFilter(report.periodChip.filter)===CI_FILTER,`${width}: Betta period chip filter ${report.periodChip.filter}`);
    assert(report.periodChip.fontSize==='12px',`${width}: Betta period chip font ${report.periodChip.fontSize}`);
    if(width<=430)assert(report.periodChip.paddingTop==='7px'&&report.periodChip.paddingRight==='10px',`${width}: mobile Betta period chip padding ${JSON.stringify(report.periodChip)}`);
    assert(errors.length===0,`${width}: browser error ${errors[0]}`);
    if(width===390){
      await page.evaluate(()=>document.getElementById('ci-glass')?.scrollIntoView({block:'start',behavior:'auto'}));
      await page.waitForTimeout(160);
      await page.screenshot({path:path.join(OUT_DIR,'ci-glass-390x844.png'),fullPage:false});
      await page.screenshot({path:path.join(OUT_DIR,'ci-shell-glass-390x844.png'),fullPage:false});
    }
    return report;
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const mobile=await runViewport(browser,390,844);
  const tablet=await runViewport(browser,768,1024);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,ciAuthority:{fill:CI_FILL,filter:CI_FILTER},mobile,tablet,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
