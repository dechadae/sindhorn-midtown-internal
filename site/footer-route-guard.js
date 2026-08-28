const FOOTER_VERSION='sindhorn-footer-v6-fnb-motion';
const FNB_MODULE_URL='/fnb.js?v=6';
const NAV_ITEMS=[
  {route:'today',label:'Today',href:'/'},
  {route:'fnb',label:'F&B',direct:true},
  {route:'messages',label:'Messages',href:'/messages',badge:true}
];

let fnbCleanup=null;
let fnbOpening=null;

function routeFromPath(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path==='/fnb')return'fnb';
  if(path==='/messages')return'messages';
  return'today';
}

function buildControl(item){
  const control=document.createElement(item.direct?'button':'a');
  control.className='nav-chip';
  control.setAttribute('aria-label',item.label);
  if(item.direct){
    control.type='button';
    control.dataset.fnbNav='fnb';
  }else{
    control.href=item.href;
    control.dataset.appRoute=item.route;
  }
  const label=document.createElement('span');label.textContent=item.label;control.appendChild(label);
  if(item.badge){const badge=document.createElement('i');badge.className='message-badge';badge.dataset.messageBadge='';badge.hidden=true;badge.setAttribute('aria-label','No unread messages');control.appendChild(badge)}
  return control;
}

function updateCurrent(){
  const route=routeFromPath();
  document.querySelectorAll('#app-footer [data-app-route],#app-footer [data-fnb-nav]').forEach(control=>{
    const controlRoute=control.dataset.appRoute||control.dataset.fnbNav;
    control.toggleAttribute('aria-current',controlRoute===route);
  });
}

function normalizeFooter(){
  const host=document.getElementById('app-footer');if(!host)return;
  const current=host.querySelector(`[data-shell-footer="${FOOTER_VERSION}"]`);
  if(current){
    current.querySelectorAll('[data-app-route="fnb"]').forEach(node=>node.remove());
    updateCurrent();return;
  }
  const nav=document.createElement('nav');nav.className='app-tabbar bottom-nav';nav.dataset.shellFooter=FOOTER_VERSION;nav.setAttribute('aria-label','App navigation');
  NAV_ITEMS.forEach(item=>nav.appendChild(buildControl(item)));
  host.replaceChildren(nav);
  updateCurrent();
  queueMicrotask(()=>window.SindhornNotificationInbox?.refresh?.().catch?.(()=>{}));
}

async function fadeHost(host,from,to,duration){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!host.animate)return;
  try{await host.animate([{opacity:from},{opacity:to}],{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished}catch(_){}
}

async function openFnb({historyMode='push'}={}){
  if(fnbOpening)return fnbOpening;
  fnbOpening=(async()=>{
    const host=document.getElementById('route-view');
    if(!host)throw new Error('F&B route host unavailable');
    const module=await import(FNB_MODULE_URL);
    if(typeof module.mountFnbRoute!=='function')throw new Error('F&B module unavailable');
    await fadeHost(host,1,0,120);
    if(typeof fnbCleanup==='function'){try{await fnbCleanup()}catch(_){}}
    fnbCleanup=null;
    host.replaceChildren();
    const cleanup=await module.mountFnbRoute(host,{profile:window.__SINDHORN_AUTH_PROFILE__});
    fnbCleanup=typeof cleanup==='function'?cleanup:null;
    if(historyMode&&location.pathname!=='/fnb')history[historyMode==='replace'?'replaceState':'pushState']({route:'fnb'},'', '/fnb');
    document.body.dataset.route='fnb';
    document.title='F&B | Sindhorn Midtown Internal';
    host.style.opacity='0';
    await fadeHost(host,0,1,180);
    host.style.removeProperty('opacity');
    updateCurrent();
    document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:'fnb',source:'footer-direct'}}));
    return true;
  })().catch(error=>{
    document.getElementById('route-view')?.style.removeProperty('opacity');
    console.error('Unable to open F&B route',error);
    throw error;
  }).finally(()=>{fnbOpening=null});
  return fnbOpening;
}

function handleFnbClick(event){
  const control=event.target.closest?.('#app-footer [data-fnb-nav="fnb"]');
  if(!control)return;
  event.preventDefault();
  openFnb().catch(()=>{});
}

const footer=document.getElementById('app-footer');
if(footer){new MutationObserver(()=>normalizeFooter()).observe(footer,{childList:true})}
document.addEventListener('sindhorn:pack-updated',normalizeFooter);
document.addEventListener('sindhorn:route-mounted',event=>{
  const route=event.detail?.route||routeFromPath();
  if(route!=='fnb'&&typeof fnbCleanup==='function'){try{fnbCleanup()}catch(_){}fnbCleanup=null}
  normalizeFooter();updateCurrent();
});
document.addEventListener('click',handleFnbClick);
addEventListener('popstate',()=>{
  if(routeFromPath()!=='fnb')return;
  setTimeout(()=>{if(!document.querySelector('#route-view .fnb-route'))openFnb({historyMode:null}).catch(()=>{})},0);
});
queueMicrotask(()=>{
  normalizeFooter();
  if(routeFromPath()==='fnb')openFnb({historyMode:null}).catch(()=>{});
});

window.SindhornFooterGuard={normalize:normalizeFooter,openFnb};
