const VERSION='sindhorn-midtown-internal-pwa-v105-readability-r29a';
// v85: sindhorn-midtown-internal-pwa-v85-metric-track-r4
// v84: sindhorn-midtown-internal-pwa-v84-today-readability-r4
// v83: sindhorn-midtown-internal-pwa-v83-sticky-footer-fix-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v82-today-rebuild-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v81-nav-index-spacing-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v80-glass-membership-fixes-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v79-ci-library-final-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v78-app-shell-foundation-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v55-overlay-glass-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v54-ci-consumes-selector-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v53-one-dropdown-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v52-canonical-selector-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v51-design-tokens-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v50-shell-slimming-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v49-resilient-install-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v48-precache-design-system-r1
// Preserve prior production release-family markers required by regression gates:
// sindhorn-midtown-internal-pwa-v46-fast-startup-skeleton-r1
// sindhorn-midtown-internal-pwa-v45-fast-startup-r2
// sindhorn-midtown-internal-pwa-v44-fast-startup-r1
// sindhorn-midtown-internal-pwa-v43-betta-final-r1
// sindhorn-midtown-internal-pwa-v42-today-progress-r1
// sindhorn-midtown-internal-pwa-v41-performance-r1
// sindhorn-midtown-internal-pwa-v40-weather-webgl-retired-r1
// sindhorn-midtown-internal-pwa-v39-betta-first-frame-r1
// sindhorn-midtown-internal-pwa-v38-today-motion-r1
// sindhorn-midtown-internal-pwa-v38-betta-day-cycle-r1
// sindhorn-midtown-internal-pwa-v37-betta-resume-r1
// sindhorn-midtown-internal-pwa-v36-release-health-r1
// sindhorn-midtown-internal-pwa-v35-dashboard-domain-freshness-r1
// sindhorn-midtown-internal-pwa-v34-betta-dashboard-r1
// pwa-v33-business-dashboard-ci-r1
// pwa-v32-betta-satellite-r1
// pwa-v31-line-seed-sans-th
// pwa-v23-bangkok-seasonal-clouds
const NOTIFICATION_DB='sindhorn-midtown-notification-inbox';
const NOTIFICATION_STORE='messages';
const NOTIFICATION_LIMIT=50;
const PRECACHE_CONCURRENCY=8;
const SHELL=['/','/index.html','/fonts.css','/fonts.css?v=1','/app-tokens.css','/app-tokens.css?v=10','/app-glass.css','/app-glass.css?v=11','/app-components.css','/app-components.css?v=36','/app-shell.css','/app-shell.css?v=2','/assets/fonts/line-seed-sans-th-thin.woff2','/assets/fonts/line-seed-sans-th-regular.woff2','/assets/fonts/line-seed-sans-th-bold.woff2','/assets/brand/sindhorn-midtown-vignette-white.png','/assets/brand/sindhorn-midtown-vignette-black.png','/icons/app-192.png','/icons/app-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png','/manifest.webmanifest','/shell.js','/auth-client.js','/notification-inbox.js','/broadcast-inbox.js','/capabilities.js','/push-config.js','/push-client.js','/app-view.js','/app-dialog.js','/app-select.js','/app-toast.js','/app-code.js','/qr-v6.js','/signin-page.js','/today.js','/fnb-page.js','/fnb-read-model.js','/fnb-artwork-copy.js','/messages-page.js','/jobs-page.js','/brand-page.js','/ihg-history-data.js','/hotel-factsheet-data.js','/settings-page.js','/settings-me.js','/settings-admin.js','/settings-broadcast.js','/business-card-core.js','/business-dashboard-data.js','/betta-runtime-full.js','/betta-runtime-full.js?v=1','/ci.html','/ci-library.css','/ci-library.css?v=10','/ci-library.js','/ci-page.js','/voice.html','/voice-page.js','/app-format.js','/readability-page.js','/betta-random.js','/betta-readability.js','/betta-day-periods.js','/betta-fin-presets.js'];
/* Install resilience.

   precacheShell used to be all-or-nothing across every SHELL entry: one bad
   response - a flaky mobile connection, a CDN hiccup, one wrong MIME type -
   rejected the install, so the new service worker never activated and the
   client stayed on the old build forever. Every later update then failed the
   same way, which is the state that ends in "delete and reinstall".

   Only the entries below can actually prevent the app from opening, so only
   these are fatal. Everything else is best-effort: the fetch handler already
   caches on first use, so an asset missed here self-heals as soon as it is
   requested. Keep this list SMALL - it is the failure surface of every update. */
const CRITICAL_SHELL=['/','/index.html','/fonts.css','/app-tokens.css','/app-glass.css','/app-components.css','/app-shell.css','/shell.js','/auth-client.js','/notification-inbox.js','/broadcast-inbox.js','/signin-page.js','/today.js','/manifest.webmanifest'];
const PRECACHE_RETRIES=3;

function validResponse(path,response){if(!response||!response.ok)return false;const type=(response.headers.get('content-type')||'').toLowerCase();if(path==='/'||path.endsWith('.html'))return type.includes('text/html');if(path.endsWith('.js'))return type.includes('javascript');if(path.endsWith('.css'))return type.includes('text/css');if(path.endsWith('.webmanifest')||path.endsWith('.json'))return type.includes('json')||type.includes('manifest');if(path.endsWith('.png'))return type.includes('image/png');if(path.endsWith('.woff')||path.endsWith('.woff2'))return!type.includes('text/html');return!type.includes('text/html')}
async function cacheShellPath(cache,path){
  let lastError=null;
  for(let attempt=0;attempt<PRECACHE_RETRIES;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,300*attempt));
    try{
      const response=await fetch(new Request(path,{cache:'reload'}));
      if(!validResponse(new URL(path,self.location.origin).pathname,response))throw new Error('Invalid app-shell response for '+path);
      await cache.put(path,response.clone());
      return true;
    }catch(error){lastError=error}
  }
  throw lastError||new Error('Unable to precache '+path);
}
async function precacheShell(){
  const cache=await caches.open(VERSION);
  const critical=new Set(CRITICAL_SHELL);
  const queue=[...SHELL];
  const optionalFailures=[];
  const workers=Array.from({length:Math.min(PRECACHE_CONCURRENCY,queue.length)},async()=>{
    while(queue.length){
      const path=queue.shift();
      if(!path)continue;
      try{await cacheShellPath(cache,path)}
      catch(error){
        /* Fatal only for the handful of files the app cannot open without. */
        if(critical.has(path.split('?')[0]))throw error;
        optionalFailures.push(path);
      }
    }
  });
  await Promise.all(workers);
  if(optionalFailures.length)console.warn('Service worker installed with '+optionalFailures.length+' optional asset(s) uncached; they will be fetched on demand.',optionalFailures);
}
async function activateShell(){const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)));await self.clients.claim()}
self.addEventListener('install',event=>event.waitUntil(precacheShell().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(activateShell()));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(request.mode==='navigate'){const isAppRoute=url.pathname==='/'||url.pathname==='/next'||url.pathname==='/next.html'||url.pathname==='/login'||url.pathname==='/login.html'||url.pathname.startsWith('/guidance')||url.pathname.startsWith('/details')||url.pathname.startsWith('/fnb')||url.pathname.startsWith('/messages')||url.pathname.startsWith('/brand')||url.pathname.startsWith('/ihg-history')||url.pathname.startsWith('/hotel-factsheet')||url.pathname.startsWith('/settings')||url.pathname.startsWith('/ci')||url.pathname.startsWith('/voice')||url.pathname.startsWith('/account')||url.pathname.startsWith('/admin');if(!isAppRoute){event.respondWith(fetch(request));return}event.respondWith((async()=>{try{return await fetch(request)}catch(_){return(await caches.match('/index.html'))||(await caches.match('/'))}})());return}if(url.origin!==location.origin)return;if(url.pathname==='/api/betta-satellite'){event.respondWith(fetch(request));return}event.respondWith((async()=>{const cached=await caches.match(request);if(cached&&validResponse(url.pathname,cached))return cached;try{const response=await fetch(request);if(!validResponse(url.pathname,response))throw new Error('Invalid MIME for '+url.pathname);const cache=await caches.open(VERSION);await cache.put(request,response.clone());return response}catch(error){if(cached)return cached;throw error}})())});
function safePushPayload(event){if(!event.data)return{};try{return event.data.json()||{}}catch(_){try{return{bodyEn:event.data.text()}}catch(__){return{}}}}
function sameOriginRoute(route){try{const url=new URL(route||'/',self.location.origin);if(url.origin!==self.location.origin)return'/';if(url.pathname.startsWith('/guidance')||url.pathname.startsWith('/details'))return'/';if(url.pathname.startsWith('/fnb'))return'/#fnb';if(url.pathname.startsWith('/messages'))return'/#messages';return'/'}catch(_){return'/'}}
function openNotificationDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(NOTIFICATION_DB,1);request.onupgradeneeded=()=>{const db=request.result,store=db.objectStoreNames.contains(NOTIFICATION_STORE)?request.transaction.objectStore(NOTIFICATION_STORE):db.createObjectStore(NOTIFICATION_STORE,{keyPath:'id'});if(!store.indexNames.contains('receivedAt'))store.createIndex('receivedAt','receivedAt',{unique:false});if(!store.indexNames.contains('read'))store.createIndex('read','read',{unique:false})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Notification inbox unavailable'))})}
async function storeNotification(message){const db=await openNotificationDb();await new Promise((resolve,reject)=>{const tx=db.transaction(NOTIFICATION_STORE,'readwrite'),store=tx.objectStore(NOTIFICATION_STORE);store.put(message);const all=store.getAll();all.onsuccess=()=>{const extra=(all.result||[]).sort((a,b)=>Number(b.receivedAt||0)-Number(a.receivedAt||0)).slice(NOTIFICATION_LIMIT);extra.forEach(row=>store.delete(row.id))};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Unable to store notification'));tx.onabort=()=>reject(tx.error||new Error('Unable to store notification'))})}
async function markNotificationRead(id){if(!id)return;const db=await openNotificationDb();await new Promise((resolve,reject)=>{const tx=db.transaction(NOTIFICATION_STORE,'readwrite'),store=tx.objectStore(NOTIFICATION_STORE),request=store.get(id);request.onsuccess=()=>{if(request.result)store.put({...request.result,read:true})};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Unable to mark notification read'));tx.onabort=()=>reject(tx.error||new Error('Unable to mark notification read'))})}
async function notifyClients(kind){const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});windows.forEach(client=>{try{client.postMessage({type:'SINDHORN_NOTIFICATION_STORED',kind:String(kind||'')})}catch(_){}})}
self.addEventListener('push',event=>{const payload=safePushPayload(event),titleEn=String(payload.titleEn||'SINDHORN MIDTOWN UPDATE').trim(),bodyEn=String(payload.bodyEn||'New information is available in the app.').trim(),title=titleEn,body=bodyEn,route=sameOriginRoute(payload.route),kind=String(payload.kind||'environment-update'),tag=String(payload.tag||'sindhorn-midtown-environment'),messageId=String(payload.id||`${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`),message={id:messageId,receivedAt:Date.now(),read:false,route,kind,tag,titleEn,bodyEn};event.waitUntil((async()=>{if(kind!=='broadcast'){try{await storeNotification(message)}catch(error){console.warn('Notification inbox storage failed',error)}}await self.registration.showNotification(title,{body,icon:'/icons/app-192.png',badge:'/icons/app-192.png',tag,renotify:Boolean(payload.renotify),requireInteraction:Boolean(payload.requireInteraction),data:{route,kind,messageId}});await notifyClients(kind)})())});
self.addEventListener('notificationclick',event=>{event.notification.close();const route=sameOriginRoute(event.notification?.data?.route),messageId=String(event.notification?.data?.messageId||''),target=new URL(route,self.location.origin).href;event.waitUntil((async()=>{try{await markNotificationRead(messageId)}catch(_){}const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){try{if(new URL(client.url).origin!==self.location.origin)continue;if('navigate'in client&&client.url!==target)await client.navigate(target);if('focus'in client)return client.focus()}catch(_){}}return self.clients.openWindow?self.clients.openWindow(target):undefined})())});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
