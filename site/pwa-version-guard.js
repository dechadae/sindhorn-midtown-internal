const CHECK_MIN_INTERVAL=60_000;
const FNB_RECOVERY_KEY='sindhorn-midtown:fnb-controller-recovery:v1';
let lastCheck=0;

function fnbRouteIsBlank(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path!=='/fnb')return false;
  const host=document.getElementById('route-view');
  return !!host&&!host.querySelector('.fnb-route')&&!host.textContent.trim();
}

async function checkForUpdate(force=false){
  if(!('serviceWorker'in navigator))return;
  const now=Date.now();
  if(!force&&now-lastCheck<CHECK_MIN_INTERVAL)return;
  lastCheck=now;
  try{
    const registration=(await navigator.serviceWorker.getRegistration('/'))||await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    await registration.update();
  }catch(_){}
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
  addEventListener('load',()=>checkForUpdate(true),{once:true});
  addEventListener('focus',()=>checkForUpdate(false),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForUpdate(false)});
}

export {checkForUpdate};
