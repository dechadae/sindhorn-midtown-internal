import { formatDateTime } from './app-format.js';
const DB_NAME='sindhorn-midtown-notification-inbox';
const DB_VERSION=1;
const STORE='messages';
const MAX_MESSAGES=50;
let dbPromise=null;

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      const store=db.objectStoreNames.contains(STORE)?request.transaction.objectStore(STORE):db.createObjectStore(STORE,{keyPath:'id'});
      if(!store.indexNames.contains('receivedAt'))store.createIndex('receivedAt','receivedAt',{unique:false});
      if(!store.indexNames.contains('read'))store.createIndex('read','read',{unique:false});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Notification inbox unavailable'));
  });
  return dbPromise;
}

async function allMessages(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll();
    request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>Number(b.receivedAt||0)-Number(a.receivedAt||0)).slice(0,MAX_MESSAGES));
    request.onerror=()=>reject(request.error||new Error('Unable to read messages'));
  });
}

async function unreadCount(){
  const rows=await allMessages();
  return rows.reduce((count,row)=>count+(row.read?0:1),0);
}

async function markAllRead(){
  const db=await openDb(),rows=await allMessages();
  if(!rows.some(row=>!row.read))return;
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    rows.forEach(row=>{if(!row.read)store.put({...row,read:true})});
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||new Error('Unable to update messages'));
    tx.onabort=()=>reject(tx.error||new Error('Unable to update messages'));
  });
}

async function clearAll(){
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),request=tx.objectStore(STORE).clear();
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error||new Error('Unable to clear messages'));
  });
}

/* Hotel time in the voice, "5 Sep 2026 · 6 pm". */
function stamp(value){const time=Number(value);return formatDateTime(Number.isFinite(time)?new Date(time):new Date())}

function kindLabel(kind){
  const value=String(kind||'');
  if(value==='business-fnb-update')return'F&B update';
  if(value==='business-rooms-update')return'Rooms update';
  if(value==='business-dashboard-update')return'Business update';
  if(value==='broadcast')return'Broadcast';
  if(value==='severe-weather')return'Weather alert';
  if(value.startsWith('air-quality'))return'Air quality';
  if(value==='air-data-delay')return'Data notice';
  return'Environmental alert';
}

/* The count on the navbar: the unread alerts here plus the unread broadcasts
   the shell knows from the server (broadcast-inbox.js). */
async function updateBadge(extra=0){
  let count=0;try{count=await unreadCount()}catch(_){}
  count+=Math.max(0,Number(extra)||0);
  document.querySelectorAll('[data-message-badge]').forEach(node=>{
    node.hidden=count<1;
    node.textContent=count>99?'99+':String(count);
    node.setAttribute('aria-label',count?`${count} unread messages`:'No unread messages');
  });
}

/* The store, read by the shell's Messages page (messages-page.js), which
   paints it on list rows; the badge above is what the shell updates. This
   module renders nothing itself since r20. */
export{allMessages as listMessages,unreadCount,markAllRead,clearAll,updateBadge,kindLabel,stamp};
