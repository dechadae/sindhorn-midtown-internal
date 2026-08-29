const FOOTER_VERSION='sindhorn-footer-v8-shell-context';
const FNB_MODULE_URL='/fnb.js?v=6';
const NAV_ITEMS=[
  {route:'today',label:'Today',href:'/'},
  {route:'fnb',label:'F&B',direct:true},
  {route:'messages',label:'Messages',href:'/messages',badge:true},
  {route:'account',label:'Settings',href:'/account'}
];

let fnbCleanup=null;
let fnbOpening=null;
let contextObserver=null;
let contextSource=null;

function routeFromPath(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path==='/fnb')return'fnb';
  if(path==='/messages')return'messages';
  if(path==='/account')return'account';
  return'today';
}

function buildControl(item){
  const control=document.createElement(item.direct?'button':'a');
  control.className='nav-chip';
  control.setAttribute('aria-label',item.label);
  if(item.direct){
    control.type='button';
    if(item.section)control.dataset.fnbSectionNav=item.section;
    else control.dataset.fnbNav='fnb';
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

function sourceContextRail(){return document.querySelector('#route-view .fnb-route > .fnb-section-rail')}
function syncContextState(){
  const host=document.getElementById('app-footer'),rail=host?.querySelector('[data-shell-context="fnb"]'),source=contextSource||sourceContextRail();
  if(!rail||!source)return;
  rail.querySelectorAll('[data-fnb-section-nav]').forEach(control=>{
    const id=control.dataset.fnbSectionNav;
    const sourceControl=[...source.querySelectorAll('[data-section]')].find(button=>button.dataset.section===id);
    const active=Boolean(sourceControl&&(sourceControl.classList.contains('is-active')||sourceControl.hasAttribute('aria-current')));
    control.toggleAttribute('aria-current',active);
  });
}
function disconnectContextObserver(){contextObserver?.disconnect();contextObserver=null;contextSource=null}
function syncContextFooter(){
  const host=document.getElementById('app-footer');if(!host)return;
  const source=sourceContextRail();
  const shouldShow=document.body.dataset.route==='fnb'&&document.body.dataset.fnbDetail==='true'&&Boolean(source);
  let rail=host.querySelector('[data-shell-context="fnb"]');
  if(!shouldShow){rail?.remove();disconnectContextObserver();return}
  if(!rail){
    rail=document.createElement('nav');rail.className='fnb-section-rail shell-footer-rail';rail.dataset.shellContext='fnb';rail.setAttribute('aria-label',source.getAttribute('aria-label')||'Promotion sections');
    source.querySelectorAll('[data-section]').forEach(button=>rail.appendChild(buildControl({label:button.textContent.trim(),direct:true,section:button.dataset.section})));
    const global=host.querySelector('.app-tabbar');host.insertBefore(rail,global||null);
  }
  if(contextSource!==source){
    disconnectContextObserver();contextSource=source;
    contextObserver=new MutationObserver(syncContextState);contextObserver.observe(source,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  }
  syncContextState();
}

function normalizeFooter(){
  const host=document.getElementById('app-footer');if(!host)return;
  const current=host.querySelector(`[data-shell-footer="${FOOTER_VERSION}"]`);
  if(current){
    current.querySelectorAll('[data-app-route="fnb"]').forEach(node=>node.remove());
    updateCurrent();syncContextFooter();return;
  }
  const nav=document.createElement('nav');nav.className='app-tabbar bottom-nav shell-footer-rail';nav.dataset.shellFooter=FOOTER_VERSION;nav.setAttribute('aria-label','App navigation');
  NAV_ITEMS.forEach(item=>nav.appendChild(buildControl(item)));
  host.replaceChildren(nav);
  updateCurrent();syncContextFooter();
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
    const module=await import(`${FNB_MODULE_URL}&ui=2`);
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

    /* Route enhancements settle while hidden; shell context footer is created in the same phase. */
    host.style.opacity='0';
    document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:'fnb',source:'footer-prepaint'}}));
    await Promise.resolve();
    await Promise.resolve();
    updateCurrent();syncContextFooter();

    await fadeHost(host,0,1,180);
    host.style.removeProperty('opacity');
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
function handleSectionClick(event){
  const control=event.target.closest?.('#app-footer [data-fnb-section-nav]');if(!control)return;
  event.preventDefault();
  const id=control.dataset.fnbSectionNav,source=contextSource||sourceContextRail();
  const sourceControl=source?[...source.querySelectorAll('[data-section]')].find(button=>button.dataset.section===id):null;
  sourceControl?.click();
}

const footer=document.getElementById('app-footer');
if(footer){new MutationObserver(()=>normalizeFooter()).observe(footer,{childList:true})}
if(document.body){new MutationObserver(syncContextFooter).observe(document.body,{attributes:true,attributeFilter:['data-route','data-fnb-detail']})}
document.addEventListener('sindhorn:pack-updated',normalizeFooter);
document.addEventListener('sindhorn:route-mounted',event=>{
  const route=event.detail?.route||routeFromPath();
  if(route!=='fnb'&&typeof fnbCleanup==='function'){try{fnbCleanup()}catch(_){}fnbCleanup=null}
  normalizeFooter();updateCurrent();syncContextFooter();
});
document.addEventListener('click',handleFnbClick);
document.addEventListener('click',handleSectionClick);
addEventListener('popstate',()=>{
  if(routeFromPath()!=='fnb')return;
  setTimeout(()=>{if(!document.querySelector('#route-view .fnb-route'))openFnb({historyMode:null}).catch(()=>{})},0);
});
queueMicrotask(()=>{
  normalizeFooter();
  if(routeFromPath()==='fnb')openFnb({historyMode:null}).catch(()=>{});
});

window.SindhornFooterGuard={normalize:normalizeFooter,openFnb};
