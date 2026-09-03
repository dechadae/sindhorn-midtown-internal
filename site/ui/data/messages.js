const DB_NAME='sindhorn-midtown-notification-inbox';
const DB_VERSION=1;
const STORE='messages';
const LIMIT=50;
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
export async function listMessages(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll();request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>Number(b.receivedAt||0)-Number(a.receivedAt||0)).slice(0,LIMIT));request.onerror=()=>reject(request.error||new Error('Unable to read messages'))});
}
export async function unreadCount(){return(await listMessages()).reduce((count,row)=>count+(row.read?0:1),0)}
export async function markAllRead(){
  const db=await openDb(),rows=await listMessages();if(!rows.some(row=>!row.read))return;
  await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);rows.forEach(row=>{if(!row.read)store.put({...row,read:true})});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Unable to update messages'));tx.onabort=()=>reject(tx.error||new Error('Unable to update messages'))});
}
export async function clearMessages(){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),request=tx.objectStore(STORE).clear();request.onsuccess=resolve;request.onerror=()=>reject(request.error||new Error('Unable to clear messages'))})}
