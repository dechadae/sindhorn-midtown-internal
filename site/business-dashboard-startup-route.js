import {mountBusinessDashboardRoute} from './business-dashboard.js?v=4';

function startupLoadingRoute(){
  const route=document.createElement('section');
  route.className='business-dashboard-route';
  route.setAttribute('aria-busy','true');
  route.innerHTML='<header class="app-route-hero"><p class="app-route-eyebrow">Today</p><h1 class="app-route-title">Hotel Business</h1><p class="app-route-copy">Loading the latest approved daily business report…</p></header>';
  return route;
}

export async function mountBusinessDashboardStartupRoute(host){
  if(document.documentElement.dataset.startupEnter!=='pending')return mountBusinessDashboardRoute(host);

  const placeholder=startupLoadingRoute();
  const staging=document.createElement('div');
  staging.hidden=true;
  staging.setAttribute('aria-hidden','true');
  host.append(placeholder,staging);

  let disposed=false;
  let realCleanup=null;
  const mounting=mountBusinessDashboardRoute(staging).then(cleanup=>{
    realCleanup=typeof cleanup==='function'?cleanup:null;
    if(disposed){realCleanup?.();staging.remove();return}
    const realRoute=staging.querySelector(':scope > .business-dashboard-route');
    if(realRoute){
      realRoute.removeAttribute('aria-hidden');
      placeholder.replaceWith(realRoute);
    }
    staging.remove();
  }).catch(error=>{
    console.warn('Today dashboard startup mount failed',error);
    if(!disposed){
      placeholder.removeAttribute('aria-busy');
      const copy=placeholder.querySelector('.app-route-copy');
      if(copy)copy.textContent='Daily business data is temporarily unavailable.';
    }
    staging.remove();
  });

  return()=>{
    disposed=true;
    placeholder.remove();
    staging.remove();
    if(realCleanup)realCleanup();
    else void mounting.then(()=>realCleanup?.());
  };
}
