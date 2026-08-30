import {mountSettingsRoute as mountBaseSettingsRoute} from './settings.js?v=3&r=modal-shell-2';
import {mountSettingsBusinessCard,preloadSettingsBusinessCard} from './business-card-settings.js?v=10&r=modal-shell-2';
// Cache lineage: business-card-settings.js?v=9 -> v10 for the fixed-shell renderer.
// Cache lineage: /settings-dialog-standard.css?v=1&r=4 -> r=5 for the centralized modal shell.
function ensureStyle(selector,href,attribute){const existing=document.querySelector(selector);if(existing)return existing.sheet?Promise.resolve():new Promise(resolve=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})});return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(attribute,'true');link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});document.head.appendChild(link)})}
function promoteSignOutToHero(root){
  const hero=root.querySelector('.settings-hero');if(!hero)return;
  const buttons=[...root.querySelectorAll('[data-sign-out]')];if(!buttons.length)return;
  const fresh=buttons.find(button=>!hero.contains(button))||buttons.find(button=>hero.contains(button));if(!fresh)return;
  buttons.forEach(button=>{if(button!==fresh)button.remove()});
  const oldHost=fresh.closest('.settings-account-actions');
  fresh.className='fnb-action-control fnb-share-button settings-hero-signout';
  fresh.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h9"/></svg><span>Sign out</span>';
  hero.appendChild(fresh);
  if(oldHost&&!oldHost.children.length)oldHost.remove();
}
function installHeroSignOut(root){
  const sync=event=>{if(!event?.detail?.section||event.detail.section==='account')promoteSignOutToHero(root)};
  document.addEventListener('sindhorn:settings-section-changed',sync);
  promoteSignOutToHero(root);
  return()=>document.removeEventListener('sindhorn:settings-section-changed',sync);
}
function documentOffsetTop(node){let top=0,current=node;while(current){top+=Number(current.offsetTop||0);current=current.offsetParent}return top}
function installSettingsViewport(root){
  const doc=document.documentElement,footer=document.getElementById('app-footer'),viewport=window.visualViewport,previousScrollPadding=doc.style.scrollPaddingBottom;
  let frame=0,mutationObserver=null,resizeObserver=null;
  const update=()=>{
    frame=0;
    const viewportHeight=Math.max(1,Math.round(Number(viewport?.height||window.innerHeight||doc.clientHeight||0)));
    const routeTop=Math.max(0,Math.round(documentOffsetTop(root)));
    const rails=[...(footer?.querySelectorAll('.shell-footer-rail')||[])].map(node=>({node,rect:node.getBoundingClientRect(),style:getComputedStyle(node)})).filter(item=>item.rect.height>0&&item.style.display!=='none'&&item.style.visibility!=='hidden'&&Number(item.style.opacity||1)!==0);
    const stackHeight=rails.length?Math.max(...rails.map(item=>item.rect.bottom))-Math.min(...rails.map(item=>item.rect.top)):0;
    const clearance=Math.max(0,Math.ceil(stackHeight>0?stackHeight+28:96));
    root.style.setProperty('--settings-viewport-height',`${viewportHeight}px`);
    root.style.setProperty('--settings-route-top',`${routeTop}px`);
    root.style.setProperty('--settings-scroll-clearance',`${clearance}px`);
    root.style.scrollPaddingBottom=`${clearance}px`;
    doc.style.scrollPaddingBottom=`${clearance}px`;
  };
  const schedule=()=>{if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(update)};
  viewport?.addEventListener('resize',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  document.addEventListener('sindhorn:settings-section-changed',schedule);
  if(footer){mutationObserver=new MutationObserver(schedule);mutationObserver.observe(footer,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(footer)}}
  update();requestAnimationFrame(update);
  return()=>{
    if(frame)cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize',schedule);
    window.removeEventListener('resize',schedule);
    window.removeEventListener('orientationchange',schedule);
    document.removeEventListener('sindhorn:settings-section-changed',schedule);
    mutationObserver?.disconnect();resizeObserver?.disconnect();
    root.style.removeProperty('--settings-viewport-height');root.style.removeProperty('--settings-route-top');root.style.removeProperty('--settings-scroll-clearance');root.style.removeProperty('scroll-padding-bottom');
    doc.style.scrollPaddingBottom=previousScrollPadding;
  };
}
export async function mountSettingsRoute(root){
  const previousVisibility=root.style.visibility;
  root.style.visibility='hidden';
  const cardPreload=preloadSettingsBusinessCard();
  let baseCleanup=null,signOutCleanup=null,cardCleanup=null,viewportCleanup=null;
  try{
    await Promise.all([
      ensureStyle('link[data-settings-style]','/settings.css?v=2','data-settings-style'),
      ensureStyle('link[data-settings-refinements]','/settings-refinements.css?v=2','data-settings-refinements'),
      ensureStyle('link[data-settings-dialog-standard]','/settings-dialog-standard.css?v=1&r=5','data-settings-dialog-standard'),
      ensureStyle('link[data-business-card-component]','/business-card-component.css?v=1&r=3','data-business-card-component'),
      ensureStyle('link[data-business-card-settings-style]','/business-card-settings.css?v=10','data-business-card-settings-style')
    ]);
    baseCleanup=await mountBaseSettingsRoute(root);
    signOutCleanup=installHeroSignOut(root);
    cardCleanup=await mountSettingsBusinessCard(root,{preload:cardPreload});
    viewportCleanup=installSettingsViewport(root);
  }finally{
    root.style.visibility=previousVisibility;
  }
  return()=>{try{viewportCleanup?.()}finally{try{cardCleanup?.()}finally{try{signOutCleanup?.()}finally{baseCleanup?.()}}}};
}