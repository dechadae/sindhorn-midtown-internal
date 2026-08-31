import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'PWA Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const dashboard={businessDate:'2026-08-30',publishedAt:'2026-08-31T02:00:00Z',revision:1,validationStatus:'passed',sources:[],fnb:{summary:{daily:{revenue:400000,forecast:420000,covers:600,coverForecast:630,food:280000,foodForecast:290000,beverage:100000,beverageForecast:105000,other:30000,otherForecast:25000,otherDiscount:10000},mtd:{revenue:10000000,forecast:10200000}},outlets:[],notes:[]},rooms:{months:[{stayMonth:'2026-08-01',pickup:{rns:40,adr:4100,revenue:164000},otb:{rns:10000,adr:4000,revenue:40000000,occupancy:.85,revpar:3400},forecast:{rns:10200,adr:4050,revenue:41310000,occupancy:.87,revpar:3524},budget:{revenue:39000000},stly:{revenue:37000000},lastYear:{revenue:37500000}},{stayMonth:'2026-09-01',pickup:{rns:80,revenue:320000},otb:{rns:6000,adr:3900,revenue:23400000,occupancy:.51,revpar:1989},forecast:{rns:8000,adr:4000,revenue:32000000,occupancy:.68,revpar:2720}}],segments:[]},flags:[]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const page=await context.newPage();page.setDefaultTimeout(40000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_business_dashboard_read_model',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
try{
  // Use the legacy index alias so the first service-worker activation can be verified without
  // intentionally navigating this synthetic authenticated test client. The installed manifest
  // identity remains id/start_url/scope=/ and is asserted below.
  await page.goto(`${BASE_URL}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  await page.waitForSelector('.business-dashboard-route[data-business-date="2026-08-30"]');
  const result=await page.evaluate(async()=>{
    const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('service worker ready timeout')),15000))]);
    await new Promise(resolve=>setTimeout(resolve,700));
    const manifest=await fetch('/manifest.webmanifest',{cache:'no-store'}).then(r=>r.json());
    const keys=await caches.keys();
    const key=keys.find(value=>value.includes('pwa-v38-today-motion-r1'));
    const cache=key?await caches.open(key):null;
    const expected=['/index.html','/route-registry.js','/business-dashboard.js','/business-dashboard-data.js','/business-dashboard.css','/business-dashboard-motion.js','/business-dashboard-motion.css','/hotel-factsheet.css','/betta-environment.js','/betta-fin-presets.js','/betta-fin-shader.js','/betta-satellite.js','/rain-layer.js','/rain-layer-legacy-weather.js','/push-client.js','/notification-inbox.js','/app.js'];
    const cached={};
    for(const path of expected)cached[path]=Boolean(cache&&await cache.match(path));
    return{scriptURL:registration.active?.scriptURL||'',controller:Boolean(navigator.serviceWorker.controller),manifest:{id:manifest.id,start_url:manifest.start_url,scope:manifest.scope,display:manifest.display},cacheKey:key||null,cached};
  });
  assert(result.scriptURL.endsWith('/sw.js'),`Unexpected service worker ${JSON.stringify(result)}`);
  assert(result.controller,`Page not controlled by active service worker ${JSON.stringify(result)}`);
  assert(result.manifest.id==='/'&&result.manifest.start_url==='/'&&result.manifest.scope==='/'&&result.manifest.display==='standalone',`PWA identity changed ${JSON.stringify(result.manifest)}`);
  assert(result.cacheKey&&Object.values(result.cached).every(Boolean),`Dashboard/Betta/push shell not fully precached ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,result}));
}finally{await context.close();await browser.close()}
