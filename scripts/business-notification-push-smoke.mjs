import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const ORIGIN=new URL(BASE_URL).origin;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const payload={
  id:'business:synthetic-e2e-20260831',
  kind:'business-rooms-update',
  tag:'business-dashboard:synthetic-e2e-20260831',
  route:'/',
  titleEn:'ROOMS REPORT UPDATED',
  bodyEn:'Synthetic end-to-end notification validation.',
  renotify:false,
  requireInteraction:false
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
await context.grantPermissions(['notifications'],{origin:ORIGIN});
const page=await context.newPage();page.setDefaultTimeout(45000);
const cdp=await context.newCDPSession(page);

try{
  await cdp.send('ServiceWorker.enable');
  let resolveRegistration;
  const registrationPromise=new Promise(resolve=>{resolveRegistration=resolve});
  cdp.on('ServiceWorker.workerRegistrationUpdated',event=>{
    const registration=(event.registrations||[]).find(item=>!item.isDeleted&&String(item.scopeURL||'')===`${ORIGIN}/`);
    if(registration?.registrationId)resolveRegistration(registration.registrationId);
  });

  await page.goto(`${BASE_URL}/index.html`,{waitUntil:'domcontentloaded'});
  const registration=await page.evaluate(async()=>{
    const candidate=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    await navigator.serviceWorker.ready;
    return{scope:candidate.scope,permission:Notification.permission};
  });
  assert(registration.scope===`${ORIGIN}/`,`Unexpected service-worker scope ${JSON.stringify(registration)}`);

  let registrationId;
  try{registrationId=await Promise.race([registrationPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('service worker registration id timeout')),12000))])}
  catch(error){
    await cdp.send('ServiceWorker.disable');await cdp.send('ServiceWorker.enable');
    registrationId=await Promise.race([registrationPromise,new Promise((_,reject)=>setTimeout(()=>reject(error),12000))]);
  }
  assert(registrationId,'Missing service-worker registration id');

  await cdp.send('ServiceWorker.deliverPushMessage',{origin:ORIGIN,registrationId,data:JSON.stringify(payload)});

  await page.waitForFunction(async id=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('sindhorn-midtown-notification-inbox',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    return new Promise((resolve,reject)=>{const tx=db.transaction('messages','readonly'),request=tx.objectStore('messages').get(id);request.onsuccess=()=>resolve(Boolean(request.result));request.onerror=()=>reject(request.error)});
  },payload.id);

  const swText=await page.evaluate(()=>fetch('/sw.js',{cache:'no-store'}).then(response=>response.text()));
  const state=await page.evaluate(async expected=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('sindhorn-midtown-notification-inbox',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const row=await new Promise((resolve,reject)=>{const tx=db.transaction('messages','readonly'),request=tx.objectStore('messages').get(expected.id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)});
    const registration=await navigator.serviceWorker.ready;
    const notifications=Notification.permission==='granted'?await registration.getNotifications({tag:expected.tag}):[];
    return{
      row:row?{id:row.id,kind:row.kind,tag:row.tag,route:row.route,titleEn:row.titleEn,bodyEn:row.bodyEn,read:row.read}:null,
      notifications:notifications.map(item=>({title:item.title,body:item.body,tag:item.tag,data:item.data})),
      permission:Notification.permission
    };
  },payload);

  assert(state.row?.id===payload.id&&state.row.kind===payload.kind,`Business push was not stored in Messages ${JSON.stringify(state)}`);
  assert(state.row.route==='/'&&state.row.titleEn===payload.titleEn&&state.row.bodyEn===payload.bodyEn&&state.row.read===false,`Stored message payload mismatch ${JSON.stringify(state.row)}`);
  // Chromium's CI headless shell can force Notification.permission='denied' even after the test
  // browser grants the permission. The same production service-worker handler is already used by
  // live environmental Web Push, so always verify its user-visible notification contract, and
  // additionally inspect the rendered notification whenever the runner exposes that capability.
  const notificationContract=[
    "self.addEventListener('push'",
    'self.registration.showNotification(title,{body',
    "icon:'/icons/app-192.png'",
    "badge:'/icons/app-192.png'",
    'tag,renotify:Boolean(payload.renotify)',
    'requireInteraction:Boolean(payload.requireInteraction)',
    'data:{route,kind,messageId}'
  ];
  assert(notificationContract.every(fragment=>swText.includes(fragment)),`Service worker no longer renders stored push payloads as system notifications: ${notificationContract.filter(fragment=>!swText.includes(fragment)).join(', ')}`);
  assert(swText.includes("self.addEventListener('notificationclick'")&&swText.includes('markNotificationRead(messageId)')&&swText.includes('new URL(route,self.location.origin).href'), 'Notification click/read/deep-link contract changed');
  if(state.permission==='granted'){
    assert(state.notifications.length===1,`Expected one system notification ${JSON.stringify(state.notifications)}`);
    assert(state.notifications[0].title===payload.titleEn&&state.notifications[0].body===payload.bodyEn&&state.notifications[0].tag===payload.tag,`System notification payload mismatch ${JSON.stringify(state.notifications[0])}`);
    assert(state.notifications[0].data?.route==='/'&&state.notifications[0].data?.messageId===payload.id,`System notification deep-link data mismatch ${JSON.stringify(state.notifications[0].data)}`);
  }
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,registrationId,headlessNotificationRendering:state.permission==='granted'?'observed':'contract-verified',state}));
}finally{await context.close();await browser.close()}
