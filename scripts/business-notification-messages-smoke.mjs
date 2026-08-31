import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Notification Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(30000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));

try{
  await page.goto(`${BASE_URL}/messages`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  // The empty Messages list is intentionally hidden until it has content, so this contract waits
  // for the node to exist rather than treating initial visibility as a prerequisite.
  await page.waitForSelector('#messageList',{state:'attached'});
  await page.waitForFunction(()=>Boolean(window.SindhornNotificationInbox?.refresh));
  await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('sindhorn-midtown-notification-inbox',1);
      request.onupgradeneeded=()=>{const db=request.result,store=db.objectStoreNames.contains('messages')?request.transaction.objectStore('messages'):db.createObjectStore('messages',{keyPath:'id'});if(!store.indexNames.contains('receivedAt'))store.createIndex('receivedAt','receivedAt',{unique:false});if(!store.indexNames.contains('read'))store.createIndex('read','read',{unique:false})};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const now=Date.now(),rows=[
      {id:'business:fnb-preview',receivedAt:now-2000,read:false,route:'/',kind:'business-fnb-update',tag:'business-dashboard:fnb-preview',titleEn:'F&B REPORT UPDATED',bodyEn:'Synthetic F&B preview update.'},
      {id:'business:rooms-preview',receivedAt:now-1000,read:false,route:'/',kind:'business-rooms-update',tag:'business-dashboard:rooms-preview',titleEn:'ROOMS REPORT UPDATED',bodyEn:'Synthetic Rooms preview update.'},
      {id:'business:both-preview',receivedAt:now,read:false,route:'/',kind:'business-dashboard-update',tag:'business-dashboard:both-preview',titleEn:'TODAY BUSINESS REPORT UPDATED',bodyEn:'Synthetic combined preview update.'}
    ];
    await new Promise((resolve,reject)=>{const tx=db.transaction('messages','readwrite'),store=tx.objectStore('messages');rows.forEach(row=>store.put(row));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
    await window.SindhornNotificationInbox.refresh();
  });
  await page.waitForFunction(()=>document.querySelectorAll('#messageList .message-card').length===3);
  const state=await page.evaluate(()=>({
    route:document.body.dataset.route,
    kinds:[...document.querySelectorAll('#messageList .message-kind')].map(node=>node.textContent.trim()),
    titles:[...document.querySelectorAll('#messageList .message-title')].map(node=>node.textContent.trim()),
    links:[...document.querySelectorAll('#messageList .message-open')].map(node=>({href:node.getAttribute('href'),route:node.dataset.appRoute})),
    footer:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(node=>node.textContent.trim())
  }));
  assert(state.route==='messages',`Messages route mismatch ${JSON.stringify(state)}`);
  assert(state.kinds.join('|')==='Business update|Rooms update|F&B update',`Business labels mismatch ${JSON.stringify(state.kinds)}`);
  assert(state.titles.includes('F&B REPORT UPDATED')&&state.titles.includes('ROOMS REPORT UPDATED')&&state.titles.includes('TODAY BUSINESS REPORT UPDATED'),`Business titles missing ${JSON.stringify(state.titles)}`);
  assert(state.links.every(link=>link.href==='/'&&link.route==='today'),`Business message deep links must open Today ${JSON.stringify(state.links)}`);
  assert(state.footer.join('|')==='Today|F&B|Messages|Brand',`Footer changed ${JSON.stringify(state.footer)}`);
  await page.evaluate(()=>window.SindhornNotificationInbox.clearAll());
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,state}));
}finally{await context.close();await browser.close()}
