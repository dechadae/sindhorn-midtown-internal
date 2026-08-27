import {ROUTES,canonicalRoute,routeForPath,routePath,routeTitle} from './route-registry.js';

let transitionToken=0;
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const routeHost=()=>document.getElementById('route-view');
const motion=()=>{const style=getComputedStyle(document.documentElement),duration=parseFloat(style.getPropertyValue('--app-transition-ms'))||280,easing=style.getPropertyValue('--app-transition-ease').trim()||'cubic-bezier(.22,1,.36,1)';return{duration,easing}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function updateNav(route){document.querySelectorAll('[data-app-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.appRoute===route))}
async function commitRoute(route,{historyMode='push',scroll=true}={}){
  const pack=window.SindhornAppPack;if(!pack?.mountRoute)return false;
  route=canonicalRoute(route);const target=routePath(route);
  if(historyMode&&location.pathname!==target)history[historyMode==='replace'?'replaceState':'pushState']({route},'',target);
  await pack.mountRoute(route,{animate:false});
  document.title=routeTitle(route);updateNav(route);if(scroll)scrollTo({top:0,behavior:'auto'});return true;
}
async function routeOnlyFade(host,commit,token){
  if(!host||reduceMotion()){if(token===transitionToken)await commit();return}
  host.getAnimations?.().forEach(animation=>animation.cancel());
  const {duration,easing}=motion(),outMs=Math.max(1,Math.round(duration*.38)),inMs=Math.max(1,duration-outMs);
  let outAnimation=null,inAnimation=null;
  try{outAnimation=host.animate([{opacity:1},{opacity:0}],{duration:outMs,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});await outAnimation.finished}catch(_){}
  if(token!==transitionToken)return;
  host.style.opacity='0';outAnimation?.cancel();
  await commit();
  if(token!==transitionToken){host.style.removeProperty('opacity');return}
  try{inAnimation=host.animate([{opacity:0},{opacity:1}],{duration:inMs,easing,fill:'forwards'});await inAnimation.finished}catch(_){}
  if(token===transitionToken){inAnimation?.cancel();host.style.removeProperty('opacity')}
}
export async function transitionToRoute(route,{historyMode='push',scroll=true}={}){
  route=canonicalRoute(route);
  const current=routeForPath(location.pathname)||'today';
  if(route===current&&historyMode==='push'){if(scroll)scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});return}
  const token=++transitionToken,host=routeHost();let committed=false;
  const commit=async()=>{if(committed)return true;committed=true;return commitRoute(route,{historyMode,scroll})};
  document.documentElement.dataset.appTransitioning='true';
  try{await routeOnlyFade(host,commit,token)}catch(_){if(token===transitionToken&&!committed)await commit()}
  finally{if(token===transitionToken)delete document.documentElement.dataset.appTransitioning}
}
function eligibleClick(event){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey}
function documentTone(url){return url.pathname.startsWith('/login')?'plum':'paper'}
function ensureDocumentVeil(){
  let veil=document.querySelector('.app-document-veil');
  if(!veil){veil=document.createElement('div');veil.className='app-document-veil';veil.setAttribute('aria-hidden','true');document.body.appendChild(veil)}
  return veil;
}
export async function navigateDocument(url,{replace=false}={}){
  const target=url instanceof URL?url:new URL(url,location.href);
  if(reduceMotion()){location[replace?'replace':'assign'](target.href);return}
  const veil=ensureDocumentVeil(),{duration}=motion(),fadeMs=Math.max(90,Math.round(duration/2));
  veil.dataset.tone=documentTone(target);veil.getAnimations?.().forEach(animation=>animation.cancel());document.documentElement.dataset.appTransitioning='true';
  try{const animation=veil.animate([{opacity:0},{opacity:1}],{duration:fadeMs,easing:'linear',fill:'forwards'});await Promise.race([animation.finished.catch(()=>{}),wait(fadeMs+40)])}
  finally{location[replace?'replace':'assign'](target.href)}
}
function appRouteFromAnchor(anchor){
  if(anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('download'))return null;
  let url;try{url=new URL(anchor.href,location.href)}catch(_){return null}
  if(url.origin!==location.origin)return null;
  const route=routeForPath(url.pathname);return route?{route,url}:null;
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
  if(routeLink&&ROUTES[routeLink.dataset.appRoute]){event.preventDefault();event.stopImmediatePropagation();transitionToRoute(routeLink.dataset.appRoute).catch(()=>{});return}
  const anchor=event.target.closest?.('a[href]');if(!anchor)return;
  const appTarget=appRouteFromAnchor(anchor);
  if(appTarget){event.preventDefault();event.stopImmediatePropagation();transitionToRoute(appTarget.route).catch(()=>{});return}
  handleDocumentNavigation(anchor,event);
},{capture:true});
addEventListener('popstate',event=>{
  if(!window.SindhornAppPack?.mountRoute)return;
  const route=routeForPath(location.pathname);if(!route)return;
  event.stopImmediatePropagation();transitionToRoute(route,{historyMode:null,scroll:false}).catch(()=>{});
},{capture:true});
addEventListener('pageshow',()=>{delete document.documentElement.dataset.appTransitioning;document.querySelector('.app-document-veil')?.remove()});
window.SindhornNavigation={transitionToRoute,navigateDocument,routeForPath};
