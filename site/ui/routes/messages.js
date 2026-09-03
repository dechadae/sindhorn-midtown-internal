import {listMessages,markAllRead,clearMessages,unreadCount} from '../data/messages.js';

let stylePromise=null;
function ensureStyle(){
  if(stylePromise)return stylePromise;
  stylePromise=new Promise(resolve=>{const existing=document.querySelector('link[data-ui-messages-style]');if(existing){if(existing.sheet)resolve();else{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})}return}const link=document.createElement('link');link.rel='stylesheet';link.href='/ui/routes/messages.css';link.dataset.uiMessagesStyle='true';link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});document.head.appendChild(link)});
  return stylePromise;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function stamp(value){const date=new Date(Number(value)||Date.now());try{return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date)}catch(_){return date.toLocaleString('en-GB')}}
function kindLabel(kind){const value=String(kind||'');if(value==='business-fnb-update')return'F&B update';if(value==='business-rooms-update')return'Rooms update';if(value==='business-dashboard-update')return'Business update';if(value==='severe-weather')return'Weather alert';if(value.startsWith('air-quality'))return'Air quality';if(value==='air-data-delay')return'Data notice';return'Environmental alert'}
function routeKey(path){const value=String(path||'/');if(value.startsWith('/fnb'))return'fnb';if(value.startsWith('/messages'))return'messages';if(value.startsWith('/brand'))return'brand';if(value.startsWith('/hotel-factsheet'))return'hotelFactsheet';if(value.startsWith('/ihg-history'))return'ihgHistory';if(value.startsWith('/settings'))return'settings';return'today'}
function card(row){return`<article class="ui-card ui-message" data-read="${row.read?'true':'false'}"><div class="ui-message__meta"><span class="ui-message__kind">${esc(kindLabel(row.kind))}</span><time datetime="${esc(new Date(Number(row.receivedAt)||Date.now()).toISOString())}">${esc(stamp(row.receivedAt))}</time></div><h3>${esc(row.titleEn||'SINDHORN MIDTOWN UPDATE')}</h3><p>${esc(row.bodyEn||'New information is available in the app.')}</p><div class="ui-message__actions"><a class="ui-utility-action" href="${esc(row.route||'/')}" data-ui-route="${routeKey(row.route)}">Open</a></div></article>`}
function updateBadge(count){document.querySelectorAll('[data-message-badge]').forEach(node=>{node.hidden=count<1;node.textContent=count>99?'99+':String(count);node.setAttribute('aria-label',count?`${count} unread messages`:'No unread messages')})}

export async function mountMessagesRoute(host){
  await ensureStyle();
  const route=document.createElement('section');route.className='ui-messages';host.replaceChildren(route);
  async function render({markRead=true}={}){
    let rows=[];try{rows=await listMessages()}catch(_){}
    route.innerHTML=`<header class="ui-route-hero"><p class="ui-eyebrow">Environmental alerts</p><h1 class="ui-title">Messages</h1><p class="ui-copy">Notifications received on this device are kept here for quick reference.</p></header><section class="ui-messages__section"><div class="ui-messages__heading"><h2>Recent messages</h2>${rows.length?'<button class="ui-utility-action" type="button" data-ui-clear-messages>Clear all</button>':''}</div>${rows.length?`<div class="ui-messages__list" aria-live="polite">${rows.map(card).join('')}</div>`:'<article class="ui-card ui-messages__empty"><strong>No messages yet.</strong><p>Environmental alerts received on this device will appear here.</p></article>'}</section>`;
    if(markRead&&rows.some(row=>!row.read)){try{await markAllRead()}catch(_){};updateBadge(0)}else{try{updateBadge(await unreadCount())}catch(_){}}
  }
  const onClick=event=>{if(event.target.closest('[data-ui-clear-messages]'))void clearMessages().then(()=>render({markRead:false}))};
  const onStored=event=>{if(event.data?.type==='SINDHORN_NOTIFICATION_STORED')void render()};
  const onReload=event=>{if(event.detail?.route==='messages')void render()};
  route.addEventListener('click',onClick);navigator.serviceWorker?.addEventListener?.('message',onStored);document.addEventListener('sindhorn:pull-reload',onReload);
  await render();
  return()=>{route.removeEventListener('click',onClick);navigator.serviceWorker?.removeEventListener?.('message',onStored);document.removeEventListener('sindhorn:pull-reload',onReload);route.remove()};
}
