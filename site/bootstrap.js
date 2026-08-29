import {ROUTES,canonicalRoute,routeForPath} from './route-registry.js';

const SHELL_VERSION=17;
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const TABLE='sindhorn_app_files';
const PACK_CACHE='sindhorn-midtown-ui-pack-v1';
const PACK_REQUEST='/__sindhorn_ui_pack_v1__';
const FALLBACK_ROOT='/fallback/';
const REQUIRED=['header.html','today.html','guidance.html','details.html','footer.html','ui.css','environment-config.json'];
const FALLBACK_REQUIRED=[...REQUIRED,'messages.html'];
const encoder=new TextEncoder();

let activePack=null;
let refreshPromise=null;
let presentationRecovery=null;
let routeCleanup=null;
const headerHost=document.getElementById('app-header');
const routeHost=document.getElementById('route-view');
const footerHost=document.getElementById('app-footer');
if(!headerHost||!routeHost||!footerHost)throw new Error('Sindhorn shell hosts unavailable');

async function digest(text){
  if(!crypto?.subtle)throw new Error('Web Crypto unavailable');
  const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(text));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function parseJson(text,label){try{return JSON.parse(text)}catch(_){throw new Error('Invalid '+label)}}
function validateManifestShape(manifest){
  if(!manifest||manifest.appPack<1||manifest.minimumShell>SHELL_VERSION||!Array.isArray(manifest.resources))throw new Error('Incompatible app pack');
  const names=new Set(manifest.resources.map(item=>item?.path));
  for(const path of REQUIRED)if(!names.has(path))throw new Error('App pack missing '+path);
}
async function validatePack(pack){
  validateManifestShape(pack.manifest);
  for(const item of pack.manifest.resources){
    if(!item||typeof item.path!=='string'||typeof item.sha256!=='string'||typeof item.contentType!=='string')throw new Error('Invalid resource manifest');
    const resource=pack.resources[item.path];
    if(!resource||resource.contentType!==item.contentType)throw new Error('Resource type mismatch: '+item.path);
    if(await digest(resource.content)!==item.sha256)throw new Error('Resource integrity mismatch: '+item.path);
  }
  const environment=parseJson(pack.resources['environment-config.json'].content,'environment configuration');
  if(environment.schema!==1)throw new Error('Unsupported environment configuration');
  return pack;
}
async function fallbackPack(){
  const names=['manifest.json',...FALLBACK_REQUIRED];
  const entries=await Promise.all(names.map(async path=>{
    const response=await fetch(FALLBACK_ROOT+path,{cache:'no-store'});
    if(!response.ok)throw new Error('Fallback resource unavailable: '+path);
    return[path,await response.text(),response.headers.get('content-type')||''];
  }));
  const map=Object.fromEntries(entries.map(([path,content,type])=>[path,{content,contentType:type}]));
  const manifest=parseJson(map['manifest.json'].content,'fallback manifest');
  const resources={};
  for(const item of manifest.resources){
    const fallback=map[item.path];
    if(!fallback)throw new Error('Fallback resource unavailable: '+item.path);
    resources[item.path]={content:fallback.content,contentType:item.contentType};
  }
  return validatePack({manifest,resources,source:'fallback'});
}
async function readCachedPack(){
  if(!('caches'in window))return null;
  try{
    const cache=await caches.open(PACK_CACHE),response=await cache.match(PACK_REQUEST);
    if(!response)return null;
    return await validatePack(await response.json());
  }catch(_){return null}
}
async function cachePack(pack){
  if(!('caches'in window))return;
  const cache=await caches.open(PACK_CACHE);
  await cache.put(PACK_REQUEST,new Response(JSON.stringify({...pack,source:'cache'}),{headers:{'Content-Type':'application/json'}}));
}
function rest(path){return fetch(SUPABASE_URL+'/rest/v1/'+TABLE+path,{cache:'no-store',headers:{apikey:SUPABASE_KEY,Accept:'application/json'}})}
async function remotePack(){
  const latest=await rest('?select=pack_id&enabled=eq.true&order=pack_id.desc&limit=1');
  if(!latest.ok)throw new Error('UI pack manifest lookup failed');
  const ids=await latest.json(),packId=Number(ids?.[0]?.pack_id);
  if(!Number.isFinite(packId))throw new Error('No enabled UI pack');
  const response=await rest(`?select=pack_id,path,content,content_type,content_sha256,enabled,updated_at&pack_id=eq.${packId}&enabled=eq.true&order=path.asc`);
  if(!response.ok)throw new Error('UI pack fetch failed');
  const rows=await response.json(),rowMap=Object.fromEntries(rows.map(row=>[row.path,row])),manifestRow=rowMap['manifest.json'];
  if(!manifestRow)throw new Error('Remote UI pack has no manifest');
  if(await digest(manifestRow.content)!==manifestRow.content_sha256)throw new Error('Remote manifest integrity mismatch');
  const manifest=parseJson(manifestRow.content,'remote manifest'),resources={};
  if(Number(manifest.appPack)!==packId)throw new Error('Remote pack version mismatch');
  for(const item of manifest.resources){
    const row=rowMap[item.path];
    if(!row||row.content_type!==item.contentType||row.content_sha256!==item.sha256)throw new Error('Remote resource metadata mismatch: '+item.path);
    resources[item.path]={content:row.content,contentType:row.content_type};
  }
  return validatePack({manifest,resources,source:'remote'});
}
function environmentConfig(){try{return parseJson(activePack.resources['environment-config.json'].content,'environment configuration')}catch(_){return null}}
function normalizeFooterNavigation(){
  footerHost.querySelectorAll('[data-app-route="guidance"],[data-app-route="details"]').forEach(link=>link.remove());
  const messages=footerHost.querySelector('[data-app-route="messages"]');
  let fnb=footerHost.querySelector('[data-app-route="fnb"]');
  if(!fnb){
    fnb=document.createElement('a');fnb.className='nav-chip';fnb.href='/fnb';fnb.dataset.appRoute='fnb';fnb.setAttribute('aria-label','F&B');
    const label=document.createElement('span');label.textContent='F&B';fnb.appendChild(label);
    if(messages)messages.before(fnb);else footerHost.querySelector('.app-tabbar')?.appendChild(fnb);
  }else{
    fnb.href='/fnb';fnb.setAttribute('aria-label','F&B');const label=fnb.querySelector('span')||fnb.appendChild(document.createElement('span'));label.textContent='F&B';
  }
}
function applyPersistentPresentation(pack){
  let style=document.getElementById('sindhorn-ui-pack-style');
  if(!style){style=document.createElement('style');style.id='sindhorn-ui-pack-style';document.head.appendChild(style)}
  style.textContent=pack.resources['ui.css'].content;headerHost.innerHTML=pack.resources['header.html'].content;footerHost.innerHTML=pack.resources['footer.html'].content;normalizeFooterNavigation();
}
async function cleanupRoute(){const cleanup=routeCleanup;routeCleanup=null;if(typeof cleanup==='function')try{await cleanup()}catch(_){}}
async function mountLocalRoute(route,definition){
  const module=await import(definition.module),mount=module?.[definition.mount];
  if(typeof mount!=='function')throw new Error(`Local route mount unavailable: ${route}`);
  routeHost.replaceChildren();
  const cleanup=await mount(routeHost,{profile:window.__SINDHORN_AUTH_PROFILE__});
  routeCleanup=typeof cleanup==='function'?cleanup:null;
}
function packResourcePaths(definition){return Array.isArray(definition.resources)?definition.resources:[definition.resource]}
function packMarkup(definition){
  const paths=packResourcePaths(definition),resources=paths.map(path=>activePack.resources[path]);
  if(resources.some(resource=>!resource))return null;
  return resources.map(resource=>resource.content).join('\n');
}
async function mountRoute(route=routeForPath(location.pathname)||'today',{animate=true}={}){
  if(!activePack)return;
  route=canonicalRoute(route);let definition=ROUTES[route]||ROUTES.today;
  await cleanupRoute();routeHost.dataset.shellRoute=route;
  if(definition.kind==='pack'){
    let markup=packMarkup(definition);
    if(markup===null){route='today';definition=ROUTES.today;markup=packMarkup(definition)}
    if(markup===null)throw new Error('Today presentation resources unavailable');
    routeHost.innerHTML=markup;
  }else await mountLocalRoute(route,definition);
  routeHost.classList.toggle('route-enter',animate);if(animate)requestAnimationFrame(()=>setTimeout(()=>routeHost.classList.remove('route-enter'),280));
  document.body.dataset.route=route;footerHost.querySelectorAll('[data-app-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.appRoute===route));
  document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route,packId:activePack.manifest.appPack}}));
}
async function applyPack(pack,{mount=true}={}){
  activePack=pack;applyPersistentPresentation(pack);if(mount)await mountRoute(routeForPath(location.pathname)||'today',{animate:false});
  document.body.dataset.appPack=String(pack.manifest.appPack);document.body.dataset.appPackSource=pack.source||'unknown';
  document.dispatchEvent(new CustomEvent('sindhorn:environment-config',{detail:environmentConfig()}));document.dispatchEvent(new CustomEvent('sindhorn:pack-updated',{detail:{packId:pack.manifest.appPack,source:pack.source}}));
}
async function refreshPack(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{try{
    const next=await remotePack();
    if(activePack&&next.manifest.appPack<activePack.manifest.appPack)return activePack;
    await cachePack(next);
    const versionChanged=!activePack||next.manifest.appPack!==activePack.manifest.appPack;
    if(versionChanged){await applyPack(next,{mount:true});await presentationRecovery?.recoverPresentationSwap?.()}
    return next;
  }finally{refreshPromise=null}})();
  return refreshPromise;
}

window.SindhornAppPack={shellVersion:SHELL_VERSION,mountRoute,refresh:refreshPack,getManifest:()=>activePack?structuredClone(activePack.manifest):null,getEnvironmentConfig:()=>environmentConfig(),getResource:path=>activePack?.resources?.[path]?.content??null,getRoute:()=>routeForPath(location.pathname)||'today'};
document.documentElement.dataset.shellLoading='true';
const initial=(await readCachedPack())||(await fallbackPack());await applyPack(initial,{mount:true});
const live=await import('./live-data.js');await live.initLiveData();
const environment=await import('./environment.js');await environment.initEnvironment();
/* initEnvironment schedules its first WebGL render on requestAnimationFrame.
   Keep the persistent shell hidden for two paint opportunities so the GPU
   canvas is already populated before the header/route/footer are released. */
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
document.documentElement.dataset.shellLoading='false';
presentationRecovery=await import('./presentation-recovery.js');
const inbox=await import('./notification-inbox.js');await inbox.initNotificationInbox();
const app=await import('./app.js');await app.initApp();
const activeRoute=routeForPath(location.pathname)||'today';document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:activeRoute,packId:activePack.manifest.appPack}}));document.body.dataset.route=activeRoute;document.title=ROUTES[activeRoute]?.title||ROUTES.today.title;
refreshPack().catch(error=>console.warn('Sindhorn UI pack update unavailable; using known-good pack.',error));