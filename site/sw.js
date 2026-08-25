const VERSION='sindhorn-midtown-internal-pwa-v7';
const SHELL=[
  '/', '/index.html', '/environment.css', '/environment.bundle.js', '/pwa.css', '/app.js', '/manifest.webmanifest',
  '/icons/app-192.png','/icons/app-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png','/assets/brand/sindhorn-midtown-vignette-white.png','/assets/brand/sindhorn-midtown-vignette-black.png',
  '/assets/fonts/vignette-sans-light.woff','/assets/fonts/vignette-sans-regular.woff','/assets/fonts/vignette-sans-semibold.woff',
  '/assets/fonts/ibm-plex-sans-thai-light.woff2','/assets/fonts/ibm-plex-sans-thai-regular.woff2','/assets/fonts/ibm-plex-sans-thai-semibold.woff2'
];

function validResponse(path,response){
  if(!response||!response.ok)return false;
  const type=(response.headers.get('content-type')||'').toLowerCase();
  if(path==='/'||path.endsWith('.html'))return type.includes('text/html');
  if(path.endsWith('.js'))return type.includes('javascript');
  if(path.endsWith('.css'))return type.includes('text/css');
  if(path.endsWith('.webmanifest'))return type.includes('json')||type.includes('manifest');
  if(path.endsWith('.png'))return type.includes('image/png');
  if(path.endsWith('.woff')||path.endsWith('.woff2'))return !type.includes('text/html');
  return !type.includes('text/html');
}

async function precacheShell(){
  const cache=await caches.open(VERSION);
  for(const path of SHELL){
    const response=await fetch(new Request(path,{cache:'reload'}));
    if(!validResponse(path,response))throw new Error('Invalid app-shell response for '+path);
    await cache.put(path,response.clone());
  }
}

self.addEventListener('install',event=>{
  event.waitUntil(precacheShell().then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        const type=(response.headers.get('content-type')||'').toLowerCase();
        if(response.ok&&type.includes('text/html')){
          const cache=await caches.open(VERSION);
          await cache.put('/index.html',response.clone());
        }
        return response;
      }catch(_){
        return (await caches.match('/index.html'))||(await caches.match('/'));
      }
    })());
    return;
  }

  if(url.origin!==location.origin)return;
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached&&validResponse(url.pathname,cached)){
      fetch(request).then(async response=>{
        if(validResponse(url.pathname,response)){
          const cache=await caches.open(VERSION);
          await cache.put(request,response.clone());
        }
      }).catch(()=>{});
      return cached;
    }
    try{
      const response=await fetch(request);
      if(!validResponse(url.pathname,response))throw new Error('Invalid MIME for '+url.pathname);
      const cache=await caches.open(VERSION);
      await cache.put(request,response.clone());
      return response;
    }catch(error){
      if(cached)return cached;
      throw error;
    }
  })());
});

self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
