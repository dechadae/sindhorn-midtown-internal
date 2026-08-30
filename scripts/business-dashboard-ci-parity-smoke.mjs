import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const developerManifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Dashboard Audit',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','business_dashboard.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile',renderer:'account',sortOrder:10,config:{}},{key:'system',label:'System',navLabel:'System',description:'System',renderer:'system',sortOrder:40,config:{}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'CI Dashboard Audit',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const dashboard={businessDate:'2026-08-30',revision:1,validationStatus:'passed_with_warnings',sources:[{filename:'F&B Daily Report.xlsx'},{filename:'Rooms Pickup Report.pdf'}],fnb:{summary:{daily:{revenue:420000,forecast:460000,covers:640,coverForecast:680,food:300000,foodForecast:320000,beverage:100000,beverageForecast:110000,other:30000,otherForecast:30000,otherDiscount:10000},mtd:{revenue:10800000,forecast:11000000,covers:19000,coverForecast:20000}},outlets:[{key:'bangkok78',label:"Bangkok'78",revenue:170000,forecast:180000,covers:120,foodNet:110000,beverageNet:50000,dayparts:[{key:'breakfast',label:'Breakfast',covers:50,foodNet:50000,beverageNet:10000,revenue:60000}]}],notes:[{outletKey:'bangkok78',outlet:"Bangkok'78",daypartKey:'breakfast',daypart:'Breakfast',displayText:'Strong breakfast flow.'}]},rooms:{months:[{stayMonth:'2026-08-01',pickup:{rns:40,adr:4200,revenue:168000},otb:{rns:10000,adr:4100,revenue:41000000,occupancy:.89,revpar:3649},forecast:{rns:9800,adr:4200,revenue:41160000,occupancy:.87,revpar:3654},budget:{revenue:39000000},stly:{revenue:37000000},lastYear:{revenue:37500000}},{stayMonth:'2026-09-01',pickup:{rns:80,revenue:320000},otb:{rns:6000,adr:3900,revenue:23400000,occupancy:.51,revpar:1989},forecast:{rns:8000,adr:4000,revenue:32000000,occupancy:.68,revpar:2720}}],segments:[{stayMonth:'2026-08-01',key:'transient',label:'Transient',otb:{rns:2500,revenue:13200000},forecast:{rns:2800,revenue:14600000},pickup:{rns:11,revenue:85000}}]},flags:[{domain:'fnb',scopeKey:'bangkok78',metricKey:'outlet_revenue',severity:'watch',title:"Bangkok'78 is below forecast",detail:'Outlet revenue is materially behind its daily forecast.',payload:{variancePct:-.0556}}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
const errors=[];
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(developerManifest)}));
await page.route('**/rest/v1/rpc/sindhorn_business_dashboard_read_model',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});

try{
  await page.goto(`${BASE_URL}/ci`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  await page.waitForSelector('.ci-route');
  await page.waitForSelector('[data-ci-disclosure]');
  const ci=await page.evaluate(()=>{
    const title=document.querySelector('.ci-route>.app-route-hero .app-route-title');
    const card=document.querySelector('.ci-specimen .fnb-card');
    const disclosure=document.querySelector('[data-ci-disclosure]');
    const button=disclosure?.querySelector('.factsheet-room-card-button');
    const panel=disclosure?.querySelector('.factsheet-room-panel');
    const eyebrow=document.querySelector('.ci-route>.app-route-hero .app-route-eyebrow');
    const style=node=>node?getComputedStyle(node):null;
    return{hero:{font:style(title)?.fontFamily,weight:style(title)?.fontWeight,size:style(title)?.fontSize,lineHeight:style(title)?.lineHeight,tracking:style(title)?.letterSpacing},card:{radius:style(card)?.borderRadius,border:style(card)?.borderColor,background:style(card)?.backgroundColor},disclosure:{radius:style(disclosure)?.borderRadius,buttonTransition:style(button)?.transitionDuration,panelTransition:style(panel)?.transitionDuration},accent:style(eyebrow)?.color};
  });

  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  await page.waitForSelector('.business-dashboard-route[data-business-date="2026-08-30"]');
  await page.waitForTimeout(900);await page.waitForSelector('.business-dashboard-route[data-business-date="2026-08-30"]');
  const dashboardState=await page.evaluate(()=>{
    const title=document.querySelector('.bd-hero .app-route-title'),card=document.querySelector('.bd-metric'),disclosure=document.querySelector('.bd-disclosure'),button=disclosure?.querySelector('.factsheet-room-card-button'),panel=disclosure?.querySelector('.factsheet-room-panel'),kicker=document.querySelector('.bd-kicker'),route=document.querySelector('.business-dashboard-route');
    const style=node=>node?getComputedStyle(node):null;
    return{hero:{font:style(title)?.fontFamily,weight:style(title)?.fontWeight,size:style(title)?.fontSize,lineHeight:style(title)?.lineHeight,tracking:style(title)?.letterSpacing},card:{radius:style(card)?.borderRadius,border:style(card)?.borderColor,background:style(card)?.backgroundColor},disclosure:{radius:style(disclosure)?.borderRadius,buttonTransition:style(button)?.transitionDuration,panelTransition:style(panel)?.transitionDuration,sharedClasses:disclosure?.classList.contains('factsheet-room-card')&&button?.classList.contains('factsheet-room-card-button')&&panel?.classList.contains('factsheet-room-panel'),expanded:button?.getAttribute('aria-expanded')},accent:style(kicker)?.color,routeBefore:route?getComputedStyle(route,'::before').content:null,width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth};
  });

  assert(dashboardState.hero.font===ci.hero.font&&dashboardState.hero.weight===ci.hero.weight&&dashboardState.hero.size===ci.hero.size&&dashboardState.hero.lineHeight===ci.hero.lineHeight,`Hero parity failed ${JSON.stringify({ci:ci.hero,dashboard:dashboardState.hero})}`);
  assert((dashboardState.hero.tracking==='0px'||dashboardState.hero.tracking==='normal')&&(ci.hero.tracking==='0px'||ci.hero.tracking==='normal'),`Hero tracking failed ${JSON.stringify({ci:ci.hero.tracking,dashboard:dashboardState.hero.tracking})}`);
  assert(dashboardState.card.radius===ci.card.radius&&dashboardState.card.border===ci.card.border&&dashboardState.card.background===ci.card.background,`Glass card parity failed ${JSON.stringify({ci:ci.card,dashboard:dashboardState.card})}`);
  assert(dashboardState.disclosure.sharedClasses&&dashboardState.disclosure.expanded==='false'&&dashboardState.disclosure.radius===ci.disclosure.radius&&dashboardState.disclosure.panelTransition===ci.disclosure.panelTransition,`Disclosure parity failed ${JSON.stringify({ci:ci.disclosure,dashboard:dashboardState.disclosure})}`);
  assert(dashboardState.accent===ci.accent,`Accent token parity failed ${JSON.stringify({ci:ci.accent,dashboard:dashboardState.accent})}`);
  assert(dashboardState.routeBefore==='none'&&dashboardState.width<=dashboardState.client+1,`Atmosphere/overflow parity failed ${JSON.stringify(dashboardState)}`);
  const relevant=errors.filter(text=>/ci|business-dashboard|route-registry|bootstrap/i.test(text));assert(relevant.length===0,`Relevant browser errors ${JSON.stringify(relevant)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,ci,dashboard:dashboardState},null,2));
}finally{await context.close();await browser.close()}
