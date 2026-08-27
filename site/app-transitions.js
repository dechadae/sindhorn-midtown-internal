const ROUTES={today:'/',guidance:'/guidance',details:'/details',messages:'/messages'};
const TITLES={today:'Live Air Quality | Sindhorn Midtown Hotel Bangkok',guidance:'Air Quality Guidance | Sindhorn Midtown Hotel Bangkok',details:'Reading Details | Sindhorn Midtown Hotel Bangkok',messages:'Environmental Messages | Sindhorn Midtown Hotel Bangkok'};
let transitionToken=0;

const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const routeForPath=path=>path.startsWith('/guidance')?'guidance':path.startsWith('/details')?'details':path.startsWith('/messages')?'messages':'today';
const routeHost=()=>document.getElementById('route-view');
const motion=()=>{const style=getComputedStyle(document.documentElement),duration=parseFloat(style.getPropertyValue('--app-transition-ms'))||280,easing=style.getPropertyValue('--app-transition-ease').trim()||'cubic-bezier(.22,1,.36,1)';return{duration,easing}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function updateNav(route){document.querySelectorAll('[data-app-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.appRoute===route))}
async function commitRoute(route,{historyMode='push',scroll=true}={}){
  const pack=window.SindhornAppPack;if(!pack?.mountRoute)return false;
  if(!ROUTES[route])route='today';const target=ROUTES[route];
  if(historyMode&&location.pathname!==target)history[historyMode==='replace'?'replaceState':'pushState']({route},'',target);
  await pack.mountRoute(route,{animate:false});
  document.title=TITLES[route];updateNav(route);if(scroll)scrollTo({top:0,behavior:'auto'});return true;
}
async function routeOnlyFade(host,commit,token){
  if(!host||reduceMotion()){if(token===transitionToken)await commit();return}
  host.getAnimations?.().forEach(animation=>animation.cancel());
  const {duration,easing}=motion(),outMs=Math.max(1,Math.round(duration*.38)),inMs=Math.max(1,duration-outMs);
  let outAnimation=null,inAnimation=null;
  try{
    outAnimation=host.animate([{opacity:1},{opacity:0}],{duration:outMs,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    await outAnimation.finished;
  }catch(_){}
  if(token!==transitionToken)return;
  host.style.opacity='0';outAnimation?.cancel();
  await commit();
  if(token!==transitionToken){host.style.removeProperty('opacity');return}
  try{
    inAnimation=host.animate([{opacity:0},{opacity:1}],{duration:inMs,easing,fill:'forwards'});
    await inAnimation.finished;
  }catch(_){}
  if(token===transitionToken){inAnimation?.cancel();host.style.removeProperty('opacity')}
}
export async function transitionToRoute(route,{historyMode='push',scroll=true}={}){
  if(!ROUTES[route])route='today';
  if(route===routeForPath(location.pathname)&&historyMode==='push'){if(scroll)scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});return}
  const token=++transitionToken,host=routeHost();let committed=false;
  const commit=async()=>{if(committed)return true;committed=true;return commitRoute(route,{historyMode,scroll})};
  document.documentElement.dataset.appTransitioning='true';
  try{await routeOnlyFade(host,commit,token)}catch(_){if(token===transitionToken&&!committed)await commit()}
  finally{if(token===transitionToken)delete document.documentElement.dataset.appTransitioning}
}
function eligibleClick(event){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey}
function documentTone(url){return url.pathname.startsWith('/admin')?'paper':'plum'}
function ensureDocumentVeil(){
  let veil=document.querySelector('.app-document-veil');
  if(!veil){veil=document.createElement('div');veil.className='app-document-veil';veil.setAttribute('aria-hidden','true');document.body.appendChild(veil)}
  return veil;
}
async function navigateDocument(url,{replace=false}={}){
  if(reduceMotion()){location[replace?'replace':'assign'](url.href);return}
  const veil=ensureDocumentVeil(),{duration}=motion(),fadeMs=Math.max(90,Math.round(duration/2));
  veil.dataset.tone=documentTone(url);
  veil.getAnimations?.().forEach(animation=>animation.cancel());
  document.documentElement.dataset.appTransitioning='true';
  try{
    const animation=veil.animate([{opacity:0},{opacity:1}],{duration:fadeMs,easing:'linear',fill:'forwards'});
    await Promise.race([animation.finished.catch(()=>{}),wait(fadeMs+40)]);
  }finally{location[replace?'replace':'assign'](url.href)}
}
function handleDocumentNavigation(anchor,event){
  if(anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('download'))return false;
  let url;try{url=new URL(anchor.href,location.href)}catch(_){return false}
  if(url.origin!==location.origin||url.href===location.href)return false;
  if(url.pathname===location.pathname&&url.search===location.search&&url.hash!==location.hash)return false;
  event.preventDefault();event.stopImmediatePropagation();navigateDocument(url).catch(()=>location.assign(url.href));return true;
}
document.addEventListener('click',event=>{
  if(event.defaultPrevented||!eligibleClick(event))return;
  const routeLink=event.target.closest?.('[data-app-route]');
  if(routeLink){event.preventDefault();event.stopImmediatePropagation();transitionToRoute(routeLink.dataset.appRoute).catch(()=>{});return}
  const anchor=event.target.closest?.('a[href]');if(anchor)handleDocumentNavigation(anchor,event);
},{capture:true});
addEventListener('popstate',event=>{
  if(!window.SindhornAppPack?.mountRoute)return;
  event.stopImmediatePropagation();transitionToRoute(routeForPath(location.pathname),{historyMode:null,scroll:false}).catch(()=>{});
},{capture:true});
addEventListener('pageshow',()=>{delete document.documentElement.dataset.appTransitioning;document.querySelector('.app-document-veil')?.remove()});
window.SindhornNavigation={transitionToRoute,navigateDocument};
