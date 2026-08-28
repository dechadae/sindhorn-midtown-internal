const FOOTER_VERSION='sindhorn-footer-v3-anchor';
const NAV_ITEMS=[
  {route:'today',label:'Today',href:'/'},
  {route:'fnb',label:'F&B',href:'/fnb'},
  {route:'messages',label:'Messages',href:'/messages',badge:true}
];

function routeFromPath(){
  const path=location.pathname.length>1&&location.pathname.endsWith('/')?location.pathname.slice(0,-1):location.pathname;
  if(path==='/fnb')return'fnb';
  if(path==='/messages')return'messages';
  return'today';
}

function buildControl(item){
  const control=document.createElement('a');
  control.className='nav-chip';
  control.href=item.href;
  control.dataset.appRoute=item.route;
  control.setAttribute('aria-label',item.label);
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

const footer=document.getElementById('app-footer');
if(footer){new MutationObserver(()=>normalizeFooter()).observe(footer,{childList:true})}
document.addEventListener('sindhorn:pack-updated',normalizeFooter);
document.addEventListener('sindhorn:route-mounted',()=>{normalizeFooter();updateCurrent()});
queueMicrotask(normalizeFooter);

window.SindhornFooterGuard={normalize:normalizeFooter};
