const VERSION='sindhorn-midtown-internal-pwa-v2';
const SHELL=[
  '/', '/index.html', '/environment.css', '/environment.js', '/pwa.css', '/app.js', '/manifest.webmanifest',
  '/icons/app-192.png','/icons/app-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png',
  '/vendor/three.module.js','/assets/brand/sindhorn-midtown-vignette-white.png','/assets/brand/sindhorn-midtown-vignette-black.png',
  '/assets/fonts/vignette-sans-light.woff','/assets/fonts/vignette-sans-regular.woff','/assets/fonts/vignette-sans-semibold.woff',
  '/assets/fonts/ibm-plex-sans-thai-light.woff2','/assets/fonts/ibm-plex-sans-thai-regular.woff2','/assets/fonts/ibm-plex-sans-thai-semibold.woff2'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(VERSION).then(cache=>cache.put('/index.html',copy));
      return response;
    }).catch(()=>caches.match('/index.html')));
    return;
  }
  if(url.origin!==location.origin)return;
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
