/* The service worker install must survive a flaky network.

   It used to be all-or-nothing across every SHELL entry: one bad response
   rejected precacheShell(), the install failed, the new worker never
   activated, and the client stayed on the old build permanently - the state
   that ends in "delete and reinstall". Verified against the previous worker:
   blocking a single optional font was enough to fail the install.

   Only CRITICAL_SHELL is fatal now. This test proves both halves of that
   contract, because a resilience fix that never fails is just a broken cache.

   It serves ./site itself rather than testing a deployed preview. Playwright
   route interception does not reliably reach service-worker-initiated fetches
   on a remote origin - against the preview every trial reported the full 87
   cached entries because nothing was actually blocked, which made the critical
   trial silently pass. A local origin keeps the blocking real and the result
   trustworthy.
*/
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const SITE=path.resolve('site');
const PORT=Number(process.env.SW_TEST_PORT||8799);
const MIME={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css',
  '.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json',
  '.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.ico':'image/x-icon'};

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${PORT}`);
  let file=path.join(SITE,decodeURIComponent(url.pathname));
  if(url.pathname==='/'||url.pathname.endsWith('/'))file=path.join(SITE,'index.html');
  if(!file.startsWith(SITE)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(PORT,'127.0.0.1',resolve));
const BASE=`http://127.0.0.1:${PORT}`;

async function trial(label,blockGlobs,expectInstalled){
  const browser=await chromium.launch();
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  for(const glob of blockGlobs) await context.route(glob, route=>route.abort('failed'));
  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:45000});
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
  return {ok,cachedEntries};
}

let ok=true;
const base=await trial('baseline installs',[],true); ok=base.ok&&ok;
const font=await trial('optional font failure still installs',['**/assets/fonts/line-seed-sans-th-thin.woff2'],true); ok=font.ok&&ok;
const betta=await trial('optional betta runtime failure still installs',['**/betta-runtime.js*'],true); ok=betta.ok&&ok;
const many=await trial('many optional failures still install',['**/assets/fonts/*','**/icons/*','**/fallback/*'],true); ok=many.ok&&ok;
const crit=await trial('critical asset failure correctly fails install',['**/shell.css*'],false); ok=crit.ok&&ok;

/* Guard against the false pass this test itself produced against a remote
   origin: if blocking never reduced the cache, nothing was really blocked. */
if(!(font.cachedEntries<base.cachedEntries&&many.cachedEntries<font.cachedEntries)){
  console.error(`\nBlocking had no effect (baseline ${base.cachedEntries}, font ${font.cachedEntries}, many ${many.cachedEntries}). The trials are not exercising the install path.`);
  ok=false;
}

server.close();
if(!ok){console.error('\nService worker install resilience regressed.');process.exit(1)}
console.log(JSON.stringify({ok:true,origin:BASE,trials:5,baselineCached:base.cachedEntries}));
