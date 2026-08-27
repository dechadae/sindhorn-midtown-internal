const ROUTES={today:'/',guidance:'/guidance',details:'/details',messages:'/messages'};
const TITLES={today:'Live Air Quality | Sindhorn Midtown Hotel Bangkok',guidance:'Air Quality Guidance | Sindhorn Midtown Hotel Bangkok',details:'Reading Details | Sindhorn Midtown Hotel Bangkok',messages:'Environmental Messages | Sindhorn Midtown Hotel Bangkok'};
let routeTransition=null,transitionToken=0;

const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const routeForPath=path=>path.startsWith('/guidance')?'guidance':path.startsWith('/details')?'details':path.startsWith('/messages')?'messages':'today';
const routeHost=()=>document.getElementById('route-view');
const motion=()=>{const style=getComputedStyle(document.documentElement),duration=parseFloat(style.getPropertyValue('--app-transition-ms'))||280,easing=style.getPropertyValue('--app-transition-ease').trim()||'cubic-bezier(.22,1,.36,1)';return{duration,easing}};
function updateNav(route){document.querySelectorAll('[data-app-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.appRoute===route))}
async function commitRoute(route,{historyMode='push',scroll=true}={}){
  const pack=window.SindhornAppPack;if(!pack?.mountRoute)return false;
  if(!ROUTES[route])route='today';const target=ROUTES[route];
  if(historyMode&&location.pathname!==target)history[historyMode==='replace'?'replaceState':'pushState']({route},'',target);
  await pack.mountRoute(route,{animate:false});
  document.title=TITLES[route];updateNav(route);if(scroll)scrollTo({top:0,behavior:'auto'});return true;
}
async function fallbackRouteTransition(host,commit){
  if(!host||!host.animate||reduceMotion()){await commit();return}
  const {duration,easing}=motion(),half=Math.max(1,Math.round(duration/2));
  try{await host.animate([{opacity:1},{opacity:0}],{duration:half,easing,fill:'both'}).finished}catch(_){}
  await commit();
  try{await host.animate([{opacity:0},{opacity:1}],{duration:half,easing,fill:'both'}).finished}catch(_){}
}
export async function transitionToRoute(route,{historyMode='push',scroll=true}={}){
  if(!ROUTES[route])route='today';
  if(route===routeForPath(location.pathname)&&historyMode==='push'){if(scroll)scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});return}
  const token=++transitionToken,host=routeHost();let committed=false;
  const commit=async()=>{if(committed)return true;committed=true;return commitRoute(route,{historyMode,scroll})};
  routeTransition?.skipTransition?.();
  document.documentElement.dataset.appTransitioning='true';
  try{
    if(typeof document.startViewTransition==='function'&&host&&!reduceMotion()){
      host.style.viewTransitionName='app-route';
      routeTransition=document.startViewTransition(commit);
      await routeTransition.updateCallbackDone;
      await routeTransition.finished;
    }else await fallbackRouteTransition(host,commit);
  }catch(_){if(!committed)await commit()}
  finally{
    if(token===transitionToken){host?.style.removeProperty('view-transition-name');delete document.documentElement.dataset.appTransitioning;routeTransition=null}
  }
}
function eligibleClick(event){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey}
function fallbackPageNavigation(anchor,event){
  if(typeof document.startViewTransition==='function'||reduceMotion())return false;
  if(anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('download'))return false;
  let url;try{url=new URL(anchor.href,location.href)}catch(_){return false}
  if(url.origin!==location.origin||url.href===location.href)return false;
  event.preventDefault();event.stopImmediatePropagation();
  const {duration,easing}=motion(),fade=Math.max(1,Math.round(duration/2));
  const animation=document.documentElement.animate([{opacity:1},{opacity:0}],{duration:fade,easing,fill:'forwards'});
  animation.finished.catch(()=>{}).finally(()=>location.assign(url.href));return true;
}
document.addEventListener('click',event=>{
  if(event.defaultPrevented||!eligibleClick(event))return;
  const routeLink=event.target.closest?.('[data-app-route]');
  if(routeLink){event.preventDefault();event.stopImmediatePropagation();transitionToRoute(routeLink.dataset.appRoute).catch(()=>{});return}
  const anchor=event.target.closest?.('a[href]');if(anchor)fallbackPageNavigation(anchor,event);
},{capture:true});
addEventListener('popstate',event=>{
  if(!window.SindhornAppPack?.mountRoute)return;
  event.stopImmediatePropagation();transitionToRoute(routeForPath(location.pathname),{historyMode:null,scroll:false}).catch(()=>{});
},{capture:true});
window.SindhornNavigation={transitionToRoute};
