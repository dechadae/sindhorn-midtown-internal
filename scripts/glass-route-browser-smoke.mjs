import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const CI_FILTER='blur(18px) saturate(1.18)';
const CI_FILL='rgba(46, 39, 59, 0.48)';
const assert=(value,message)=>{if(!value)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Glass Route Preview',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Glass Route Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=3');
`;
const routes=[
  {path:'/',root:'.business-dashboard-route',probe:'bd-metric',name:'Today',checkBackdropRoot:true,waitFor:'link[data-business-dashboard-style]'},
  {path:'/fnb',root:'.fnb-route',probe:'fnb-card',name:'F&B',checkBackdropRoot:true},
  {path:'/settings',root:'.settings-route',probe:'settings-planned',name:'Settings',checkBackdropRoot:true},
  {path:'/brand',root:'.brand-route',probe:'brand-card',name:'Brand'},
  {path:'/hotel-factsheet',root:'.factsheet-route',probe:'factsheet-card',name:'Factsheet'},
  {path:'/ihg-history',root:'.ihg-history-route',probe:'ihg-history-card',name:'IHG History'},
  {path:'/messages',root:'#route-view',probe:'message-card app-glass-surface',name:'Messages',control:'#messageClearBtn'},
  {path:'/ci',root:'.ci-route',probe:'ci-status',name:'CI'}
];
const normalize=value=>String(value||'none').replace(/\s+/g,' ').trim();

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/**',route=>{
  const url=route.request().url();
  route.fulfill({status:200,contentType:'application/json',body:url.includes('sindhorn_settings_manifest')?JSON.stringify(manifest):'[]'});
});
await page.route('**/rest/v1/sindhorn_app_files*',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));

const reports=[];
try{
  for(const spec of routes){
    await page.goto(`${BASE_URL}${spec.path}`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector(spec.root);
    if(spec.waitFor)await page.waitForSelector(spec.waitFor);
    if(spec.control)await page.waitForFunction(selector=>document.querySelector(selector)?.classList.contains('app-glass-control'),spec.control);
    const report=await page.evaluate(({rootSelector,probeClass,checkBackdropRoot,controlSelector})=>{
      const root=document.querySelector(rootSelector);
      if(!root)throw new Error(`Missing route root ${rootSelector}`);
      const probe=document.createElement('article');
      probe.className=probeClass;
      probe.dataset.glassRouteProbe='true';
      root.appendChild(probe);
      const style=getComputedStyle(probe),rootStyle=getComputedStyle(root),before=getComputedStyle(root,'::before');
      const control=controlSelector?document.querySelector(controlSelector):null;
      const controlStyle=control?getComputedStyle(control):null;
      const result={
        filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),
        background:style.backgroundColor,
        border:style.borderTopColor,
        isolation:rootStyle.isolation,
        beforeContent:before.content,
        beforeBackground:before.backgroundImage,
        checkBackdropRoot,
        control:controlStyle?{
          selector:controlSelector,
          filter:String(controlStyle.backdropFilter||controlStyle.webkitBackdropFilter||'none'),
          className:control.className
        }:null
      };
      probe.remove();
      return result;
    },{rootSelector:spec.root,probeClass:spec.probe,checkBackdropRoot:spec.checkBackdropRoot,controlSelector:spec.control||null});
    assert(normalize(report.filter)===CI_FILTER,`${spec.name}: route cascade drifted from CI filter: ${JSON.stringify(report)}`);
    assert(report.background===CI_FILL,`${spec.name}: route cascade drifted from CI fill: ${JSON.stringify(report)}`);
    if(spec.checkBackdropRoot){
      assert(report.isolation==='auto',`${spec.name}: route creates an isolated backdrop context: ${JSON.stringify(report)}`);
      assert(report.beforeContent==='none'||report.beforeContent==='normal',`${spec.name}: route-wide ::before overlay returned: ${JSON.stringify(report)}`);
      assert(report.beforeBackground==='none',`${spec.name}: route-wide backdrop paint returned: ${JSON.stringify(report)}`);
    }
    if(report.control)assert(normalize(report.control.filter)===CI_FILTER,`${spec.name}: translucent control drifted from CI filter: ${JSON.stringify(report)}`);
    reports.push({route:spec.name,...report});
  }
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,ciAuthority:{filter:CI_FILTER,fill:CI_FILL},routes:reports}));
}finally{
  await context.close();
  await browser.close();
}
