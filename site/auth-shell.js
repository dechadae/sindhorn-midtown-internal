import {getState,initAuth} from './auth-client.js';

const LOGIN_PATH='/login.html';
const SETTINGS_PATH='/settings';

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
async function evictStaleBootstrapRuntime(){
  if(!('caches'in window))return;
  try{
    const keys=await caches.keys();
    await Promise.all(keys.map(async key=>{
      const cache=await caches.open(key);
      await Promise.all([
        cache.delete('/betta-runtime.js?v=1'),
        cache.delete('/betta-runtime.js'),
        cache.delete('/route-registry.js'),
        cache.delete('/settings-route-v3.js'),
        cache.delete('/settings-route-v3.js?v=12&r=release-health-1'),
        cache.delete('/business-card-settings.css?v=10'),
        cache.delete('/bootstrap.js?v=2'),
        cache.delete('/bootstrap.js?v=3'),
        cache.delete('/app-glass-runtime.js'),
        cache.delete('/app-glass-runtime.js?v=1'),
        cache.delete('/app.js'),
        cache.delete('/app.js?v=1'),
        cache.delete('/pwa.css')
      ]);
    }));
  }catch(_){}
}

const earlyBetta=import('./betta-runtime.js?v=2').then(module=>module.initEnvironment()).catch(error=>{console.warn('Early Betta startup unavailable; bootstrap will retry.',error)});

let state;try{state=await initAuth()}catch(_){state=getState()}
if(!hasCompleteEmployeeAuth(state)){location.replace(loginUrl())}else{
  window.__SINDHORN_AUTH_PROFILE__=state.profile;
  document.addEventListener('sindhorn:pack-updated',()=>applyEmployeeHeader());
  document.addEventListener('sindhorn:capabilities-updated',event=>applyEmployeeHeader(event.detail?.profile));
  document.addEventListener('sindhorn:auth-changed',event=>{const nextState=getState();if(!event.detail?.authenticated||!hasCompleteEmployeeAuth(nextState)){location.replace(loginUrl());return}window.__SINDHORN_AUTH_PROFILE__=event.detail.profile||nextState.profile;applyEmployeeHeader(window.__SINDHORN_AUTH_PROFILE__)});
  await loadClassicScript('/location.js');
  await evictStaleBootstrapRuntime();
  await import('./bootstrap.js?v=4');
  await import('./onboarding.js?v=1');
  applyEmployeeHeader();
}
void earlyBetta;
