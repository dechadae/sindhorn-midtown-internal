import {getAccessToken,getState,initAuth,signOut} from './auth-client.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
let users=[],actor=null,currentUser=null;

function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function roleLabel(role){return String(role||'employee').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function identityLabel(user){
  const methods=(user.sindhorn_employee_identities||[]).map(item=>item.login_method);
  if(methods.includes('microsoft365')&&methods.includes('employee_id'))return 'Microsoft 365 + Employee ID';
  if(methods.includes('microsoft365'))return 'Microsoft 365';
  if(methods.includes('employee_id')||user.auth_user_id)return 'Employee ID';
  return 'Not activated';
}
function worker(){return getState().authWorker}
function showStatus(element,message,tone='neutral'){element.textContent=message||'';element.dataset.show=String(Boolean(message));element.dataset.tone=tone}
async function api(path,{method='GET',body}={}){
  const token=getAccessToken();if(!token)throw Object.assign(new Error('authentication_required'),{code:'authentication_required'});
  const response=await fetch(`${worker()}${path}`,{method,cache:'no-store',headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text=await response.text();let data={};try{data=JSON.parse(text||'{}')}catch(_){}
  if(!response.ok){const error=Object.assign(new Error(data.message||data.error||`HTTP ${response.status}`),{status:response.status,code:data.error||'request_failed',payload:data});throw error}
  return data;
}
function writeError(error){
  if(error?.code==='mfa_or_admin_required'||error?.code==='reauthentication_required')return 'Additional administrator verification (MFA) is required before changing staff access.';
  if(error?.code==='insufficient_role')return 'Your administrator role cannot make this access change.';
  if(error?.code==='cannot_remove_own_admin_access')return 'You cannot remove your own administrator access.';
  if(error?.code==='employee_already_exists')return 'That Employee ID or hotel email is already assigned.';
  if(error?.code==='invalid_work_email')return 'Enter a valid hotel work email or leave it blank.';
  return 'The change could not be saved. Please try again.';
}

function renderUsers(){
  const q=$('#userSearch').value.trim().toLowerCase();
  const filtered=users.filter(user=>[user.employee_number,user.display_name,user.work_email,user.role,user.account_type].some(value=>String(value||'').toLowerCase().includes(q)));
  $('#userList').innerHTML=filtered.length?filtered.map(user=>`
    <article class="user-row" data-user-id="${esc(user.id)}">
      <div><div class="user-name">${esc(user.display_name||user.employee_number)}</div><div class="user-id">${esc(user.employee_number)}${user.work_email?` · ${esc(user.work_email)}`:''}</div></div>
      <div><span class="pill">${esc(roleLabel(user.role))}</span><div class="user-login">${esc(user.account_type||'employee')}</div></div>
      <div><span class="pill ${user.active?'':'inactive'}">${user.active?'Active':'Inactive'}</span><div class="user-login">${esc(user.preferred_language==='en'?'English':'ไทย')}</div></div>
      <div><div class="user-login">${esc(identityLabel(user))}</div></div>
      <button class="row-edit" type="button" data-edit="${esc(user.id)}">Edit</button>
    </article>`).join(''):'<div class="empty">No employees match this search.</div>';
  $$('[data-edit]').forEach(button=>button.addEventListener('click',()=>openUserDialog(users.find(user=>user.id===button.dataset.edit))));
}

async function loadUsers(){
  $('#userList').innerHTML='<div class="empty">Loading employees…</div>';
  try{const result=await api('/admin/users');users=result.users||[];actor=result.actor||null;renderUsers()}
  catch(error){$('#userList').innerHTML=`<div class="empty">Could not load employee directory.<br><small>${esc(error.code||error.message)}</small></div>`}
}

function fillDialog(user){
  currentUser=user||null;$('#dialogTitle').textContent=user?'Edit employee':'Add employee';
  $('#employeeIdHidden').value=user?.id||'';$('#employeeNumber').value=user?.employee_number||'';$('#displayName').value=user?.display_name||'';$('#workEmail').value=user?.work_email||'';
  $('#role').value=user?.role||'employee';$('#accountType').value=user?.account_type||'employee';$('#preferredLanguage').value=user?.preferred_language||'th';$('#active').value=String(user?.active!==false);
  $('#activationButton').classList.toggle('hidden',!user);showStatus($('#dialogStatus'),'');
  const isSuper=actor?.role==='super_admin';
  [...$('#role').options].forEach(option=>{option.disabled=!isSuper&&['admin','super_admin'].includes(option.value)});
  [...$('#accountType').options].forEach(option=>{option.disabled=!isSuper&&option.value==='developer'});
}
function openUserDialog(user=null){fillDialog(user);$('#userDialog').showModal()}
function closeUserDialog(){if($('#userDialog').open)$('#userDialog').close()}
function formPayload(){return{employeeId:$('#employeeIdHidden').value||undefined,employeeNumber:$('#employeeNumber').value.trim(),displayName:$('#displayName').value.trim(),workEmail:$('#workEmail').value.trim(),role:$('#role').value,accountType:$('#accountType').value,preferredLanguage:$('#preferredLanguage').value,active:$('#active').value==='true',departmentId:null}}

$('#userForm').addEventListener('submit',async event=>{
  event.preventDefault();const editing=Boolean($('#employeeIdHidden').value),save=$('#saveButton');save.disabled=true;showStatus($('#dialogStatus'),'Saving…');
  try{
    const result=await api(editing?'/admin/users/update':'/admin/users',{method:'POST',body:formPayload()});
    const employee=result.employee;if(employee){const index=users.findIndex(user=>user.id===employee.id);if(index>=0)users[index]={...users[index],...employee};else users.push({...employee,sindhorn_employee_identities:[]})}
    closeUserDialog();renderUsers();await loadUsers();
  }catch(error){showStatus($('#dialogStatus'),writeError(error),'error')}
  finally{save.disabled=false}
});
$('#activationButton').addEventListener('click',async()=>{
  if(!currentUser)return;const button=$('#activationButton');button.disabled=true;showStatus($('#dialogStatus'),'Issuing one-time code…');
  try{
    const result=await api('/admin/activation-code',{method:'POST',body:{employeeNumber:currentUser.employee_number}});
    $('#issuedCode').textContent=result.code;$('#issuedCodeMeta').textContent=`Employee ${result.employeeNumber} · ${result.purpose==='recovery'?'Recovery':'Activation'} · expires ${new Date(result.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    closeUserDialog();$('#codeDialog').showModal();
  }catch(error){showStatus($('#dialogStatus'),writeError(error),'error')}
  finally{button.disabled=false}
});

$('#addUserButton').addEventListener('click',()=>openUserDialog());$('#dialogClose').addEventListener('click',closeUserDialog);$('#cancelButton').addEventListener('click',closeUserDialog);$('#userSearch').addEventListener('input',renderUsers);
$('#codeClose').addEventListener('click',()=>$('#codeDialog').close());$('#codeDone').addEventListener('click',()=>$('#codeDialog').close());
$('#signOutButton').addEventListener('click',async()=>{await signOut();location.replace('/login.html')});

$$('.admin-nav button').forEach(button=>button.addEventListener('click',()=>{
  $$('.admin-nav button').forEach(node=>node.setAttribute('aria-selected',String(node===button)));
  const usersSelected=button.dataset.panel==='users';$('#usersPanel').classList.toggle('hidden',!usersSelected);$('#placeholderPanel').classList.toggle('hidden',usersSelected);
  if(!usersSelected)$('#placeholderText').innerHTML=`<strong>${esc(button.textContent)}</strong><br><br>This section is reserved in the Phase 9 admin architecture and will be connected next.`;
}));

try{await initAuth()}catch(_){}
const state=getState(),profile=state.profile;
if(!state.authenticated||!['admin','super_admin'].includes(profile?.role)){
  $('#usersPanel').classList.add('hidden');$('#accessPanel').classList.remove('hidden');$('#adminIdentity').textContent='Administrator sign-in required';
}else{
  $('#adminIdentity').textContent=`${profile.display_name||profile.employee_number} · ${roleLabel(profile.role)}`;await loadUsers();
}
