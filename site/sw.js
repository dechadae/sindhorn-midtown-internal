const VERSION='sindhorn-midtown-internal-pwa-v48-foreground-first-test-r1';

// Diagnostic foreground-first service worker.
// Intentionally performs no precache and registers no fetch handler, so an
// installed launch is not intercepted by service-worker navigation/subresource
// logic. The page schedules registration/update only after the shared
// Today+Betta startup reveal. Production push/offline behavior is not changed;
// this file exists only on the preview branch to isolate startup ownership.

self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
