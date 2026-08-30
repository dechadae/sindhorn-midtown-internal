const FOOTER_VERSION='sindhorn-footer-v13-brand-factsheet-single-footer';
const FNB_MODULE_URL='/fnb.js?v=7';
const NAV_ITEMS=[
  {route:'today',label:'Today',href:'/'},
  {route:'fnb',label:'F&B',direct:true},
  {route:'messages',label:'Messages',href:'/messages',badge:true},
  {route:'brand',label:'Brand',href:'/brand'}
];

let fnbCleanup=null;
let fnbOpening=null;
const contextState={
  fnb:{observer:null,source:null},
  settings:{observer:null,source:null},
  factsheet:{observer:null,source:null}
};

function routeFromPath(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path==='/fnb')return'fnb';
  if(path==='/messages')return'messages';
  if(path==='/brand'||path==='/ihg-history'||path==='/hotel-factsheet')return'brand';
  if(path==='/settings'||path==='/account'||path==='/account.html'||path==='/admin'||path==='/admin.html')return'settings';
  return'today';
}

function buildControl(item){
  const control=document.createElement(item.direct?'button':'a');
  control.className='nav-chip';
  control.setAttribute('aria-label',item.label);
  if(item.direct){control.type='button';control.dataset.fnbNav='fnb'}
  else{control.href=item.href;control.dataset.appRoute=item.route}
  const label=document.createElement('span');label.textContent=item.label;control.appendChild(label);
  if(item.badge){const badge=document.createElement('i');badge.className='message-badge';badge.dataset.messageBadge='';badge.hidden=true;badge.setAttribute('aria-label','No unread messages');control.appendChild(badge)}
  return control;
}

const CONTEXTS={
  fnb:{
    source:()=>document.querySelector('#route-view .fnb-route > .fnb-section-rail'),
    show:source=>document.body.dataset.route==='fnb'&&document.body.dataset.fnbDetail==='true'&&Boolean(source),
    shellSelector:'[data-shell-context="fnb"]',className:'fnb-section-rail shell-footer-rail',label:'Promotion sections',
    sourceButtons:source=>[...source.querySelectorAll('[data-section]')],section:button=>button.dataset.section,
    shellDataset:'fnbSectionNav',controlSelector:'[data-fnb-section-nav]'
  },
  settings:{
    source:()=>document.querySelector('#route-view .settings-route > .settings-section-rail'),
    show:source=>document.body.dataset.route==='settings'&&document.body.dataset.settingsContext==='true'&&Boolean(source),
    shellSelector:'[data-shell-context="settings"]',className:'settings-section-rail shell-footer-rail',label:'Settings sections',
    sourceButtons:source=>[...source.querySelectorAll('[data-section]')],section:button=>button.dataset.section,
    shellDataset:'settingsSectionNav',controlSelector:'[data-settings-section-nav]'
  },
  factsheet:{
    source:()=>document.querySelector('#route-view .factsheet-route > .factsheet-section-rail'),
    show:()=>false,
    shellSelector:'[data-shell-context="factsheet"]',className:'factsheet-section-rail shell-footer-rail',label:'Factsheet sections',
    sourceButtons:source=>[...source.querySelectorAll('[data-factsheet-section]')],section:button=>button.dataset.factsheetSection,
    shellDataset:'factsheetSectionNav',controlSelector:'[data-factsheet-section-nav]'
  }
};

function buildContextControl(config,label,section){
  const control=document.createElement('button');
  control.type='button';control.className='nav-chip';control.setAttribute('aria-label',label);
  control.dataset[config.shellDataset]=section;
  const span=document.createElement('span');span.textContent=label;control.appendChild(span);
  return control;
}

function updateCurrent(){
  const route=routeFromPath();
  document.querySelectorAll('#app-footer [data-app-route],#app-footer [data-fnb-nav]').forEach(control=>{
    const controlRoute=control.dataset.appRoute||control.dataset.fnbNav;
    control.toggleAttribute('aria-current',controlRoute===route);
  });
}

function disconnectContext(type){
  const state=contextState[type];state.observer?.disconnect();state.observer=null;state.source=null;
}
function syncContextState(type){
  const config=CONTEXTS[type],state=contextState[type],host=document.getElementById('app-footer'),
    rail=host?.querySelector(config.shellSelector),source=state.source||config.source();
  if(!rail||!source)return;
  rail.querySelectorAll(config.controlSelector).forEach(control=>{
    const id=control.dataset[config.shellDataset],sourceControl=config.sourceButtons(source).find(button=>config.section(button)===id);
    const active=Boolean(sourceControl&&(sourceControl.classList.contains('is-active')||sourceControl.getAttribute('aria-current')==='page'||sourceControl.hasAttribute('aria-current')&&sourceControl.getAttribute('aria-current')!=='false'));
    control.toggleAttribute('aria-current',active);
  });
}
function syncContextFooter(type){
  const config=CONTEXTS[type],state=contextState[type],host=document.getElementById('app-footer');
  if(!host)return;
  const source=config.source(),shouldShow=config.show(source);let rail=host.querySelector(config.shellSelector);
  if(!shouldShow){rail?.remove();disconnectContext(type);return}
  if(!rail){
    rail=document.createElement('nav');
    rail.className=config.className;rail.dataset.shellContext=type;rail.setAttribute('aria-label',source.getAttribute('aria-label')||config.label);
    config.sourceButtons(source).forEach(button=>rail.appendChild(buildContextControl(config,button.textContent.trim(),config.section(button))));
    const global=host.querySelector('.app-tabbar');host.insertBefore(rail,global||null);
  }
  if(state.source!==source){
    disconnectContext(type);state.source=source;state.observer=new MutationObserver(()=>syncContextState(type));
    state.observer.observe(source,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  }
  syncContextState(type);
}
function syncAllContexts(){Object.keys(CONTEXTS).forEach(syncContextFooter)}

function normalizeFooter(){
  const host=document.getElementById('app-footer');if(!host)return;
  const current=host.querySelector(`[data-shell-footer="${FOOTER_VERSION}"]`);
  if(current){current.querySelectorAll('[data-app-route="fnb"]').forEach(node=>node.remove());updateCurrent();syncAllContexts();return}
  const nav=document.createElement('nav');
  nav.className='app-tabbar bottom-nav shell-footer-rail';nav.dataset.shellFooter=FOOTER_VERSION;nav.setAttribute('aria-label','App navigation');
  NAV_ITEMS.forEach(item=>nav.appendChild(buildControl(item)));
  host.replaceChildren(nav);updateCurrent();syncAllContexts();queueMicrotask(()=>window.SindhornNotificationInbox?.refresh?.().catch?.(()=>{}));
}

async function fadeHost(host,from,to,duration){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!host.animate)return;
  try{await host.animate([{opacity:from},{opacity:to}],{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished}catch(_){}
}
async function openFnb({historyMode='push'}={}){
  if(fnbOpening)return fnbOpening;
  fnbOpening=(async()=>{
    const host=document.getElementById('route-view');if(!host)throw new Error('F&B route host unavailable');
    const module=await import(`${FNB_MODULE_URL}&ui=3`);if(typeof module.mountFnbRoute!=='function')throw new Error('F&B module unavailable');
    await fadeHost(host,1,0,120);
    if(typeof fnbCleanup==='function'){try{await fnbCleanup()}catch(_){} }
    fnbCleanup=null;host.replaceChildren();
    const cleanup=await module.mountFnbRoute(host,{profile:window.__SINDHORN_AUTH_PROFILE__});
    fnbCleanup=typeof cleanup==='function'?cleanup:null;
    if(historyMode&&location.pathname!=='/fnb')history[historyMode==='replace'?'replaceState':'pushState']({route:'fnb'},'', '/fnb');
    document.body.dataset.route='fnb';document.title='F&B | Sindhorn Midtown Internal';host.style.opacity='0';
    document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:'fnb',source:'footer-prepaint'}}));
    await Promise.resolve();await Promise.resolve();updateCurrent();syncAllContexts();
    await fadeHost(host,0,1,180);host.style.removeProperty('opacity');return true;
  })().catch(error=>{
    document.getElementById('route-view')?.style.removeProperty('opacity');
    console.error('Unable to open F&B route',error);throw error;
  }).finally(()=>{fnbOpening=null});
  return fnbOpening;
}
function handleFnbClick(event){
  const control=event.target.closest?.('#app-footer [data-fnb-nav="fnb"]');
  if(!control)return;event.preventDefault();openFnb().catch(()=>{});
}
function handleContextClick(event){
  for(const [type,config] of Object.entries(CONTEXTS)){
    const control=event.target.closest?.(`#app-footer ${config.controlSelector}`);
    if(!control)continue;
    event.preventDefault();
    const source=contextState[type].source||config.source(),id=control.dataset[config.shellDataset];
    config.sourceButtons(source||document).find(button=>config.section(button)===id)?.click();
    return;
  }
}

const footer=document.getElementById('app-footer');
if(footer)new MutationObserver(mutations=>{
  if(mutations.some(mutation=>mutation.type==='childList'))normalizeFooter();
  else updateCurrent();
}).observe(footer,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current']});
if(document.body)new MutationObserver(syncAllContexts).observe(document.body,{attributes:true,attributeFilter:['data-route','data-fnb-detail','data-settings-context']});
document.addEventListener('sindhorn:pack-updated',normalizeFooter);
document.addEventListener('sindhorn:route-mounted',event=>{
  const route=event.detail?.route||routeFromPath();
  if(route!=='fnb'&&typeof fnbCleanup==='function'){try{fnbCleanup()}catch(_){}fnbCleanup=null}
  normalizeFooter();updateCurrent();syncAllContexts();
});
document.addEventListener('sindhorn:settings-section-changed',()=>syncContextState('settings'));
document.addEventListener('click',handleFnbClick);
document.addEventListener('click',handleContextClick);
addEventListener('popstate',()=>{
  if(routeFromPath()!=='fnb')return;
  setTimeout(()=>{if(!document.querySelector('#route-view .fnb-route'))openFnb({historyMode:null}).catch(()=>{})},0);
});
queueMicrotask(()=>{normalizeFooter();if(routeFromPath()==='fnb')openFnb({historyMode:null}).catch(()=>{})});
window.SindhornFooterGuard={normalize:normalizeFooter,openFnb};
