import {getState,initAuth} from './auth-client.js';

const LOGIN_PATH='/login.html';
const ACCOUNT_PATH='/account';

function safeReturnPath(){
  const value=`${location.pathname}${location.search}${location.hash}`;
  if(!value.startsWith('/')||value.startsWith('//')||value.startsWith(LOGIN_PATH))return'/';
  return value;
}
function loginUrl(){return`${LOGIN_PATH}?next=${encodeURIComponent(safeReturnPath())}`}
function hasCompleteEmployeeAuth(state){return Boolean(state?.authenticated&&state?.profile&&state.profile.pin_configured_at)}
function initials(name,fallback='SM'){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return fallback;return(words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase()}
function compactName(profile){const value=String(profile?.display_name||profile?.employee_number||'Account').trim();return value||'Account'}
function applyEmployeeHeader(){
  const profile=getState().profile||window.__SINDHORN_AUTH_PROFILE__;if(!profile)return;
  const tools=document.querySelector('.masthead-tools');if(!tools)return;
  const existing=tools.querySelector('.masthead-user'),today=tools.querySelector('.today');if(today)today.remove();
  const link=existing||document.createElement('a');link.className='masthead-user';link.href=ACCOUNT_PATH;link.dataset.appRoute='account';link.setAttribute('aria-label',`Open account dashboard for ${compactName(profile)}`);link.replaceChildren();
  const name=document.createElement('span');name.className='masthead-user-name';name.textContent=compactName(profile);
  const avatar=document.createElement('span');avatar.className='masthead-user-avatar';avatar.textContent=initials(profile.display_name,initials(profile.employee_number,'SM'));avatar.setAttribute('aria-hidden','true');
  link.append(name,avatar);if(!existing)tools.prepend(link);
}
async function loadClassicScript(src){await new Promise((resolve,reject)=>{if(document.querySelector(`script[data-auth-shell-src="${src}"]`)){resolve();return}const script=document.createElement('script');script.src=src;script.dataset.authShellSrc=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Unable to load ${src}`));document.head.appendChild(script)})}

let state;try{state=await initAuth()}catch(_){state=getState()}
if(!hasCompleteEmployeeAuth(state)){location.replace(loginUrl())}else{
  window.__SINDHORN_AUTH_PROFILE__=state.profile;
  document.addEventListener('sindhorn:pack-updated',applyEmployeeHeader);
  document.addEventListener('sindhorn:auth-changed',event=>{const nextState=getState();if(!event.detail?.authenticated||!hasCompleteEmployeeAuth(nextState)){location.replace(loginUrl());return}window.__SINDHORN_AUTH_PROFILE__=event.detail.profile||nextState.profile;applyEmployeeHeader()});
  await loadClassicScript('/location.js');await import('./bootstrap.js');applyEmployeeHeader();
}
