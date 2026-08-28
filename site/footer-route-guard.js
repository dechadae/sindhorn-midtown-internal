const FOOTER_VERSION='sindhorn-footer-v2';
const NAV_ITEMS=[
  {route:'today',label:'Today',href:'/'},
  {route:'fnb',label:'F&B',href:'/fnb',button:true},
  {route:'messages',label:'Messages',href:'/messages',badge:true}
];

function routeFromPath(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path==='/fnb')return'fnb';
  if(path==='/messages')return'messages';
  return'today';
}

function buildControl(item){
  const control=document.createElement(item.button?'button':'a');
  control.className='nav-chip';
  control.dataset.appRoute=item.route;
  control.setAttribute('aria-label',item.label);
  if(item.button){control.type='button';control.dataset.routeHref=item.href}else control.href=item.href;
  const label=document.createElement('span');label.textContent=item.label;control.appendChild(label);
  if(item.badge){const badge=document.createElement('i');badge.className='message-badge';badge.dataset.messageBadge='';badge.hidden=true;badge.setAttribute('aria-label','No unread messages');control.appendChild(badge)}
  return control;
}

function updateCurrent(){
  const route=window.SindhornAppPack?.getRoute?.()||routeFromPath();
  document.querySelectorAll('#app-footer [data-app-route]').forEach(control=>control.toggleAttribute('aria-current',control.dataset.appRoute===route));
}

function normalizeFooter(){
  const host=document.getElementById('app-footer');if(!host)return;
  const current=host.querySelector(`[data-shell-footer="${FOOTER_VERSION}"]`);
  if(current){updateCurrent();return}
  const nav=document.createElement('nav');nav.className='app-tabbar bottom-nav';nav.dataset.shellFooter=FOOTER_VERSION;nav.setAttribute('aria-label','App navigation');
  NAV_ITEMS.forEach(item=>nav.appendChild(buildControl(item)));
  host.replaceChildren(nav);
  updateCurrent();
  queueMicrotask(()=>window.SindhornNotificationInbox?.refresh?.().catch?.(()=>{}));
}

function fnbFallback(event){
  const control=event.target.closest?.('#app-footer [data-app-route="fnb"]');
  if(!control||event.defaultPrevented)return;
  const navigation=window.SindhornNavigation;
  if(navigation?.routeForPath?.('/fnb')==='fnb'&&typeof navigation.transitionToRoute==='function'){
    event.preventDefault();navigation.transitionToRoute('fnb').catch(()=>location.assign('/fnb'));return;
  }
  event.preventDefault();location.assign('/fnb');
}

const footer=document.getElementById('app-footer');
if(footer){new MutationObserver(()=>normalizeFooter()).observe(footer,{childList:true})}
document.addEventListener('sindhorn:pack-updated',normalizeFooter);
document.addEventListener('sindhorn:route-mounted',()=>{normalizeFooter();updateCurrent()});
document.addEventListener('click',fnbFallback);
queueMicrotask(normalizeFooter);

window.SindhornFooterGuard={normalize:normalizeFooter};
