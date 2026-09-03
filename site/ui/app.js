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

function renderHeader(){
  header.innerHTML=`<div class="masthead" role="banner"><div class="masthead-inner"><div class="brand-lockup"><span class="screen-reader" role="img" aria-label="Sindhorn Midtown Hotel Bangkok, Vignette Collection"></span><img class="logo-light" src="/assets/brand/sindhorn-midtown-vignette-black.png" width="1200" height="600" alt="" aria-hidden="true"><img class="logo-dark" src="/assets/brand/sindhorn-midtown-vignette-white.png" width="1200" height="600" alt="" aria-hidden="true"></div><div class="masthead-tools"><div class="today" aria-label="Today"><span class="en">Today</span></div><button class="fullscreen-toggle" type="button" id="fullscreenToggle" aria-pressed="false" aria-label="Enter full screen" title="Full screen"><svg class="enter-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8.5 3.5h-5v5M15.5 3.5h5v5M8.5 20.5h-5v-5M20.5 15.5v5h-5"/></svg><svg class="exit-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8.5 8.5h-5v-5M15.5 8.5h5v-5M8.5 15.5h-5v5M20.5 20.5v-5h-5"/></svg></button></div></div></div>`;
}
function renderFooter(){
  footer.innerHTML=`<nav class="app-tabbar bottom-nav shell-footer-rail" aria-label="App navigation"><a class="nav-chip" href="/" data-ui-route="today" data-app-route="today" aria-label="Today"><span>Today</span></a><a class="nav-chip" href="/fnb" data-ui-route="fnb" data-app-route="fnb" aria-label="F&B"><span>F&amp;B</span></a><a class="nav-chip" href="/messages" data-ui-route="messages" data-app-route="messages" aria-label="Messages"><span>Messages</span><i class="message-badge" data-message-badge hidden aria-label="No unread messages"></i></a><a class="nav-chip" href="/brand" data-ui-route="brand" data-app-route="brand" aria-label="Brand"><span>Brand</span></a></nav>`;
}
function setFooterState(route){const global=route==='hotelFactsheet'||route==='ihgHistory'?'brand':route;footer.querySelectorAll('[data-ui-route]').forEach(link=>link.toggleAttribute('aria-current',link.dataset.uiRoute===global))}
function routeSkeleton(){return '<section class="ui-route-loading" aria-busy="true"><div class="ui-skeleton-stack"><div class="ui-skeleton ui-skeleton--line ui-skeleton--eyebrow"></div><div class="ui-skeleton ui-skeleton--title"></div><div class="ui-skeleton ui-skeleton--card"></div><div class="ui-skeleton ui-skeleton--card"></div></div></section>'}
function updateFullscreenState(){const active=Boolean(document.fullscreenElement);document.body.classList.toggle('is-fullscreen',active);const button=document.getElementById('fullscreenToggle');button?.setAttribute('aria-pressed',active?'true':'false');button?.setAttribute('aria-label',active?'Exit full screen':'Enter full screen')}
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.({navigationUI:'hide'})}catch(_){}}

async function mountRoute(route=routeKeyForPath(location.pathname),{animate=true}={}){
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
async function navigate(route,{replace=false}={}){const path=routePath(route);if(replace)history.replaceState({route},'',path);else if(location.pathname!==path)history.pushState({route},'',path);return mountRoute(route)}
function onDocumentClick(event){
  if(event.target.closest('#fullscreenToggle')){event.preventDefault();void toggleFullscreen();return}
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[data-ui-route]');if(!link)return;const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
  event.preventDefault();void navigate(link.dataset.uiRoute||routeKeyForPath(url.pathname));
}
async function loadClassic(src){await new Promise((resolve,reject)=>{const existing=document.querySelector(`script[data-clean-shell-src="${src}"]`);if(existing){resolve();return}const script=document.createElement('script');script.src=src;script.dataset.cleanShellSrc=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Unable to load ${src}`));document.head.appendChild(script)})}
async function startEnvironment(){try{await loadClassic('/location.js')}catch(error){console.warn('Location bootstrap unavailable',error)}try{const betta=await import('../betta-runtime.js?v=1');await betta.initEnvironment()}catch(error){console.error('Approved Betta failed to initialize',error)}try{const live=await import('../live-data.js');await live.initLiveData()}catch(error){console.warn('Air-quality live data unavailable',error)}try{await import('../rain-now.js?v=3')}catch(error){console.warn('Rain authority unavailable',error)}}
async function startNotificationInbox(){try{const inbox=await import('../notification-inbox.js');await inbox.initNotificationInbox()}catch(error){console.warn('Notification inbox unavailable',error)}}

async function boot(){
  const state=await initAuth();if(!completeAuth(state)){location.replace(loginUrl());return}
  profile=state.profile;window.__SINDHORN_AUTH_PROFILE__=profile;renderHeader();renderFooter();updateFullscreenState();
  document.addEventListener('click',onDocumentClick);document.addEventListener('fullscreenchange',updateFullscreenState);addEventListener('popstate',()=>void mountRoute(routeKeyForPath(location.pathname),{animate:false}));
  document.addEventListener('sindhorn:auth-changed',event=>{const next=getState();if(!event.detail?.authenticated||!completeAuth(next)){location.replace(loginUrl());return}profile=event.detail.profile||next.profile;window.__SINDHORN_AUTH_PROFILE__=profile});
  window.SindhornAppPack={getRoute:()=>activeRoute,mountRoute:(route,options)=>mountRoute(route,options)};
  initPullToReload();
  const routePromise=mountRoute(routeKeyForPath(location.pathname),{animate:false}),environmentPromise=startEnvironment();
  await routePromise;document.documentElement.dataset.cleanShellReady='true';void environmentPromise;void startNotificationInbox();
}

boot().catch(error=>{console.error('Clean shell startup failed',error);outlet.innerHTML='<section class="app-route-hero"><p class="app-route-eyebrow">Sindhorn Midtown</p><h1 class="app-route-title">Unable to start</h1><p class="app-route-copy">The clean preview shell could not initialize.</p></section>'});
