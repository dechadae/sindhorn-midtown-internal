const CHECK_MIN_INTERVAL=60_000;
const FNB_RECOVERY_KEY='sindhorn-midtown:fnb-controller-recovery:v1';
let lastCheck=0;
let startupReadyPromise=null;
let fullBettaReadyPromise=null;
let updateInFlight=null;

function fnbRouteIsBlank(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path!=='/fnb')return false;
  const host=document.getElementById('route-view');
  return !!host&&!host.querySelector('.fnb-route')&&!host.textContent.trim();
}

function waitForStartupReveal(){
  if(document.documentElement.dataset.startupEnter==='visible')return Promise.resolve();
  if(startupReadyPromise)return startupReadyPromise;
  startupReadyPromise=new Promise(resolve=>{
    const root=document.documentElement;
    const finish=()=>{observer.disconnect();resolve()};
    const observer=new MutationObserver(()=>{if(root.dataset.startupEnter==='visible')finish()});
    observer.observe(root,{attributes:true,attributeFilter:['data-startup-enter']});
    if(root.dataset.startupEnter==='visible')finish();
  });
  return startupReadyPromise;
}

function waitForFullBetta(){
  if(document.body.dataset.bettaFirstFrame==='ready')return Promise.resolve();
  if(fullBettaReadyPromise)return fullBettaReadyPromise;
  fullBettaReadyPromise=new Promise(resolve=>{
    let settled=false;
    const finish=()=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      document.removeEventListener('sindhorn:betta-first-frame',finish);
      resolve();
    };
    const timeout=setTimeout(finish,12_000);
    document.addEventListener('sindhorn:betta-first-frame',finish,{once:true});
    if(document.body.dataset.bettaFirstFrame==='ready')finish();
  });
  return fullBettaReadyPromise;
}

function waitForIdle(){
  return new Promise(resolve=>{
    if('requestIdleCallback'in window){requestIdleCallback(()=>resolve(),{timeout:2000});return}
    setTimeout(resolve,1200);
  });
}

async function checkForUpdate(force=false){
  if(!('serviceWorker'in navigator))return;
  const now=Date.now();
  if(!force&&now-lastCheck<CHECK_MIN_INTERVAL)return;
  if(updateInFlight)return updateInFlight;
  updateInFlight=(async()=>{
    await waitForStartupReveal();
    await waitForFullBetta();
    await waitForIdle();
    lastCheck=Date.now();
    try{
      const registration=(await navigator.serviceWorker.getRegistration('/'))||await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      await registration.update();
    }catch(_){}
  })().finally(()=>{updateInFlight=null});
  return updateInFlight;
}

if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!fnbRouteIsBlank())return;
    try{
      if(sessionStorage.getItem(FNB_RECOVERY_KEY)==='1')return;
      sessionStorage.setItem(FNB_RECOVERY_KEY,'1');
    }catch(_){}
    location.reload();
  });

  // Startup owns the foreground. SW registration/update waits until the
  // bootstrap Today/Betta reveal, the full approved Betta's real first frame,
  // and then an idle slice so Android launch resources are never contested.
  void checkForUpdate(true);
  addEventListener('focus',()=>{void checkForUpdate(false)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkForUpdate(false)});
}

/* Stale runtime eviction. Lives here because this module owns PWA cache
   lifecycle, and because it must complete before auth-shell.js imports the
   bootstrap graph. index.html loads this module first and the top-level await
   below holds the next module script until eviction finishes, which is the
   ordering auth-shell.js used to guarantee by calling it inline. */
async function evictStaleBootstrapRuntime(){
  if(!('caches'in window))return;
  try{
    const keys=await caches.keys();
    await Promise.all(keys.map(async key=>{
      const cache=await caches.open(key);
      await Promise.all([
        cache.delete('/betta-runtime.js?v=1'),
        cache.delete('/betta-runtime.js'),
        cache.delete('/route-registry.js'),
        cache.delete('/settings-route-v3.js'),
        cache.delete('/settings-route-v3.js?v=12&r=release-health-1'),
        cache.delete('/business-card-settings.css?v=10'),
        cache.delete('/bootstrap.js?v=2'),
        cache.delete('/bootstrap.js?v=3'),
        cache.delete('/app-glass-runtime.js'),
        cache.delete('/app-glass-runtime.js?v=1'),
        cache.delete('/app.js'),
        cache.delete('/app.js?v=1'),
        cache.delete('/pwa.css')
      ]);
    }));
  }catch(_){}
}

await evictStaleBootstrapRuntime();

export {checkForUpdate,evictStaleBootstrapRuntime};
