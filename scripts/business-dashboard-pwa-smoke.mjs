import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const page=await context.newPage();page.setDefaultTimeout(40000);

try{
  // This smoke owns the installed-PWA contract only. Authenticated Today rendering is covered by
  // business-dashboard-browser-smoke.mjs. Register explicitly here so the test does not depend on
  // the app's window-load update hook firing while unrelated authentication/bootstrap work runs.
  await page.goto(`${BASE_URL}/index.html`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const timeout=(label,ms)=>new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms));
    const requested=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    await requested.update().catch(()=>{});
    const registration=await Promise.race([
      navigator.serviceWorker.ready,
      timeout('service worker ready timeout',30000)
    ]);
    if(!navigator.serviceWorker.controller){
      await Promise.race([
        new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),
        timeout('service worker controller timeout',15000)
      ]);
    }
    await new Promise(resolve=>setTimeout(resolve,500));
    const manifest=await fetch('/manifest.webmanifest',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    });
    const swText=await fetch('/sw.js',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error(`sw HTTP ${response.status}`);
      return response.text();
    });
    const keys=await caches.keys();
    // Derive the cache name from the worker itself. Pinning a version here meant
    // every VERSION bump silently found no cache and read every asset as missing.
    const swVersion=(swText.match(/VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
    const key=keys.find(value=>value===swVersion)||keys.find(value=>value.startsWith('sindhorn-midtown-internal-pwa-'));
    const cache=key?await caches.open(key):null;
    const expected=['/','/index.html','/route-registry.js','/business-dashboard.js','/business-dashboard-data.js','/business-dashboard.css','/business-dashboard-motion.js','/business-dashboard-motion.css','/hotel-factsheet.css','/betta-runtime.js','/betta-runtime-full.js','/betta-fin-presets.js','/betta-fin-shader.js','/betta-satellite.js','/rain-now.js','/push-config.js','/push-client.js','/notification-inbox.js','/app.js','/manifest.webmanifest'];
    const cached={};
    for(const path of expected)cached[path]=Boolean(cache&&await cache.match(path));
    return{
      scriptURL:registration.active?.scriptURL||requested.active?.scriptURL||'',
      controller:Boolean(navigator.serviceWorker.controller),
      manifest:{id:manifest.id,start_url:manifest.start_url,scope:manifest.scope,display:manifest.display},
      cacheKey:key||null,
      cached,
      pushPreserved:swText.includes("self.addEventListener('push'")&&swText.includes("NOTIFICATION_DB='sindhorn-midtown-notification-inbox'"),
      bettaPreserved:swText.includes("'/betta-runtime-full.js'")&&swText.includes("'/betta-satellite.js'"),
      dashboardMotionPreserved:swText.includes("'/business-dashboard-motion.js'")&&swText.includes("'/business-dashboard-motion.css'")
    };
  });
  assert(result.scriptURL.endsWith('/sw.js'),`Unexpected service worker ${JSON.stringify(result)}`);
  assert(result.controller,`Page not controlled by active service worker ${JSON.stringify(result)}`);
  assert(result.manifest.id==='/'&&result.manifest.start_url==='/'&&result.manifest.scope==='/'&&result.manifest.display==='standalone',`PWA identity changed ${JSON.stringify(result.manifest)}`);
  assert(result.cacheKey&&Object.values(result.cached).every(Boolean),`Dashboard/Betta/push shell not fully precached ${JSON.stringify(result)}`);
  assert(result.pushPreserved,`Push/message service-worker infrastructure changed ${JSON.stringify(result)}`);
  assert(result.bettaPreserved,`Betta service-worker shell lineage changed ${JSON.stringify(result)}`);
  assert(result.dashboardMotionPreserved,`Dashboard motion assets missing from service-worker shell ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,result}));
}finally{await context.close();await browser.close()}
