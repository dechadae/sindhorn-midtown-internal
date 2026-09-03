import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const CI_FILTER='blur(18px) saturate(1.18)';
const CI_FILL='rgba(46, 39, 59, 0.3)';
// A surface carries the canonical material either by declaring a primitive in
// markup (migrated routes) or by being stamped from the registry (routes still
// awaiting migration). Both are the same material; only the mechanism differs.
const MATERIAL_CLASSES=['app-card','app-control','app-glass-surface','app-glass-control'];
const hasMaterial=className=>String(className||'').split(/\s+/).some(c=>MATERIAL_CLASSES.includes(c));
const assert=(value,message)=>{if(!value)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Glass Route Preview',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Glass Route Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=4');
`;
const routes=[
  {path:'/fnb',root:'.fnb-route',target:'.fnb-card,.fnb-empty',name:'F&B',checkBackdropRoot:true},
  {path:'/settings',root:'.settings-route',target:'.settings-guide-card,.settings-avatar,.settings-state',name:'Settings',checkBackdropRoot:true},
  {path:'/brand',root:'.brand-route',target:'.brand-card',name:'Brand'},
  {path:'/hotel-factsheet',root:'.factsheet-route',target:'.factsheet-card,.factsheet-room-card',name:'Factsheet'},
  {path:'/ihg-history',root:'.ihg-history-route',target:'.ihg-history-card',name:'IHG History'},
  {path:'/ci',root:'.ci-route',target:'.ci-status',name:'CI'}
];
const normalize=value=>String(value||'none').replace(/\s+/g,' ').trim();
function alphaOf(value){
  const text=String(value||'');
  const match=text.match(/rgba\([^,]+,[^,]+,[^,]+,\s*(0?\.\d+|1(?:\.0+)?)\s*\)/i);
  return match?Number(match[1]):(/^rgb\(/i.test(text)?1:NaN);
}

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
  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.business-dashboard-route',{state:'attached'});
  const today=await page.evaluate(async()=>{
    const host=document.querySelector('.business-dashboard-route');
    const metric=document.createElement('article');metric.className='bd-metric';metric.textContent='Today glass probe';host.appendChild(metric);
    await new Promise(resolve=>setTimeout(resolve,0));
    const style=getComputedStyle(metric);const result={filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor,className:metric.className};metric.remove();return result;
  });
  assert(normalize(today.filter)===CI_FILTER&&today.background===CI_FILL&&today.className.includes('app-glass-surface'),`Today: central runtime did not assign glass ${JSON.stringify(today)}`);
  reports.push({route:'Today',target:today});

  for(const spec of routes){
    await page.goto(`${BASE_URL}${spec.path}`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector(spec.root,{state:'attached'});
    await page.waitForSelector(spec.target,{state:'attached'});
    await page.waitForFunction(({selector,classes})=>{
      const node=document.querySelector(selector);
      return !!node&&classes.some(name=>node.classList.contains(name));
    },{selector:spec.target,classes:MATERIAL_CLASSES});
    await page.waitForSelector('.masthead.app-glass-surface',{state:'attached'});
    await page.waitForSelector('.app-tabbar.app-glass-surface',{state:'attached'});
    const report=await page.evaluate(({rootSelector,targetSelector,checkBackdropRoot})=>{
      const root=document.querySelector(rootSelector),target=document.querySelector(targetSelector),header=document.querySelector('.masthead'),globalFooter=document.querySelector('.app-tabbar'),contextFooter=document.querySelector('.fnb-section-rail.shell-footer-rail,.settings-section-rail.shell-footer-rail');
      if(!root||!target||!header||!globalFooter)throw new Error('Missing glass route target');
      const read=node=>{if(!node)return null;const style=getComputedStyle(node);return{filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor,className:node.className}};
      const rootStyle=getComputedStyle(root),before=getComputedStyle(root,'::before');
      return{target:read(target),header:read(header),globalFooter:read(globalFooter),contextFooter:read(contextFooter),isolation:rootStyle.isolation,beforeContent:before.content,beforeBackground:before.backgroundImage,checkBackdropRoot};
    },{rootSelector:spec.root,targetSelector:spec.target,checkBackdropRoot:spec.checkBackdropRoot});
    for(const [label,target] of Object.entries({target:report.target,header:report.header,globalFooter:report.globalFooter})){
      assert(normalize(target.filter)===CI_FILTER,`${spec.name} ${label}: filter drift ${JSON.stringify(report)}`);
      assert(target.background===CI_FILL,`${spec.name} ${label}: fill drift ${JSON.stringify(report)}`);
      assert(hasMaterial(target.className),`${spec.name} ${label}: canonical material class missing ${JSON.stringify(report)}`);
    }
    if(report.contextFooter){
      assert(normalize(report.contextFooter.filter)===CI_FILTER,`${spec.name} contextual footer: filter drift ${JSON.stringify(report)}`);
      assert(Math.abs(alphaOf(report.contextFooter.background)-.30)<=.01,`${spec.name} contextual footer: alpha drift ${JSON.stringify(report)}`);
      assert(report.contextFooter.className.includes('app-glass-surface'),`${spec.name} contextual footer: canonical class missing ${JSON.stringify(report)}`);
    }
    if(spec.checkBackdropRoot){
      assert(report.isolation==='auto',`${spec.name}: route creates isolated backdrop context ${JSON.stringify(report)}`);
      assert(report.beforeContent==='none'||report.beforeContent==='normal',`${spec.name}: route-wide ::before overlay returned ${JSON.stringify(report)}`);
      assert(report.beforeBackground==='none',`${spec.name}: route-wide backdrop paint returned ${JSON.stringify(report)}`);
    }
    reports.push({route:spec.name,...report});
  }

  await page.goto(`${BASE_URL}/messages`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#route-view',{state:'attached'});
  const messages=await page.evaluate(async()=>{
    const host=document.getElementById('messageList')||document.getElementById('route-view');
    const card=document.createElement('article');card.className='message-card';card.textContent='Glass runtime probe';host.appendChild(card);
    await new Promise(resolve=>setTimeout(resolve,0));
    const style=getComputedStyle(card);const result={filter:String(style.backdropFilter||style.webkitBackdropFilter||'none'),background:style.backgroundColor,className:card.className};card.remove();return result;
  });
  assert(normalize(messages.filter)===CI_FILTER&&messages.background===CI_FILL&&messages.className.includes('app-glass-surface'),`Messages: central runtime did not assign glass ${JSON.stringify(messages)}`);
  reports.push({route:'Messages',target:messages});

  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,ciAuthority:{filter:CI_FILTER,fill:CI_FILL},routes:reports}));
}finally{await context.close();await browser.close()}
