import {getAccessToken,getState,signOut,supabaseRpc} from './auth-client.js';
import {loadSettingsAuthority,hasCapability} from './capabilities.js';
import {qrSvg} from './qr-v6.js';

function ensureStylesheet(){
  if(document.querySelector('link[data-settings-style]'))return Promise.resolve();
  return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/settings.css?v=1';link.dataset.settingsStyle='true';link.onload=resolve;link.onerror=resolve;document.head.appendChild(link)});
}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function roleLabel(value){return String(value||'employee').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function accountTypeLabel(value){return roleLabel(value||'employee')}
function languageLabel(value){return String(value||'en').toLowerCase()==='th'?'Thai':'English'}
function initials(name,fallback='SM'){const words=String(name||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return fallback;return(words.length===1?words[0].slice(0,2):`${words[0][0]||''}${words.at(-1)?.[0]||''}`).toUpperCase()}
function fact(label,value){return`<div class="settings-fact"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function sectionKicker(number,label){return`<div class="settings-section-kicker"><span>${String(number).padStart(2,'0')} · ${esc(label)}</span></div>`}

export async function mountSettingsRoute(root){
  await ensureStylesheet();
  let disposed=false;
  let authority;
  try{authority=await loadSettingsAuthority({force:true})}catch(error){root.innerHTML='<section class="settings-route"><div class="settings-state">Settings could not be loaded.</div></section>';throw error}
  if(disposed)return()=>{};

  const profile=authority.profile||{};
  const sections=authority.sections||[];
  const capabilities=new Set(authority.capabilities||[]);
  const can=key=>capabilities.has(key);
  const availableKeys=new Set(sections.map(section=>section.key));
  const requested=new URLSearchParams(location.search).get('section');
  let current=availableKeys.has(requested)?requested:(location.pathname==='/admin'&&availableKeys.has('people')?'people':'account');
  if(!availableKeys.has(current))current=sections[0]?.key||'account';
  let peopleLoaded=false,users=[],departments=[],actor=null,currentUser=null,currentInviteUrl='';
  const cleanupFns=[];
  const on=(element,event,handler,options)=>{element?.addEventListener(event,handler,options);cleanupFns.push(()=>element?.removeEventListener(event,handler,options))};

  const nav=sections.length>1?`<nav class="settings-section-rail" aria-label="Settings sections">${sections.map(section=>`<button class="settings-nav-chip${section.key===current?' is-active':''}" type="button" data-section="${esc(section.key)}" aria-current="${section.key===current?'page':'false'}">${esc(section.navLabel||section.label||section.key)}</button>`).join('')}</nav>`:'';
  root.innerHTML=`
    <section class="settings-route" aria-labelledby="settingsTitle">
      <header class="settings-hero">
        <p class="settings-eyebrow">Employee settings</p>
        <div class="settings-identity-row"><div class="settings-avatar" aria-hidden="true">${esc(initials(profile.displayName,initials(profile.employeeNumber)))}</div><div><h1 id="settingsTitle">Settings</h1><p class="settings-name">${esc(profile.displayName||profile.employeeNumber||'Employee')}</p></div></div>
      </header>
      <div class="settings-panel-host" data-settings-panel></div>
      ${nav}
      <dialog class="settings-dialog" data-user-dialog>
        <form method="dialog" class="settings-dialog-body" data-user-form>
          <div class="settings-dialog-head"><div><p class="settings-dialog-kicker">People</p><h2 data-dialog-title>Employee</h2></div><button class="settings-close" type="button" data-dialog-close aria-label="Close">×</button></div>
          <input type="hidden" data-employee-id>
          <div class="settings-form-grid">
            <div class="settings-field"><label>Employee ID</label><input data-employee-number maxlength="64" required autocomplete="off"></div>
            <div class="settings-field"><label>Display name</label><input data-display-name maxlength="160"></div>
            <div class="settings-field settings-full"><label>Hotel work email <span>Optional</span></label><input data-work-email type="email" maxlength="320" placeholder="name@ihg.com"></div>
            <div class="settings-field"><label>Department</label><select data-department><option value="">Unassigned</option></select></div>
            <div class="settings-field"><label>Role</label><select data-role><option value="employee">Employee</option><option value="supervisor">Supervisor</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
            <div class="settings-field"><label>Account type</label><select data-account-type><option value="employee">Employee</option><option value="developer">Developer</option><option value="contractor">Contractor</option><option value="service">Service</option></select></div>
            <div class="settings-field"><label>Preferred language</label><select data-language><option value="th">Thai</option><option value="en">English</option></select></div>
            <div class="settings-field"><label>Access</label><select data-active><option value="true">Active</option><option value="false">Inactive</option></select></div>
            <div class="settings-form-section settings-full"><span>Private contact</span><small>Protected administrative data</small></div>
            <div class="settings-field"><label>Personal email <span>Optional</span></label><input data-personal-email type="email" maxlength="320" autocomplete="off"></div>
            <div class="settings-field"><label>Mobile <span>Optional · E.164</span></label><input data-mobile inputmode="tel" maxlength="16" placeholder="+66…" autocomplete="off"></div>
          </div>
          <div class="settings-status" data-dialog-status role="status" aria-live="polite"></div>
          <div class="settings-dialog-actions settings-dialog-actions-split"><div><button class="settings-danger" type="button" data-revoke hidden>Revoke access &amp; sessions</button></div><div class="settings-action-group"><button type="button" data-activation hidden>Issue first-login code</button><button type="button" data-cancel>Cancel</button><button class="settings-primary" type="submit" data-save>Save</button></div></div>
        </form>
      </dialog>
      <dialog class="settings-dialog settings-code-dialog" data-code-dialog>
        <div class="settings-dialog-body"><div class="settings-dialog-head"><div><p class="settings-dialog-kicker">Employee security</p><h2 data-code-title>One-time sign-in code</h2></div><button class="settings-close" type="button" data-code-close aria-label="Close">×</button></div><p class="settings-support">Give the code directly to the employee, or let them scan the QR. It expires after 15 minutes.</p><div class="settings-issued-code" data-issued-code></div><div class="settings-note" data-issued-meta></div><div class="settings-qr" data-invite-qr></div><div class="settings-code-actions"><button type="button" data-copy-code>Copy code</button><button type="button" data-copy-invite>Copy invitation link</button><button type="button" data-share-invite hidden>Share</button></div><div class="settings-dialog-actions"><button class="settings-primary" type="button" data-code-done>Done</button></div></div>
      </dialog>
    </section>`;

  const route=root.querySelector('.settings-route'),panel=route.querySelector('[data-settings-panel]');
  const $=selector=>route.querySelector(selector),$$=selector=>[...route.querySelectorAll(selector)];
  document.body.dataset.settingsContext=String(sections.length>1);

  async function rpc(name,params={}){const token=getAccessToken();if(!token)throw Object.assign(new Error('authentication_required'),{code:'authentication_required'});try{return await supabaseRpc(name,params,{accessToken:token})}catch(error){const message=String(error?.message||'').toLowerCase(),providerCode=String(error?.payload?.code||'');if(message.includes('admin access required'))error.code='admin_access_required';else if(message.includes('insufficient role'))error.code='insufficient_role';else if(message.includes('cannot remove own admin access'))error.code='cannot_remove_own_admin_access';else if(providerCode==='23505'||message.includes('duplicate key'))error.code='employee_already_exists';else if(message.includes('invalid employee input'))error.code='invalid_employee_input';else if(message.includes('invalid department'))error.code='invalid_department';else if(message.includes('invalid personal email'))error.code='invalid_personal_email';else if(message.includes('invalid mobile'))error.code='invalid_mobile';else error.code=error.code||'request_failed';throw error}}
  function writeError(error){if(error?.code==='admin_access_required'||error?.code==='authentication_required')return'Your account does not have permission for this action.';if(error?.code==='insufficient_role')return'Your capabilities do not allow this access change.';if(error?.code==='cannot_remove_own_admin_access')return'You cannot remove your own privileged access.';if(error?.code==='employee_already_exists')return'That Employee ID or hotel email is already assigned.';if(error?.code==='invalid_employee_input')return'Check the employee details and try again.';if(error?.code==='invalid_department')return'Choose an active department or leave it unassigned.';if(error?.code==='invalid_personal_email')return'Check the personal email address.';if(error?.code==='invalid_mobile')return'Use an international mobile number such as +66…';return'The change could not be saved. Please try again.'}
  function showStatus(message,tone='neutral'){const el=$('[data-dialog-status]');el.textContent=message||'';el.dataset.show=String(Boolean(message));el.dataset.tone=tone}
  function departmentLabel(user){if(!user.department_id)return'Unassigned';const item=departments.find(department=>department.id===user.department_id);return item?.name_en||item?.code||'Department'}
  function identityLabel(user){const methods=(user.sindhorn_employee_identities||[]).map(item=>item.login_method);if(methods.includes('microsoft365')&&methods.includes('employee_id'))return'Microsoft 365 + Employee ID';if(methods.includes('microsoft365'))return'Microsoft 365';if(methods.includes('employee_id')||user.auth_user_id)return'Employee ID';return'Not activated'}

  function accountPanel(){
    return`<section class="settings-section settings-account-section">${sectionKicker(1,'Account')}<div class="settings-facts">${fact('Employee ID',profile.employeeNumber||'—')}${fact('Role',roleLabel(profile.role))}${fact('Preferred language',languageLabel(profile.preferredLanguage))}${fact('Account status',profile.active===false?'Inactive':'Active')}${fact('Account type',accountTypeLabel(profile.accountType))}${fact('Permanent code',profile.pinConfigured?'Set':'Setup required')}</div><div class="settings-account-actions"><button class="settings-quiet-action" type="button" data-sign-out>Sign out</button></div></section>`;
  }
  function peopleSkeleton(){return`<section class="settings-section">${sectionKicker(2,'People')}<div class="settings-section-head"><div><h2>Employees</h2><p>Employees, departments and groups</p></div>${can('people.manage')?'<button class="settings-primary settings-add" type="button" data-add-user>Add employee</button>':''}</div><div class="settings-search-wrap"><input class="settings-search" type="search" data-user-search placeholder="Search employee…" aria-label="Search employees"></div><div class="settings-user-list" data-user-list><div class="settings-state">Loading employees…</div></div></section>`}
  function plannedPanel(section,index){const planned=section?.config?.status==='planned';return`<section class="settings-section">${sectionKicker(index,section?.label||'Settings')}<div class="settings-planned"><p class="settings-planned-label">${planned?'Configured in Supabase':'Available'}</p><h2>${esc(section?.label||'Section')}</h2><p>${esc(section?.description||'This section is controlled by the Supabase Settings manifest.')}</p>${planned?'<span>Renderer reserved · no fake controls exposed</span>':''}</div></section>`}

  function renderUsers(){
    const list=$('[data-user-list]'),search=$('[data-user-search]');if(!list)return;
    const q=String(search?.value||'').trim().toLowerCase();
    const filtered=users.filter(user=>[user.employee_number,user.display_name,user.work_email,user.role,user.account_type,departmentLabel(user)].some(value=>String(value||'').toLowerCase().includes(q)));
    list.innerHTML=filtered.length?filtered.map(user=>`<article class="settings-user-card${can('people.manage')?' is-editable':''}" data-user-id="${esc(user.id)}"><button class="settings-user-button" type="button" ${can('people.manage')?`data-edit-user="${esc(user.id)}"`:'disabled'}><div class="settings-user-top"><div><h3>${esc(user.display_name||user.employee_number)}</h3><p>${esc(user.employee_number)}${user.work_email?` · ${esc(user.work_email)}`:''}</p></div><span class="settings-user-chevron" aria-hidden="true">›</span></div><div class="settings-user-meta"><span>${esc(roleLabel(user.role))}</span><span>${esc(user.active?'Active':'Inactive')}</span><span>${esc(departmentLabel(user))}</span><span>${esc(accountTypeLabel(user.account_type))}</span></div><div class="settings-user-auth">${esc(identityLabel(user))}${Number(user.session_count||0)>0?` · ${Number(user.session_count)} active session${Number(user.session_count)===1?'':'s'}`:''}</div></button></article>`).join(''):'<div class="settings-state">No employees match this search.</div>';
    $$('[data-edit-user]').forEach(button=>on(button,'click',()=>openUserDialog(users.find(user=>user.id===button.dataset.editUser))));
  }
  async function loadPeople(){
    if(peopleLoaded){renderUsers();return}
    peopleLoaded=true;
    try{const result=await rpc('sindhorn_admin_list_users_v3');if(disposed)return;users=result?.users||[];departments=result?.departments||[];actor=result?.actor||null;renderUsers()}catch(error){const list=$('[data-user-list]');if(list)list.innerHTML=`<div class="settings-state">Could not load employee directory.<br><small>${esc(error.code||error.message)}</small></div>`}
  }

  function renderDepartmentOptions(selected=''){const select=$('[data-department]');if(!select)return;select.innerHTML=['<option value="">Unassigned</option>',...departments.filter(item=>item.active!==false||item.id===selected).map(item=>`<option value="${esc(item.id)}">${esc(item.name_en||item.code)}${item.active===false?' (inactive)':''}</option>`)].join('');select.value=selected||''}
  function fillDialog(user){
    currentUser=user||null;$('[data-dialog-title]').textContent=user?'Edit employee':'Add employee';$('[data-employee-id]').value=user?.id||'';$('[data-employee-number]').value=user?.employee_number||'';$('[data-display-name]').value=user?.display_name||'';$('[data-work-email]').value=user?.work_email||'';renderDepartmentOptions(user?.department_id||'');$('[data-role]').value=user?.role||'employee';$('[data-account-type]').value=user?.account_type||'employee';$('[data-language]').value=user?.preferred_language||'th';$('[data-active]').value=String(user?.active!==false);
    const contactReadable=can('private_contacts.manage')&&(!user||user.private_contact!==null);$('[data-personal-email]').disabled=!contactReadable;$('[data-mobile]').disabled=!contactReadable;$('[data-personal-email]').value=contactReadable?(user?.private_contact?.personal_email||''):'';$('[data-mobile]').value=contactReadable?(user?.private_contact?.mobile_e164||''):'';
    const activation=$('[data-activation]'),revoke=$('[data-revoke]');activation.hidden=!can('security.manage')||!user||user.active===false;activation.textContent=user?.auth_user_id?'Issue recovery code':'Issue first-login code';revoke.hidden=!can('security.manage')||!user||user.active===false||user.id===actor?.id;
    const system=can('system.manage');[...$('[data-role]').options].forEach(option=>{option.disabled=!system&&option.value==='super_admin'});[...$('[data-account-type]').options].forEach(option=>{option.disabled=!system&&option.value==='developer'});showStatus(contactReadable?'':'Private contact details require the private contact capability.',contactReadable?'neutral':'error');
  }
  function openUserDialog(user=null){fillDialog(user);$('[data-user-dialog]').showModal()}
  function closeUserDialog(){const dialog=$('[data-user-dialog]');if(dialog.open)dialog.close()}
  function formPayload(){return{employeeId:$('[data-employee-id]').value||undefined,employeeNumber:$('[data-employee-number]').value.trim(),displayName:$('[data-display-name]').value.trim(),workEmail:$('[data-work-email]').value.trim(),departmentId:$('[data-department]').value||null,role:$('[data-role]').value,accountType:$('[data-account-type]').value,preferredLanguage:$('[data-language]').value,active:$('[data-active]').value==='true',personalEmail:$('[data-personal-email]').value.trim(),mobileE164:$('[data-mobile]').value.trim()}}
  function rpcPayload(payload,{editing=false}={}){return{...(editing?{p_employee_id:payload.employeeId}:{}),p_employee_number:payload.employeeNumber,p_display_name:payload.displayName||null,p_work_email:payload.workEmail||null,p_department_id:payload.departmentId||null,p_role:payload.role,p_active:payload.active,p_preferred_language:payload.preferredLanguage,p_account_type:payload.accountType}}
  async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch(_){}const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}
  function invitationUrl(employeeNumber,code){return`${location.origin}/login.html#i=${encodeURIComponent(employeeNumber)}&c=${encodeURIComponent(code)}`}
  function showIssuedCode(result){const code=String(result.code||''),purpose=result.purpose==='recovery'?'Recovery':'First login';currentInviteUrl=invitationUrl(result.employeeNumber,code);$('[data-code-title]').textContent=`${purpose} code`;$('[data-issued-code]').textContent=code;$('[data-issued-meta]').textContent=`Employee ${result.employeeNumber} · ${purpose} · expires ${new Date(result.expiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;try{$('[data-invite-qr]').innerHTML=qrSvg(currentInviteUrl)}catch(_){$('[data-invite-qr]').textContent='QR unavailable. Use the code or copy the invitation link.'}$('[data-share-invite]').hidden=typeof navigator.share!=='function';$('[data-code-dialog]').showModal()}

  async function renderSection(key,{updateUrl=true}={}){
    current=availableKeys.has(key)?key:'account';
    $$('.settings-section-rail [data-section]').forEach(button=>{const active=button.dataset.section===current;button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false')});
    const section=sections.find(item=>item.key===current);
    if(current==='account')panel.innerHTML=accountPanel();
    else if(current==='people')panel.innerHTML=peopleSkeleton();
    else panel.innerHTML=plannedPanel(section,Math.max(1,sections.findIndex(item=>item.key===current)+1));
    if(updateUrl&&location.pathname==='/settings'){const next=new URL(location.href);if(current==='account')next.searchParams.delete('section');else next.searchParams.set('section',current);history.replaceState({...history.state,route:'settings'},'',`${next.pathname}${next.search}${next.hash}`)}
    if(current==='account')on(panel.querySelector('[data-sign-out]'),'click',async event=>{const button=event.currentTarget;button.disabled=true;button.textContent='Signing out…';try{await signOut()}finally{location.replace('/login.html')}});
    if(current==='people'){
      on(panel.querySelector('[data-user-search]'),'input',renderUsers);on(panel.querySelector('[data-add-user]'),'click',()=>openUserDialog());await loadPeople();
    }
    document.dispatchEvent(new CustomEvent('sindhorn:settings-section-changed',{detail:{section:current}}));
  }

  on($('[data-user-form]'),'submit',async event=>{event.preventDefault();const editing=Boolean($('[data-employee-id]').value),save=$('[data-save]');save.disabled=true;showStatus('Saving…');try{const payload=formPayload();const result=await rpc(editing?'sindhorn_admin_update_employee_v2':'sindhorn_admin_create_employee_v2',rpcPayload(payload,{editing}));const employee=result?.employee;if(!employee?.id)throw new Error('employee_save_failed');if(!$('[data-personal-email]').disabled&&can('private_contacts.manage'))await rpc('sindhorn_admin_upsert_contact_v2',{p_employee_id:employee.id,p_personal_email:payload.personalEmail||null,p_mobile_e164:payload.mobileE164||null});closeUserDialog();peopleLoaded=false;await loadPeople()}catch(error){showStatus(writeError(error),'error')}finally{save.disabled=false}});
  on($('[data-dialog-close]'),'click',closeUserDialog);on($('[data-cancel]'),'click',closeUserDialog);
  on($('[data-activation]'),'click',async()=>{if(!currentUser||!can('security.manage'))return;const button=$('[data-activation]');button.disabled=true;showStatus('Creating one-time code…');try{const result=await rpc('sindhorn_admin_issue_activation_code_v2',{p_employee_number:currentUser.employee_number});closeUserDialog();showIssuedCode(result)}catch(error){showStatus(writeError(error),'error')}finally{button.disabled=false}});
  on($('[data-revoke]'),'click',async()=>{if(!currentUser||!can('security.manage'))return;if(!confirm(`Revoke access and active sessions for ${currentUser.display_name||currentUser.employee_number}?`))return;const button=$('[data-revoke]');button.disabled=true;showStatus('Revoking access…');try{await rpc('sindhorn_admin_revoke_access_v2',{p_employee_id:currentUser.id});closeUserDialog();peopleLoaded=false;await loadPeople()}catch(error){showStatus(writeError(error),'error')}finally{button.disabled=false}});
  on($('[data-code-close]'),'click',()=>$('#x'));
  const codeDialog=$('[data-code-dialog]');
  on($('[data-code-close]'),'click',()=>codeDialog.close());on($('[data-code-done]'),'click',()=>codeDialog.close());
  on($('[data-copy-code]'),'click',async()=>{const ok=await copyText($('[data-issued-code]').textContent||'');$('[data-copy-code]').textContent=ok?'Copied':'Copy failed';setTimeout(()=>{if(!disposed)$('[data-copy-code]').textContent='Copy code'},1200)});
  on($('[data-copy-invite]'),'click',async()=>{const ok=await copyText(currentInviteUrl);$('[data-copy-invite]').textContent=ok?'Copied':'Copy failed';setTimeout(()=>{if(!disposed)$('[data-copy-invite]').textContent='Copy invitation link'},1200)});
  on($('[data-share-invite]'),'click',async()=>{if(!currentInviteUrl||typeof navigator.share!=='function')return;try{await navigator.share({title:'Sindhorn Midtown employee sign-in',text:'Use this secure invitation to sign in to Sindhorn Midtown Internal.',url:currentInviteUrl})}catch(_){}});
  $$('.settings-section-rail [data-section]').forEach(button=>on(button,'click',()=>renderSection(button.dataset.section)));

  await renderSection(current,{updateUrl:false});
  return()=>{disposed=true;delete document.body.dataset.settingsContext;cleanupFns.splice(0).forEach(fn=>fn());$$('dialog[open]').forEach(dialog=>{try{dialog.close()}catch(_){}});currentInviteUrl=''};
}
