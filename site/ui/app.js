import {initAuth,getState} from '../auth-client.js';
import {routeKeyForPath,routeDefinition,routePath} from './router.js';
import {initPullToReload} from './shell/pull-to-reload.js';

const LOGIN_PATH='/login.html';
const header=document.getElementById('app-header');
const outlet=document.getElementById('route-view');
const footer=document.getElementById('app-footer');
if(!header||!outlet||!footer)throw new Error('Clean shell hosts unavailable');

let cleanupRoute=null;
let activeRoute='today';
let profile=null;

function completeAuth(state){return Boolean(state?.authenticated&&state?.profile&&state.profile.pin_configured_at)}
function returnPath(){const value=`${location.pathname}${location.search}${location.hash}`;return value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith(LOGIN_PATH)?value:'/'}
function loginUrl(){return`${LOGIN_PATH}?next=${encodeURIComponent(returnPath())}`}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function initials(name,fallback='SM'){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return fallback;return(words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase()}
function displayName(value){return String(value?.display_name||value?.displayName||value?.employee_number||'Account').trim()||'Account'}

function renderHeader(){
  const name=displayName(profile);
  header.className='ui-shell-header';
  header.innerHTML=`<div class="ui-shell-header__inner"><a class="ui-shell-brand" href="/" data-ui-route="today" aria-label="Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG"><img src="/assets/brand/sindhorn-midtown-vignette-white.png" alt=""></a><a class="ui-shell-user" href="/settings" data-ui-route="settings" aria-label="Open settings for ${esc(name)}"><span class="ui-shell-user__name">${esc(name)}</span><span class="ui-shell-user__avatar" aria-hidden="true">${esc(initials(name))}</span></a></div>`;
}
function renderFooter(){
  footer.className='ui-shell-footer';
  footer.setAttribute('aria-label','App navigation');
  footer.innerHTML=`<a class="ui-shell-footer__item" href="/" data-ui-route="today">Today</a><a class="ui-shell-footer__item" href="/fnb" data-ui-route="fnb">F&amp;B</a><a class="ui-shell-footer__item" href="/messages" data-ui-route="messages">Messages<span class="message-badge ui-shell-footer__badge" data-message-badge hidden aria-label="No unread messages"></span></a><a class="ui-shell-footer__item" href="/brand" data-ui-route="brand">Brand</a>`;
}
function setFooterState(route){
  const global=route==='hotelFactsheet'||route==='ihgHistory'?'brand':route;
  footer.querySelectorAll('[data-ui-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.uiRoute===global));
}
function routeSkeleton(){return `<section class="ui-route-loading" aria-busy="true"><div class="ui-skeleton-stack"><div class="ui-skeleton ui-skeleton--line" style="width:24%"></div><div class="ui-skeleton ui-skeleton--title"></div><div class="ui-skeleton ui-skeleton--card"></div><div class="ui-skeleton ui-skeleton--card"></div></div></section>`}

async function mountRoute(route=routeKeyForPath(location.pathname),{animate=true}={}){
  route=routeDefinition(route)?route:'today';
  const definition=routeDefinition(route);
  if(typeof cleanupRoute==='function')await cleanupRoute();
  cleanupRoute=null;activeRoute=route;
  outlet.innerHTML=routeSkeleton();
  document.body.dataset.route=route;
  document.title=definition.title;
  setFooterState(route);
  const module=await import(definition.module),mount=module?.[definition.mount];
  if(typeof mount!=='function')throw new Error(`Clean route mount unavailable: ${route}`);
  cleanupRoute=await mount(outlet,{route,profile});
  if(animate){outlet.classList.remove('ui-route-enter');requestAnimationFrame(()=>outlet.classList.add('ui-route-enter'))}
  document.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route,architecture:'clean-ui'}}));
  return route;
}
async function navigate(route,{replace=false}={}){
  const path=routePath(route);
  if(replace)history.replaceState({route},'',path);else if(location.pathname!==path)history.pushState({route},'',path);
  return mountRoute(route);
}
function onDocumentClick(event){
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[data-ui-route]');if(!link)return;
  const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
  event.preventDefault();void navigate(link.dataset.uiRoute||routeKeyForPath(url.pathname));
}

async function loadClassic(src){await new Promise((resolve,reject)=>{const existing=document.querySelector(`script[data-clean-shell-src="${src}"]`);if(existing){resolve();return}const script=document.createElement('script');script.src=src;script.dataset.cleanShellSrc=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Unable to load ${src}`));document.head.appendChild(script)})}
async function startEnvironment(){
  try{await loadClassic('/location.js')}catch(error){console.warn('Location bootstrap unavailable',error)}
  try{const betta=await import('../betta-runtime.js?v=1');await betta.initEnvironment()}catch(error){console.error('Approved Betta failed to initialize',error)}
  try{const live=await import('../live-data.js');await live.initLiveData()}catch(error){console.warn('Air-quality live data unavailable',error)}
  try{await import('../rain-now.js?v=3')}catch(error){console.warn('Rain authority unavailable',error)}
}
async function startNotificationInbox(){try{const inbox=await import('../notification-inbox.js');await inbox.initNotificationInbox()}catch(error){console.warn('Notification inbox unavailable',error)}}

async function boot(){
  const state=await initAuth();
  if(!completeAuth(state)){location.replace(loginUrl());return}
  profile=state.profile;window.__SINDHORN_AUTH_PROFILE__=profile;
  renderHeader();renderFooter();
  document.addEventListener('click',onDocumentClick);
  addEventListener('popstate',()=>void mountRoute(routeKeyForPath(location.pathname),{animate:false}));
  document.addEventListener('sindhorn:auth-changed',event=>{const next=getState();if(!event.detail?.authenticated||!completeAuth(next)){location.replace(loginUrl());return}profile=event.detail.profile||next.profile;window.__SINDHORN_AUTH_PROFILE__=profile;renderHeader()});
  window.SindhornAppPack={getRoute:()=>activeRoute,mountRoute:(route,options)=>mountRoute(route,options)};
  initPullToReload();
  const routePromise=mountRoute(routeKeyForPath(location.pathname),{animate:false});
  const environmentPromise=startEnvironment();
  await routePromise;
  document.documentElement.dataset.cleanShellReady='true';
  void environmentPromise;
  void startNotificationInbox();
}

boot().catch(error=>{console.error('Clean shell startup failed',error);outlet.innerHTML='<section class="app-route-hero"><p class="app-route-eyebrow">Sindhorn Midtown</p><h1 class="app-route-title">Unable to start</h1><p class="app-route-copy">The clean preview shell could not initialize.</p></section>'});
