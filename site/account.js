import {getState,initAuth,signOut} from './auth-client.js';

const $=selector=>document.querySelector(selector);
function initials(name,fallback='SM'){
  const words=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return fallback;
  return (words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase();
}
function roleLabel(value){return String(value||'employee').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function languageLabel(value){return String(value||'en').toLowerCase()==='th'?'Thai / ไทย':'English / อังกฤษ'}
function loginUrl(){return`/login.html?next=${encodeURIComponent('/account.html')}`}
function complete(profile){return Boolean(profile?.pin_configured_at)}
function render(profile){
  $('#accountAvatar').textContent=initials(profile.display_name,initials(profile.employee_number));
  $('#accountName').textContent=profile.display_name||profile.employee_number;
  $('#accountEmployee').textContent=profile.employee_number||'—';
  $('#accountRole').textContent=roleLabel(profile.role);
  $('#accountLanguage').textContent=languageLabel(profile.preferred_language);
  $('#accountPin').textContent=complete(profile)?'Set / ตั้งแล้ว':'Setup required / ต้องตั้งรหัส';
  $('#accountStatus').textContent=profile.active===false?'Inactive':'Active';
  $('#accountAdmin').classList.toggle('hidden',!['admin','super_admin'].includes(profile.role));
}

let state;
try{state=await initAuth()}catch(_){state=getState()}
if(!state.authenticated||!state.profile||!complete(state.profile)){location.replace(loginUrl())}else render(state.profile);

$('#accountSignOut').addEventListener('click',async()=>{
  const button=$('#accountSignOut');button.disabled=true;$('#accountStatusMessage').textContent='Signing out… / กำลังออกจากระบบ…';
  try{await signOut()}finally{location.replace('/login.html')}
});

document.addEventListener('sindhorn:auth-changed',event=>{
  const profile=event.detail?.profile||getState().profile;
  if(!event.detail?.authenticated||!complete(profile)){location.replace(loginUrl());return}
  render(profile);
});
