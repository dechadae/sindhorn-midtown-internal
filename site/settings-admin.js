/* Settings › Admin: the employee directory and what an admin does to it.

   The frame (settings-page.js) paints the hero and decides the tab may be
   seen; this module fills the stack. It speaks to the same RPCs the live
   admin page uses - sindhorn_admin_list_users_v3 to read; create, update,
   upsert_contact, issue_activation_code and revoke_access to write - and
   carries the live page's rules across: who may pick which role, which
   fields an actor may edit, and how each error is explained.

   Everything on the tab is library: a search field, a utility row, one card
   of avatar list rows, the dialog standard with a form grid and the shared
   selector, the code display, the toast. Nothing paints its own material. */
import { supabaseRpc } from './auth-client.js';
import { hasCapability } from './capabilities.js';
import { appSelect, appSelectValue, setAppSelectValue, bindAppSelects } from './app-select.js';
import { openDialog, dialogHead, confirmDialog } from './app-dialog.js';
import { qrStyledSvg } from './qr-v6.js';
import { showToast } from './app-toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const SEARCH_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2L17 17"/></svg>';
const CLEAR_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';

const ROLES = [['employee', 'Employee'], ['supervisor', 'Supervisor'], ['manager', 'Manager'], ['admin', 'Admin'], ['super_admin', 'Super admin']];
const ACCOUNT_TYPES = [['employee', 'Employee'], ['developer', 'Developer'], ['contractor', 'Contractor'], ['service', 'Service']];
const LANGUAGES = [['th', 'Thai'], ['en', 'English']];
const ROLE_LABEL = Object.fromEntries(ROLES);
const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('') || '·';
const state = (label, title, copy, tone = 'empty', attrs = '') => `<div class="app-state app-card" data-tone="${tone}"${attrs}><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const field = (id, name, label, value, { type = 'text', note = '', required = false, maxlength = 120, autocomplete = 'off', inputmode = '', disabled = false, span = '' } = {}) =>
  `<div class="app-field"${span ? ` data-span="${span}"` : ''}><label for="${id}">${esc(label)}${note ? ` <span>${esc(note)}</span>` : ''}</label><input id="${id}" name="${name}" type="${type}" value="${esc(value ?? '')}" maxlength="${maxlength}" autocomplete="${autocomplete}"${inputmode ? ` inputmode="${inputmode}"` : ''}${required ? ' required' : ''}${disabled ? ' disabled' : ''}></div>`;
const check = (name, label, checked) => `<label class="app-check" data-mode="option"><input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}><span class="app-check-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg></span><span class="app-check-label">${esc(label)}</span></label>`;

/* The live admin page's error vocabulary, in the employee's words. */
function explain(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.payload?.code || error?.code || '');
  if (message.includes('admin access required')) return 'Admin access is required for this change.';
  if (message.includes('insufficient role')) return 'Your role cannot make this change.';
  if (message.includes('cannot remove own admin access')) return 'You cannot remove your own admin access.';
  if (code === '23505' || message.includes('duplicate key') || message.includes('already exists')) return 'That Employee ID or hotel email is already assigned.';
  if (message.includes('invalid employee input')) return 'Check the Employee ID, name and hotel email.';
  if (message.includes('invalid department')) return 'Choose a department from the list.';
  if (message.includes('invalid personal email')) return 'Use a valid personal email address.';
  if (message.includes('invalid mobile')) return 'Use an international mobile number such as +66…';
  if (message.includes('employee not found')) return 'That employee no longer exists. Refresh the list.';
  return 'The change could not be saved. Please try again.';
}

/* The invitation link the new shell reads: Employee ID and code prefilled
   on the sign-in page. */
const inviteUrl = (employeeNumber, code) => `${location.origin}/#signin?i=${encodeURIComponent(employeeNumber)}&c=${encodeURIComponent(code)}`;

export async function mountAdmin(stack, { manifest, signal }) {
  let alive = true, dialog = null, users = [], departments = [], actor = null, query = '';
  const can = key => hasCapability(key, manifest);
  const canManage = can('people.manage'), canSecurity = can('security.manage'), canContacts = can('private_contacts.manage'), canSystem = can('system.manage');

  stack.innerHTML = `
    <div class="app-field app-search"><label for="admin-search">Find an employee</label>${SEARCH_ICON}<input id="admin-search" type="search" placeholder="Name, Employee ID, position or email" autocomplete="off" autocapitalize="off" spellcheck="false" data-admin-search><button class="app-search-clear" type="button" aria-label="Clear search" data-admin-clear>${CLEAR_ICON}</button></div>
    <div class="app-utility-row"><span class="app-utility-note" data-admin-count></span>${canManage ? '<button class="app-utility-action" type="button" data-admin-add>Add employee</button>' : ''}</div>
    <div data-admin-list><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div><div class="app-skeleton-line"></div></div></div></div>`;
  const list = stack.querySelector('[data-admin-list]'), count = stack.querySelector('[data-admin-count]'), search = stack.querySelector('[data-admin-search]');

  const departmentName = id => departments.find(d => d.id === id)?.name_en || 'Unassigned';
  const matches = user => {
    if (!query) return true;
    return [user.display_name, user.employee_number, user.position_title, user.work_email, departmentName(user.department_id)].some(v => String(v || '').toLowerCase().includes(query));
  };

  function paintList() {
    if (!alive) return;
    const shown = users.filter(matches);
    count.textContent = query ? `${shown.length} of ${users.length}` : `${users.length} employees`;
    if (!users.length) { list.innerHTML = state('Employees', 'No employees yet.', canManage ? 'Add the first employee to start the directory.' : ''); return; }
    if (!shown.length) { list.innerHTML = state('Search', 'No employee matches that.', 'Try a name, Employee ID, position or email.'); return; }
    list.innerHTML = `<div class="app-card app-surface"><div class="app-list">${shown.map(user => `
      <button class="app-list-row" type="button" data-admin-open="${esc(user.id)}"${user.active ? '' : ' data-inactive'}>
        <span class="app-list-row-lead"><span class="app-avatar" aria-hidden="true">${esc(initials(user.display_name))}</span>
          <span class="app-list-row-main"><span class="app-list-row-title">${esc(user.display_name)}</span><span class="app-list-row-meta">${esc([user.employee_number, user.position_title, departmentName(user.department_id)].filter(Boolean).join(' · '))}</span></span></span>
        <span class="app-list-row-end">${user.active ? (user.auth_user_id ? '' : '<span class="app-badge" data-tone="quiet">Not signed up</span>') : '<span class="app-badge" data-tone="quiet">Inactive</span>'}${user.role !== 'employee' ? `<span class="app-badge">${esc(ROLE_LABEL[user.role] || user.role)}</span>` : ''}</span>
      </button>`).join('')}</div></div>`;
  }

  async function load() {
    try {
      const result = await supabaseRpc('sindhorn_admin_list_users_v3', {});
      if (!result?.ok) throw new Error(result?.error || 'admin_unavailable');
      users = result.users || []; departments = result.departments || []; actor = result.actor || null;
      paintList();
    } catch (error) {
      if (alive) list.innerHTML = state('Error', 'The directory could not be loaded.', explain(error), 'error') + '<div class="app-utility-row"><button class="app-utility-action" type="button" data-admin-retry>Try again</button></div>';
    }
  }

  const closeDialog = () => { if (dialog) dialog.close(''); };
  const open = markup => { closeDialog(); dialog = openDialog(markup, { onClose: () => { dialog = null; } }); return dialog; };

  /* Add or edit. Role and account type widen only for system managers;
     private contact fields stay disabled unless the actor may manage them
     and the employee has a contact record (or is new). */
  function editor(user) {
    const isNew = !user;
    const roleOptions = ROLES.filter(([value]) => value !== 'super_admin' || canSystem || user?.role === 'super_admin').map(([value, label]) => ({ value, label }));
    const typeOptions = ACCOUNT_TYPES.filter(([value]) => value !== 'developer' || canSystem || user?.account_type === 'developer').map(([value, label]) => ({ value, label }));
    const deptOptions = [{ value: '', label: 'Unassigned' }, ...departments.filter(d => d.active || d.id === user?.department_id).map(d => ({ value: d.id, label: d.name_en || d.code }))];
    const contactOk = canContacts && (isNew || user.private_contact !== null);
    const contact = user?.private_contact || {};
    const canIssue = canSecurity && user && user.active, canRevoke = canSecurity && user && user.active && user.id !== actor?.id;
    const d = open(`<form class="app-dialog-body" data-admin-form novalidate>
        ${dialogHead('Settings › Admin', isNew ? 'Add employee' : 'Edit employee')}
        <div class="app-dialog-grid">
          ${field('adm-number', 'employee_number', 'Employee ID', user?.employee_number, { required: true, maxlength: 32, autocomplete: 'off' })}
          ${field('adm-name', 'display_name', 'Display name', user?.display_name, { required: true })}
          ${field('adm-email', 'work_email', 'Hotel email', user?.work_email, { type: 'email', required: true, inputmode: 'email', maxlength: 160 })}
          ${field('adm-position', 'position_title', 'Position title', user?.position_title, { note: 'optional' })}
          ${appSelect({ kind: 'department', label: 'Department', options: deptOptions, selected: user?.department_id || '' })}
          ${appSelect({ kind: 'role', label: 'Role', options: roleOptions, selected: user?.role || 'employee' })}
          ${appSelect({ kind: 'account_type', label: 'Account type', options: typeOptions, selected: user?.account_type || 'employee' })}
          ${appSelect({ kind: 'preferred_language', label: 'Language', options: LANGUAGES.map(([value, label]) => ({ value, label })), selected: user?.preferred_language || 'th' })}
          <div data-span="full">${check('active', 'Access is active', isNew ? true : user.active !== false)}</div>
          <div class="app-dialog-section"><span>Private contact</span><small>${contactOk ? 'Where a first-login or recovery code can reach this employee. Private to admins.' : canContacts ? 'This employee has not shared a private contact.' : 'Your role cannot see private contacts.'}</small></div>
          ${field('adm-personal', 'personal_email', 'Personal email', contact.personal_email, { type: 'email', inputmode: 'email', maxlength: 160, disabled: !contactOk, note: 'optional' })}
          ${field('adm-mobile', 'mobile_e164', 'Mobile', contact.mobile_e164, { type: 'tel', inputmode: 'tel', maxlength: 16, disabled: !contactOk, note: 'optional · +66…' })}
        </div>
        ${canIssue ? `<div class="app-utility-row"><button class="app-utility-action" type="button" data-admin-issue>${user.auth_user_id ? 'Issue recovery code' : 'Issue first-login code'}</button></div>` : ''}
        <p class="app-dialog-status" data-dialog-status role="status" aria-live="polite"></p>
        <div class="app-dialog-actions${canRevoke ? ' app-dialog-actions-split' : ''}">
          ${canRevoke ? '<button class="app-utility-action" type="button" data-tone="danger" data-admin-revoke>Revoke access</button>' : ''}
          <div class="app-row"><button class="app-utility-action" type="button" data-dialog-close>Cancel</button><button class="app-primary app-control" type="submit" data-admin-save>${isNew ? 'Add employee' : 'Save'}</button></div>
        </div>
      </form>`);
    const form = d.querySelector('[data-admin-form]');
    bindAppSelects(form, { signal });
    form.addEventListener('submit', event => save(event, user, contactOk));
    form.querySelector('[data-admin-issue]')?.addEventListener('click', () => issue(user));
    form.querySelector('[data-admin-revoke]')?.addEventListener('click', () => revoke(user, form));
    form.querySelector('#adm-number')?.focus();
  }

  async function save(event, user, contactOk) {
    event.preventDefault();
    const form = event.currentTarget, status = form.querySelector('[data-dialog-status]'), button = form.querySelector('[data-admin-save]');
    const value = name => form.elements[name]?.value.trim() || '';
    const params = {
      p_employee_number: value('employee_number'), p_display_name: value('display_name'), p_work_email: value('work_email'),
      p_position_title: value('position_title') || null, p_department_id: appSelectValue(form, 'department') || null,
      p_role: appSelectValue(form, 'role'), p_active: form.elements.active.checked, p_preferred_language: appSelectValue(form, 'preferred_language'),
      p_account_type: appSelectValue(form, 'account_type')
    };
    if (!params.p_employee_number || !params.p_display_name || !params.p_work_email) { status.dataset.tone = 'error'; status.textContent = 'Employee ID, name and hotel email are needed.'; return; }
    button.disabled = true; status.dataset.tone = ''; status.textContent = user ? 'Saving…' : 'Adding…';
    try {
      const result = await supabaseRpc(user ? 'sindhorn_admin_update_employee_v3' : 'sindhorn_admin_create_employee_v3', user ? { p_employee_id: user.id, ...params } : params);
      if (!result?.ok || !result.employee) throw new Error(result?.error || 'save_failed');
      const saved = result.employee;
      if (contactOk) {
        const personal = value('personal_email'), mobile = value('mobile_e164'), before = user?.private_contact || {};
        if (personal !== (before.personal_email || '') || mobile !== (before.mobile_e164 || '')) {
          const contact = await supabaseRpc('sindhorn_admin_upsert_contact_v2', { p_employee_id: saved.id, p_personal_email: personal || null, p_mobile_e164: mobile || null });
          if (!contact?.ok) throw new Error(contact?.error || 'contact_failed');
        }
      }
      if (!alive) return;
      closeDialog();
      showToast(user ? 'Employee updated' : 'Employee added');
      await load();
    } catch (error) {
      status.dataset.tone = 'error'; status.textContent = explain(error); button.disabled = false;
    }
  }

  async function revoke(user, form) {
    const yes = await confirmDialog({ kicker: 'Settings › Admin', title: `Revoke access for ${user.display_name}?`, copy: 'Every signed-in device is signed out and the account is set inactive. A new first-login code can bring them back.', confirm: 'Revoke access', cancel: 'Keep access', tone: 'danger' });
    if (!yes || !alive) return;
    const status = form?.querySelector('[data-dialog-status]');
    if (status) { status.dataset.tone = ''; status.textContent = 'Revoking…'; }
    try {
      const result = await supabaseRpc('sindhorn_admin_revoke_access_v2', { p_employee_id: user.id });
      if (!result?.ok) throw new Error(result?.error || 'revoke_failed');
      if (!alive) return;
      closeDialog();
      showToast(`Access revoked · ${result.sessionsEnded ?? 0} session${result.sessionsEnded === 1 ? '' : 's'} ended`);
      await load();
    } catch (error) {
      if (status) { status.dataset.tone = 'error'; status.textContent = explain(error); }
    }
  }

  /* A code is shown once, large, with the link the employee opens. */
  async function issue(user) {
    const form = dialog?.querySelector('[data-admin-form]'), status = form?.querySelector('[data-dialog-status]'), button = form?.querySelector('[data-admin-issue]');
    if (button) button.disabled = true;
    if (status) { status.dataset.tone = ''; status.textContent = 'Issuing…'; }
    try {
      const result = await supabaseRpc('sindhorn_admin_issue_activation_code_v2', { p_employee_number: user.employee_number });
      if (!result?.ok || !result.code) throw new Error(result?.error || 'issue_failed');
      if (!alive) return;
      showCode(user, result);
    } catch (error) {
      if (status) { status.dataset.tone = 'error'; status.textContent = explain(error); }
      if (button) button.disabled = false;
    }
  }

  function showCode(user, issued) {
    const code = String(issued.code), url = inviteUrl(issued.employeeNumber || user.employee_number, code);
    const recovery = issued.purpose === 'recovery';
    const expires = issued.expiresAt ? new Date(issued.expiresAt) : null;
    let qr = '';
    try { qr = `<figure class="app-figure" data-code-qr>${qrStyledSvg(url)}</figure>`; } catch (_) {}
    const d = open(`<div class="app-dialog-body" data-admin-code>
        ${dialogHead('Settings › Admin', recovery ? 'Recovery code' : 'First-login code')}
        <p class="app-dialog-copy">For ${esc(user.display_name)} · ${esc(user.employee_number)}. Shown once${expires ? `, valid until ${esc(expires.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}.</p>
        <div class="app-stack">
          <p class="app-code-display" aria-label="One-time code ${esc(code.split('').join(' '))}">${code.split('').map(ch => `<b>${esc(ch)}</b>`).join('')}</p>
          <div class="app-business-card">${qr}<p class="app-business-card-link"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a></p></div>
        </div>
        <p class="app-dialog-status" data-dialog-status role="status" aria-live="polite"></p>
        <div class="app-dialog-actions"><button class="app-utility-action" type="button" data-code-copy>Copy link</button><button class="app-utility-action" type="button" data-code-share>Share</button><button class="app-primary app-control" type="button" data-dialog-close>Done</button></div>
      </div>`);
    const text = `${recovery ? 'Recovery' : 'First-login'} code for Sindhorn Midtown Internal\nEmployee ID: ${user.employee_number}\nCode: ${code}\n${url}`;
    d.querySelector('[data-code-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); showToast('Link copied'); } catch (_) { showToast('Could not copy the link'); }
    });
    d.querySelector('[data-code-share]').addEventListener('click', async () => {
      if (typeof navigator.share === 'function') { try { await navigator.share({ title: 'Sindhorn Midtown Internal', text, url }); return; } catch (error) { if (error?.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(text); showToast('Code and link copied'); } catch (_) { showToast('Could not copy the code'); }
    });
  }

  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); paintList(); }, { signal });
  stack.addEventListener('click', event => {
    if (event.target.closest('[data-admin-clear]')) { search.value = ''; query = ''; paintList(); search.focus(); return; }
    if (event.target.closest('[data-admin-add]')) { editor(null); return; }
    if (event.target.closest('[data-admin-retry]')) { load(); return; }
    const row = event.target.closest('[data-admin-open]');
    if (row) { const user = users.find(u => u.id === row.dataset.adminOpen); if (user) editor(user); }
  }, { signal });

  await load();
  return () => { alive = false; closeDialog(); };
}
