import {getState,initAuth,signOut} from './auth-client.js';

const TEMPLATE=`
<section class="account-route" aria-labelledby="accountTitle">
  <div class="account-card">
    <div class="account-brand-row">
      <a class="account-home" href="/" data-app-route="today" aria-label="Open Sindhorn Midtown Internal"><img class="brand-logo" src="/assets/brand/sindhorn-midtown-vignette-black.png" alt="Sindhorn Midtown Hotel Bangkok, Vignette Collection"></a>
      <a class="account-close" href="/" data-app-route="today" aria-label="Close account dashboard">×</a>
    </div>
    <div class="account-identity"><div id="accountAvatar" class="account-avatar" aria-hidden="true">SM</div><div class="account-heading"><p class="account-eyebrow">Employee account</p><h1 id="accountTitle">My account</h1><p id="accountName" class="account-name">Loading…</p></div></div>
    <dl class="account-details">
      <div><dt>Employee ID</dt><dd id="accountEmployee">—</dd></div><div><dt>Role</dt><dd id="accountRole">—</dd></div><div><dt>Preferred language</dt><dd id="accountLanguage">—</dd></div><div><dt>Permanent code</dt><dd id="accountPin">Set</dd></div><div><dt>Account status</dt><dd id="accountStatus">Active</dd></div>
    </dl>
    <div class="account-actions"><a class="account-primary" href="/" data-app-route="today">Open app</a><a id="accountAdmin" class="account-secondary hidden" href="/admin" data-app-route="admin">Admin</a><button id="accountSignOut" class="account-secondary" type="button">Sign out</button></div>
    <p id="accountStatusMessage" class="account-status" role="status" aria-live="polite"></p>
  </div>
</section>`;

function initials(name,fallback='SM'){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return fallback;return(words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase()}
function roleLabel(value){return String(value||'employee').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function languageLabel(value){return String(value||'en').toLowerCase()==='th'?'Thai':'English'}
function complete(profile){return Boolean(profile?.pin_configured_at)}

export async function mountAccountRoute(root){
  root.innerHTML=TEMPLATE;const $=selector=>root.querySelector(selector);let disposed=false;
  function render(profile){if(disposed||!profile)return;$('#accountAvatar').textContent=initials(profile.display_name,initials(profile.employee_number));$('#accountName').textContent=profile.display_name||profile.employee_number;$('#accountEmployee').textContent=profile.employee_number||'—';$('#accountRole').textContent=roleLabel(profile.role);$('#accountLanguage').textContent=languageLabel(profile.preferred_language);$('#accountPin').textContent=complete(profile)?'Set':'Setup required';$('#accountStatus').textContent=profile.active===false?'Inactive':'Active';$('#accountAdmin').classList.toggle('hidden',!['admin','super_admin'].includes(profile.role))}
  let state;try{state=await initAuth()}catch(_){state=getState()}
  if(disposed)return()=>{};
  if(!state.authenticated||!state.profile||!complete(state.profile)){location.replace(`/login.html?next=${encodeURIComponent('/account')}`);return()=>{}}
  render(state.profile);
  const signOutButton=$('#accountSignOut');
  const onSignOut=async()=>{signOutButton.disabled=true;$('#accountStatusMessage').textContent='Signing out…';try{await signOut()}finally{location.replace('/login.html')}};
  signOutButton.addEventListener('click',onSignOut);
  const onAuthChanged=event=>{const profile=event.detail?.profile||getState().profile;if(!event.detail?.authenticated||!complete(profile)){location.replace(`/login.html?next=${encodeURIComponent('/account')}`);return}render(profile)};
  document.addEventListener('sindhorn:auth-changed',onAuthChanged);
  return()=>{disposed=true;signOutButton?.removeEventListener('click',onSignOut);document.removeEventListener('sindhorn:auth-changed',onAuthChanged)};
}
