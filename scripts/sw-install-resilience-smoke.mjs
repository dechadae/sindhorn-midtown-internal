/* The service worker install must survive a flaky network.

   It used to be all-or-nothing across every SHELL entry: one bad response
   rejected precacheShell(), the install failed, the new worker never
   activated, and the client stayed on the old build permanently - the state
   that ends in "delete and reinstall". Verified against the previous worker:
   blocking a single optional font was enough to fail the install.

   Only CRITICAL_SHELL is fatal now. This test proves both halves of that
   contract, because a resilience fix that never fails is just a broken cache.

   Usage: BASE_URL=https://<preview>.pages.dev node scripts/sw-install-resilience-smoke.mjs
*/
import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');

async function trial(label, blockGlobs, expectInstalled){
  const browser=await chromium.launch();
  const context=await browser.newContext();          // service workers allowed
  const page=await context.newPage();
  for(const glob of blockGlobs) await context.route(glob, route=>route.abort('failed'));
  await page.goto(`${BASE_URL}/index.html`,{waitUntil:'domcontentloaded',timeout:45000});
  const result=await page.evaluate(async()=>{
    try{
      const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      const start=Date.now();
      while(Date.now()-start<30000){
        if(registration.active)return{installed:true,state:'active'};
        if(registration.installing?.state==='redundant')return{installed:false,state:'redundant'};
        if(registration.waiting)return{installed:true,state:'waiting'};
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      return{installed:Boolean(registration.active),state:'timeout'};
    }catch(error){return{installed:false,state:'threw'}}
  });
  const cachedEntries=await page.evaluate(async()=>{
    const keys=await caches.keys();
    const key=keys.find(name=>name.includes('pwa-v'));
    if(!key)return 0;
    return (await (await caches.open(key)).keys()).length;
  });
  await browser.close();
  const ok=result.installed===expectInstalled;
  console.log(`${ok?'PASS':'FAIL'}  ${label}  installed=${result.installed} (${result.state}) cached=${cachedEntries}`);
  return ok;
}

let ok=true;
ok=await trial('baseline installs', [], true) && ok;
ok=await trial('optional font failure still installs', ['**/assets/fonts/line-seed-sans-th-thin.woff2'], true) && ok;
ok=await trial('optional betta runtime failure still installs', ['**/betta-runtime.js*'], true) && ok;
ok=await trial('many optional failures still install', ['**/assets/fonts/*','**/icons/*','**/fallback/*'], true) && ok;
ok=await trial('critical asset failure correctly fails install', ['**/shell.css*'], false) && ok;

if(!ok){console.error('\nService worker install resilience regressed.');process.exit(1)}
console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,trials:5}));
