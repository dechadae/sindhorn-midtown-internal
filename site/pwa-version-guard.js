const CHECK_MIN_INTERVAL=60_000;
const FNB_RECOVERY_KEY='sindhorn-midtown:fnb-controller-recovery:v1';
let lastCheck=0;
let startupReadyPromise=null;
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
    const finish=()=>{
      observer.disconnect();
      resolve();
    };
    const observer=new MutationObserver(()=>{
      if(root.dataset.startupEnter==='visible')finish();
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-startup-enter']});
    if(root.dataset.startupEnter==='visible')finish();
  });
  return startupReadyPromise;
}

function waitForIdle(){
  return new Promise(resolve=>{
    if('requestIdleCallback'in window){
      requestIdleCallback(()=>resolve(),{timeout:2000});
      return;
    }
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

  // Foreground-first startup: Betta and Today own the critical launch path.
  // Service-worker registration/update begins only after their shared reveal,
  // then waits for an idle slice so compilation/rendering is not competing
  // with SW maintenance on Android standalone launches.
  void checkForUpdate(true);
  addEventListener('focus',()=>{void checkForUpdate(false)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkForUpdate(false)});
}

export {checkForUpdate};
