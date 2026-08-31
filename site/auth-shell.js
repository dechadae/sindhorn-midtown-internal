import {getState,initAuth} from './auth-client.js';

const LOGIN_PATH='/login.html';
const SETTINGS_PATH='/settings';
const mark=name=>performance.mark?.(name);
mark('sindhorn-auth-shell-start');

function safeReturnPath(){
  const value=`${location.pathname}${location.search}${location.hash}`;
  if(!value.startsWith('/')||value.startsWith('//')||value.startsWith(LOGIN_PATH))return'/';
  return value;
}
function loginUrl(){return`${LOGIN_PATH}?next=${encodeURIComponent(safeReturnPath())}`}
function hasCompleteEmployeeAuth(state){return Boolean(state?.authenticated&&state?.profile&&state.profile.pin_configured_at)}
function initials(name,fallback='SM'){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return fallback;return(words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase()}
function employeeNumber(profile){return String(profile?.employee_number||profile?.employeeNumber||'').trim()}
function compactName(profile){const value=String(profile?.display_name||profile?.displayName||employeeNumber(profile)||'Account').trim();return value||'Account'}
function applyEmployeeHeader(profileInput=null){
  const profile=(profileInput&&typeof profileInput==='object'&&!('type'in profileInput)?profileInput:null)||getState().profile||window.__SINDHORN_AUTH_PROFILE__;if(!profile)return;
  const tools=document.querySelector('.masthead-tools');if(!tools)return;
  const existing=tools.querySelector('.masthead-user'),today=tools.querySelector('.today');if(today)today.remove();
  const link=existing||document.createElement('a');link.className='masthead-user';link.href=SETTINGS_PATH;link.dataset.appRoute='settings';link.setAttribute('aria-label',`Open settings for ${compactName(profile)}`);link.replaceChildren();
  const name=document.createElement('span');name.className='masthead-user-name';name.textContent=compactName(profile);
  const avatar=document.createElement('span');avatar.className='masthead-user-avatar';avatar.textContent=initials(compactName(profile),initials(employeeNumber(profile),'SM'));avatar.setAttribute('aria-hidden','true');
  link.append(name,avatar);if(!existing)tools.prepend(link);
}
async function loadClassicScript(src){await new Promise((resolve,reject)=>{if(document.querySelector(`script[data-auth-shell-src="${src}"]`)){resolve();return}const script=document.createElement('script');script.src=src;script.dataset.authShellSrc=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Unable to load ${src}`));document.head.appendChild(script)})}

/* Download + evaluate the approved Betta bundle underneath auth, but do not
   initialize it yet. The weather transport adapter in location.js must exist
   first so Betta's legacy weather request cannot escape directly to Open-Meteo.
   bootstrap.js imports the same URL later and reuses this evaluated module. */
mark('sindhorn-betta-warm-start');
const bettaModulePromise=import('./betta-runtime.js?v=1').then(module=>{mark('sindhorn-betta-module-ready');return module}).catch(error=>{console.warn('Early Betta module warm-up unavailable; bootstrap will retry.',error);return null});

mark('sindhorn-auth-start');
let state;try{state=await initAuth()}catch(_){state=getState()}
mark('sindhorn-auth-ready');
if(!hasCompleteEmployeeAuth(state)){location.replace(loginUrl())}else{
  window.__SINDHORN_AUTH_PROFILE__=state.profile;
  document.addEventListener('sindhorn:pack-updated',()=>applyEmployeeHeader());
  document.addEventListener('sindhorn:capabilities-updated',event=>applyEmployeeHeader(event.detail?.profile));
  document.addEventListener('sindhorn:auth-changed',event=>{const nextState=getState();if(!event.detail?.authenticated||!hasCompleteEmployeeAuth(nextState)){location.replace(loginUrl());return}window.__SINDHORN_AUTH_PROFILE__=event.detail.profile||nextState.profile;applyEmployeeHeader(window.__SINDHORN_AUTH_PROFILE__)});
  mark('sindhorn-location-load-start');
  await loadClassicScript('/location.js');
  mark('sindhorn-location-load-ready');
  mark('sindhorn-betta-init-start');
  const bettaModule=await bettaModulePromise;
  if(bettaModule?.initEnvironment){try{bettaModule.initEnvironment();mark('sindhorn-betta-warm-ready')}catch(error){console.warn('Early Betta initialization unavailable; bootstrap will retry.',error)}}
  mark('sindhorn-bootstrap-import-start');
  await import('./bootstrap.js');
  mark('sindhorn-bootstrap-import-ready');
  mark('sindhorn-onboarding-import-start');
  await import('./onboarding.js?v=1');
  mark('sindhorn-onboarding-import-ready');
  applyEmployeeHeader();
}
void bettaModulePromise;