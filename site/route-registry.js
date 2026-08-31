export const ROUTES=Object.freeze({
  today:Object.freeze({path:'/',title:'Today | Sindhorn Midtown Internal',kind:'local',module:'./route-registry.js?v=5',mount:'mountBusinessDashboardStartupRoute'}),
  fnb:Object.freeze({path:'/fnb',title:'F&B | Sindhorn Midtown Internal',kind:'local',module:'./fnb.js',mount:'mountFnbRoute'}),
  brand:Object.freeze({path:'/brand',title:'Brand | Sindhorn Midtown Internal',kind:'local',module:'./brand.js?v=3',mount:'mountBrandRoute'}),
  ihgHistory:Object.freeze({path:'/ihg-history',title:'Our History | Sindhorn Midtown Internal',kind:'local',module:'./ihg-history.js',mount:'mountIhgHistoryRoute'}),
  hotelFactsheet:Object.freeze({path:'/hotel-factsheet',title:'Hotel Factsheet | Sindhorn Midtown Internal',kind:'local',module:'./hotel-factsheet-route.js?v=2',mount:'mountHotelFactsheetRoute'}),
  messages:Object.freeze({path:'/messages',title:'Environmental Messages | Sindhorn Midtown Hotel Bangkok',kind:'pack',resource:'messages.html'}),
  settings:Object.freeze({path:'/settings',title:'Settings | Sindhorn Midtown Internal',kind:'local',module:'./settings-route-v3.js?v=12&r=release-health-1',mount:'mountSettingsRoute'}),
  ci:Object.freeze({path:'/ci',title:'UI Library | Sindhorn Midtown Internal',kind:'local',module:'./ci-day-cycle-route.js?v=1',mount:'mountCiRoute'})
});
// Today cache lineage: business-dashboard.js?v=2 -> v3 for explicit freshness/domain separation -> v4 for semantic dashboard motion -> route-registry startup wrapper v5 keeps private dashboard data off the initial visual critical path.
// Cache lineage: settings-route-v3.js?v=10&r=6&d=5 -> v11&r=ci-1 -> v12&r=release-health-1 for capability-gated Business Card loading.
const PATH_TO_ROUTE=new Map(Object.entries(ROUTES).map(([key,value])=>[value.path,key]));const LEGACY_ALIASES=new Map([['/index.html','today'],['/guidance','today'],['/details','today'],['/account','settings'],['/account.html','settings'],['/admin','settings'],['/admin.html','settings']]);function normalizePath(pathname){let path=String(pathname||'/').split('?')[0].split('#')[0]||'/';if(path.length>1&&path.endsWith('/'))path=path.slice(0,-1);return path||'/'}export function routeForPath(pathname){const path=normalizePath(pathname);return PATH_TO_ROUTE.get(path)||LEGACY_ALIASES.get(path)||null}export function routePath(route){return ROUTES[route]?.path||ROUTES.today.path}export function routeTitle(route){return ROUTES[route]?.title||ROUTES.today.title}export function isAppRoutePath(pathname){return routeForPath(pathname)!==null}export function canonicalRoute(route){return ROUTES[route]?route:'today'}

function startupLoadingRoute(){
  const route=document.createElement('section');
  route.className='business-dashboard-route';
  route.setAttribute('aria-busy','true');
  route.innerHTML='<header class="app-route-hero"><p class="app-route-eyebrow">Today</p><h1 class="app-route-title">Hotel Business</h1><p class="app-route-copy">Loading the latest approved daily business report…</p></header>';
  return route;
}
function waitForStartupReveal(){
  const root=document.documentElement;
  if(root.dataset.startupEnter!=='pending')return Promise.resolve();
  return new Promise(resolve=>{
    const observer=new MutationObserver(()=>{if(root.dataset.startupEnter==='pending')return;observer.disconnect();resolve()});
    observer.observe(root,{attributes:true,attributeFilter:['data-startup-enter']});
  });
}

export async function mountBusinessDashboardStartupRoute(host){
  if(document.documentElement.dataset.startupEnter!=='pending'){
    const {mountBusinessDashboardRoute}=await import('./business-dashboard.js?v=4');
    return mountBusinessDashboardRoute(host);
  }

  const placeholder=startupLoadingRoute();
  const staging=document.createElement('div');
  staging.hidden=true;
  staging.setAttribute('aria-hidden','true');
  host.append(placeholder,staging);

  let disposed=false;
  let realCleanup=null;
  const mounting=(async()=>{
    await waitForStartupReveal();
    if(disposed)return null;
    const {mountBusinessDashboardRoute}=await import('./business-dashboard.js?v=4');
    return mountBusinessDashboardRoute(staging);
  })().then(cleanup=>{
    realCleanup=typeof cleanup==='function'?cleanup:null;
    if(disposed){realCleanup?.();staging.remove();return}
    const realRoute=staging.querySelector(':scope > .business-dashboard-route');
    if(realRoute)placeholder.replaceWith(realRoute);
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
