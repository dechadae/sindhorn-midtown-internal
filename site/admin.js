import {getAccessToken,getState,initAuth,signOut,supabaseRpc} from './auth-client.js';
import {qrSvg} from './qr-v6.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
let users=[],departments=[],actor=null,currentUser=null,currentInviteUrl='';

function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function roleLabel(role){return String(role||'employee').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function identityLabel(user){
  const methods=(user.sindhorn_employee_identities||[]).map(item=>item.login_method);
  if(methods.includes('microsoft365')&&methods.includes('employee_id'))return 'Microsoft 365 + Employee ID';
  if(methods.includes('microsoft365'))return 'Microsoft 365';
  if(methods.includes('employee_id')||user.auth_user_id)return 'Employee ID';
  return 'Not activated';
}
function departmentLabel(user){
  if(!user.department_id)return 'Unassigned';
  const item=departments.find(department=>department.id===user.department_id);
  return item?.name_en||item?.code||'Department';
}
function showStatus(element,message,tone='neutral'){element.textContent=message||'';element.dataset.show=String(Boolean(message));element.dataset.tone=tone}
async function rpc(name,params={}){
  const token=getAccessToken();if(!token)throw Object.assign(new Error('authentication_required'),{code:'authentication_required'});
  try{return await supabaseRpc(name,params,{accessToken:token})}
  catch(error){
    const message=String(error?.message||'').toLowerCase(),providerCode=String(error?.payload?.code||'');
    if(message.includes('admin access required'))error.code='admin_access_required';
    else if(message.includes('insufficient role'))error.code='insufficient_role';
    else if(message.includes('cannot remove own admin access'))error.code='cannot_remove_own_admin_access';
    else if(providerCode==='23505'||message.includes('duplicate key'))error.code='employee_already_exists';
    else if(message.includes('invalid employee input'))error.code='invalid_employee_input';
    else if(message.includes('invalid department'))error.code='invalid_department';
    else if(message.includes('invalid personal email'))error.code='invalid_personal_email';
    else if(message.includes('invalid mobile'))error.code='invalid_mobile';
    else error.code=error.code||'request_failed';
    throw error;
  }
}
function writeError(error){
  if(error?.code==='admin_access_required'||error?.code==='authentication_required')return 'Administrator sign-in is required.';
  if(error?.code==='insufficient_role')return 'Your administrator role cannot make this access change.';
  if(error?.code==='cannot_remove_own_admin_access')return 'You cannot remove your own administrator access.';
  if(error?.code==='employee_already_exists')return 'That Employee ID or hotel email is already assigned.';
  if(error?.code==='invalid_employee_input')return 'Check the employee details and try again.';
  if(error?.code==='invalid_department')return 'Choose an active department or leave it unassigned.';
  if(error?.code==='invalid_personal_email')return 'Check the personal email address.';
  if(error?.code==='invalid_mobile')return 'Use an international mobile number such as +66…';
  return 'The change could not be saved. Please try again.';
}

function renderUsers(){
  const q=$('#userSearch').value.trim().toLowerCase();
  const filtered=users.filter(user=>[user.employee_number,user.display_name,user.work_email,user.role,user.account_type,departmentLabel(user)].some(value=>String(value||'').toLowerCase().includes(q)));
  $('#userList').innerHTML=filtered.length?filtered.map(user=>`
    <article class="user-row" data-user-id="${esc(user.id)}">
      <div><div class="user-name">${esc(user.display_name||user.employee_number)}</div><div class="user-id">${esc(user.employee_number)}${user.work_email?` · ${esc(user.work_email)}`:''}</div></div>
      <div><span class="pill">${esc(roleLabel(user.role))}</span><div class="user-login">${esc(user.account_type||'employee')}</div></div>
      <div><span class="pill ${user.active?'':'inactive'}">${user.active?'Active':'Inactive'}</span><div class="user-login">${esc(user.preferred_language==='en'?'English':'ไทย')}</div></div>
      <div><div class="user-login">${esc(departmentLabel(user))}</div><div class="user-login">${esc(identityLabel(user))}${Number(user.session_count||0)>0?` · ${Number(user.session_count)} session${Number(user.session_count)===1?'':'s'}`:''}</div></div>
      <button class="row-edit" type="button" data-edit="${esc(user.id)}">Edit</button>
    </article>`).join(''):'<div class="empty">No employees match this search.</div>';
  $$('[data-edit]').forEach(button=>button.addEventListener('click',()=>openUserDialog(users.find(user=>user.id===button.dataset.edit))));
}

async function loadUsers(){
  $('#userList').innerHTML='<div class="empty">Loading employees…</div>';
  try{
    const result=await rpc('sindhorn_admin_list_users_v3');
    users=result?.users||[];departments=result?.departments||[];actor=result?.actor||null;renderUsers();
  }catch(error){$('#userList').innerHTML=`<div class="empty">Could not load employee directory.<br><small>${esc(error.code||error.message)}</small></div>`}
}

function renderDepartmentOptions(selected=''){
  const options=['<option value="">Unassigned</option>',...departments.filter(item=>item.active!==false||item.id===selected).map(item=>`<option value="${esc(item.id)}">${esc(item.name_en||item.code)}${item.active===false?' (inactive)':''}</option>`)];
  $('#department').innerHTML=options.join('');$('#department').value=selected||'';
}
function fillDialog(user){
  currentUser=user||null;$('#dialogTitle').textContent=user?'Edit employee':'Add employee';
  $('#employeeIdHidden').value=user?.id||'';$('#employeeNumber').value=user?.employee_number||'';$('#displayName').value=user?.display_name||'';$('#workEmail').value=user?.work_email||'';
  renderDepartmentOptions(user?.department_id||'');
  $('#role').value=user?.role||'employee';$('#accountType').value=user?.account_type||'employee';$('#preferredLanguage').value=user?.preferred_language||'th';$('#active').value=String(user?.active!==false);
  const contactReadable=!user||user.private_contact!==null;
  $('#personalEmail').disabled=!contactReadable;$('#mobileE164').disabled=!contactReadable;
  $('#personalEmail').value=contactReadable?(user?.private_contact?.personal_email||''):'';$('#mobileE164').value=contactReadable?(user?.private_contact?.mobile_e164||''):'';
  $('#activationButton').classList.toggle('hidden',!user||user.active===false);
  $('#activationButton').textContent=user?.auth_user_id?'Issue recovery code':'Issue first-login code';
  $('#revokeButton').classList.toggle('hidden',!user||user.active===false||user.id===actor?.id);
  showStatus($('#dialogStatus'),contactReadable?'':'Private contact details for this privileged account require Super Admin access.',contactReadable?'neutral':'error');
  const isSuper=actor?.role==='super_admin';
  [...$('#role').options].forEach(option=>{option.disabled=!isSuper&&['admin','super_admin'].includes(option.value)});
  [...$('#accountType').options].forEach(option=>{option.disabled=!isSuper&&option.value==='developer'});
}
function openUserDialog(user=null){fillDialog(user);$('#userDialog').showModal()}
function closeUserDialog(){if($('#userDialog').open)$('#userDialog').close()}
function formPayload(){return{employeeId:$('#employeeIdHidden').value||undefined,employeeNumber:$('#employeeNumber').value.trim(),displayName:$('#displayName').value.trim(),workEmail:$('#workEmail').value.trim(),departmentId:$('#department').value||null,role:$('#role').value,accountType:$('#accountType').value,preferredLanguage:$('#preferredLanguage').value,active:$('#active').value==='true',personalEmail:$('#personalEmail').value.trim(),mobileE164:$('#mobileE164').value.trim()}}
function rpcPayload(payload,{editing=false}={}){
  return{
    ...(editing?{p_employee_id:payload.employeeId}:{}),
    p_employee_number:payload.employeeNumber,p_display_name:payload.displayName||null,p_work_email:payload.workEmail||null,p_department_id:payload.departmentId||null,p_role:payload.role,p_active:payload.active,p_preferred_language:payload.preferredLanguage,p_account_type:payload.accountType
  };
}

async function copyText(value){
  try{await navigator.clipboard.writeText(value);return true}catch(_){}
  const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;
}
function invitationUrl(employeeNumber,code){return `${location.origin}/login.html#i=${encodeURIComponent(employeeNumber)}&c=${encodeURIComponent(code)}`}
function showIssuedCode(result){
  const code=String(result.code||''),purpose=result.purpose==='recovery'?'Recovery':'First login';
  currentInviteUrl=invitationUrl(result.employeeNumber,code);
  $('#codeDialogTitle').textContent=`${purpose} code`;
  $('#issuedCode').textContent=code;
  $('#issuedCodeMeta').textContent=`Employee ${result.employeeNumber} · ${purpose} · expires ${new Date(result.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  try{$('#inviteQr').innerHTML=qrSvg(currentInviteUrl)}catch(error){$('#inviteQr').textContent='QR unavailable. Use the code or copy the invitation link.'}
  $('#shareInvite').classList.toggle('hidden',typeof navigator.share!=='function');
  $('#codeDialog').showModal();
}

$('#userForm').addEventListener('submit',async event=>{
  event.preventDefault();const editing=Boolean($('#employeeIdHidden').value),save=$('#saveButton');save.disabled=true;showStatus($('#dialogStatus'),'Saving…');
  try{
    const payload=formPayload();
    const result=await rpc(editing?'sindhorn_admin_update_employee_v2':'sindhorn_admin_create_employee_v2',rpcPayload(payload,{editing}));
    const employee=result?.employee;if(!employee?.id)throw new Error('employee_save_failed');
    if(!$('#personalEmail').disabled){
      try{await rpc('sindhorn_admin_upsert_contact_v2',{p_employee_id:employee.id,p_personal_email:payload.personalEmail||null,p_mobile_e164:payload.mobileE164||null})}
      catch(contactError){showStatus($('#dialogStatus'),`Employee details were saved, but the private contact was not: ${writeError(contactError)}`,'error');await loadUsers();return}
    }
    closeUserDialog();await loadUsers();
  }catch(error){showStatus($('#dialogStatus'),writeError(error),'error')}
  finally{save.disabled=false}
});

$('#activationButton').addEventListener('click',async()=>{
  if(!currentUser)return;const button=$('#activationButton');button.disabled=true;showStatus($('#dialogStatus'),'Issuing one-time code…');
  try{const result=await rpc('sindhorn_admin_issue_activation_code_v2',{p_employee_number:currentUser.employee_number});closeUserDialog();showIssuedCode(result)}
  catch(error){showStatus($('#dialogStatus'),writeError(error),'error')}
  finally{button.disabled=false}
});

$('#revokeButton').addEventListener('click',async()=>{
  if(!currentUser)return;
  if(!confirm(`Revoke access for ${currentUser.display_name||currentUser.employee_number}?\n\nThis immediately marks the employee inactive, revokes unused codes and ends refreshable Supabase sessions.`))return;
  const button=$('#revokeButton');button.disabled=true;showStatus($('#dialogStatus'),'Revoking access…');
  try{await rpc('sindhorn_admin_revoke_access_v2',{p_employee_id:currentUser.id});closeUserDialog();await loadUsers()}
  catch(error){showStatus($('#dialogStatus'),writeError(error),'error')}
  finally{button.disabled=false}
});

$('#copyCode').addEventListener('click',async()=>{const ok=await copyText($('#issuedCode').textContent.trim());$('#copyCode').textContent=ok?'Copied':'Copy failed';setTimeout(()=>{$('#copyCode').textContent='Copy code'},1400)});
$('#copyInvite').addEventListener('click',async()=>{const ok=await copyText(currentInviteUrl);$('#copyInvite').textContent=ok?'Copied':'Copy failed';setTimeout(()=>{$('#copyInvite').textContent='Copy invitation link'},1400)});
$('#shareInvite').addEventListener('click',async()=>{if(!currentInviteUrl||typeof navigator.share!=='function')return;try{await navigator.share({title:'Sindhorn Midtown employee sign in',text:'One-time employee sign-in invitation',url:currentInviteUrl})}catch(_){}});

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
