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
  await refreshUi();
}

function routeName(route){
  if(String(route||'').startsWith('/guidance'))return'guidance';
  if(String(route||'').startsWith('/details'))return'details';
  if(String(route||'').startsWith('/messages'))return'messages';
  return'today';
}

function stamp(value,locale){
  const time=Number(value),date=Number.isFinite(time)?new Date(time):new Date();
  try{return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date)}catch(_){return date.toLocaleString(locale)}
}

function messageCard(row){
  const article=document.createElement('article');article.className='message-card';article.dataset.read=row.read?'true':'false';
  const meta=document.createElement('div');meta.className='message-meta';
  const kind=document.createElement('span');kind.className='message-kind';kind.textContent=row.kind==='severe-weather'?'Weather alert':row.kind?.startsWith('air-quality')?'Air quality':row.kind==='air-data-delay'?'Data notice':'Environmental alert';
  const time=document.createElement('time');time.dateTime=new Date(Number(row.receivedAt)||Date.now()).toISOString();time.textContent=stamp(row.receivedAt,'en-GB');
  meta.append(kind,time);
  const title=document.createElement('h2');title.className='message-title';title.textContent=String(row.titleEn||'SINDHORN MIDTOWN UPDATE');
  const body=document.createElement('p');body.className='message-body';body.textContent=String(row.bodyEn||'New information is available in the app.');
  const link=document.createElement('a');link.className='message-open';link.href=String(row.route||'/');link.dataset.appRoute=routeName(row.route);link.textContent='Open';link.setAttribute('aria-label','Open related information');
  article.append(meta,title,body,link);
  return article;
}

async function renderMessages(){
  const list=document.getElementById('messageList'),empty=document.getElementById('messageEmpty'),clear=document.getElementById('messageClearBtn');
  if(!list)return;
  let rows=[];try{rows=await allMessages()}catch(_){}
  list.replaceChildren(...rows.map(messageCard));
  if(empty)empty.hidden=rows.length>0;
  if(clear)clear.hidden=rows.length===0;
  if(document.body.dataset.route==='messages'&&rows.some(row=>!row.read)){
    try{await markAllRead()}catch(_){}
  }
}

async function updateBadge(){
  let count=0;try{count=await unreadCount()}catch(_){}
  document.querySelectorAll('[data-message-badge]').forEach(node=>{
    node.hidden=count<1;
    node.textContent=count>99?'99+':String(count);
    node.setAttribute('aria-label',count?`${count} unread messages`:'No unread messages');
  });
}

async function refreshUi(){await Promise.allSettled([renderMessages(),updateBadge()])}

export async function initNotificationInbox(){
  await updateBadge();
  document.addEventListener('sindhorn:route-mounted',event=>{
    if(event.detail?.route==='messages')renderMessages().then(updateBadge).catch(()=>{});else updateBadge().catch(()=>{});
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('#messageClearBtn'))clearAll().catch(()=>{});
  });
  navigator.serviceWorker?.addEventListener?.('message',event=>{
    if(event.data?.type==='SINDHORN_NOTIFICATION_STORED')refreshUi().catch(()=>{});
  });
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshUi().catch(()=>{})});
  if(document.body.dataset.route==='messages')await renderMessages();
}

window.SindhornNotificationInbox={list:allMessages,unreadCount,markAllRead,clearAll,refresh:refreshUi};
