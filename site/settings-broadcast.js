/* Settings › Broadcast: the messages the hotel sends to every employee or to
   a department, and what a sender does with them.

   The frame (settings-page.js) paints the hero and decides the tab may be
   seen; this module fills the stack. It speaks to the broadcast RPCs -
   sindhorn_broadcast_list_admin_v1 to read; save, publish and revoke to
   write - which check the broadcasts.manage capability themselves. Push
   delivery of a broadcast is a later release; here a broadcast reaches the
   Messages tab of every employee in its audience.

   Everything on the tab is library: a utility row, one card of list rows
   with status badges, the dialog standard with a form grid, the textarea
   and datetime wells, chip groups for the audience, the shared selector,
   option checks, the confirm, the toast. Nothing paints its own material. */
import { supabaseRpc } from './auth-client.js';
import { appSelect, appSelectValue, bindAppSelects } from './app-select.js';
import { openDialog, dialogHead, confirmDialog } from './app-dialog.js';
import { showToast } from './app-toast.js';
import { categoryLabel, priorityLabel, categoryOptions, priorityOptions } from './broadcast-inbox.js';
import { formatDateTime } from './app-format.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const ROLES = [['employee', 'Employees'], ['supervisor', 'Supervisors'], ['manager', 'Managers'], ['admin', 'Admins'], ['super_admin', 'Super admins']];
const ROLE_LABEL = Object.fromEntries(ROLES);
const STATUS = { published: ['Published', ''], scheduled: ['Scheduled', 'quiet'], draft: ['Draft', 'quiet'], revoked: ['Revoked', 'danger'] };

const state = (label, title, copy, tone = 'empty') => `<div class="app-state app-card" data-tone="${tone}"><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const field = (id, name, label, value, { type = 'text', note = '', required = false, maxlength = 140, disabled = false, span = 'full' } = {}) =>
  `<div class="app-field"${span ? ` data-width="${span}"` : ''}><label for="${id}">${esc(label)}${note ? ` <span>${esc(note)}</span>` : ''}</label><input id="${id}" name="${name}" type="${type}" value="${esc(value ?? '')}"${type === 'text' ? ` maxlength="${maxlength}"` : ''} autocomplete="off"${required ? ' required' : ''}${disabled ? ' disabled' : ''}></div>`;
const area = (id, name, label, value, { note = '', required = false, disabled = false } = {}) =>
  `<div class="app-field" data-width="full"><label for="${id}">${esc(label)}${note ? ` <span>${esc(note)}</span>` : ''}</label><textarea id="${id}" name="${name}" rows="5" maxlength="4000"${required ? ' required' : ''}${disabled ? ' disabled' : ''}>${esc(value ?? '')}</textarea></div>`;
const check = (name, label, checked, disabled) => `<label class="app-check" data-mode="option"><input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span class="app-check-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg></span><span class="app-check-label">${esc(label)}</span></label>`;
const chip = (group, value, label, pressed, disabled) => `<button class="app-chip app-control" type="button" data-chip="${esc(group)}" data-value="${esc(value)}" aria-pressed="${pressed ? 'true' : 'false'}"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;
const chips = (id, label, note, group, options, pressed, { disabled = false, hidden = false } = {}) =>
  `<div class="app-field" data-width="full" role="group" aria-labelledby="${id}" data-chip-field="${esc(group)}"${hidden ? ' hidden' : ''}><label id="${id}">${esc(label)}${note ? ` <span>${esc(note)}</span>` : ''}</label><div class="app-chip-group">${options.map(([value, text]) => chip(group, value, text, pressed.includes(value), disabled)).join('')}</div></div>`;

/* datetime-local speaks the device's local time, without a zone. */
const toLocal = iso => {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

/* The RPCs' error vocabulary, in the sender's words. */
function explain(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('admin access required')) return 'Only employees who send broadcasts can make this change.';
  if (message.includes('invalid broadcast input')) return 'A title and message in English, a category and a priority are needed.';
  if (message.includes('broadcast has no audience') || message.includes('shape_check')) return 'Choose who receives this: everyone, or at least one department or role.';
  if (message.includes('broadcast is not editable') || message.includes('immutable') || message.includes('may only remain published')) return 'A published or revoked broadcast can\'t be edited. Compose a new one instead.';
  if (message.includes('broadcast not found')) return 'That broadcast no longer exists. Refresh the list.';
  if (message.includes('future publish_at')) return 'A scheduled time has to be in the future.';
  return 'The change didn\'t save. Try again.';
}

export async function mountBroadcast(stack, { manifest, signal }) {
  let alive = true, dialog = null, broadcasts = [], departments = [], groups = [];

  stack.innerHTML = `
    <div class="app-utility-row"><span class="app-utility-note" data-broadcast-count></span><button class="app-utility-action" type="button" data-broadcast-new>New broadcast</button></div>
    <div data-broadcast-list><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div><div class="app-skeleton-line"></div></div></div></div>`;
  const list = stack.querySelector('[data-broadcast-list]'), count = stack.querySelector('[data-broadcast-count]');

  const departmentName = id => departments.find(d => d.id === id)?.name || 'a department';
  const groupName = id => groups.find(g => g.id === id)?.name || 'a group';
  function audience(targets) {
    const t = targets || [];
    if (!t.length) return 'No audience yet';
    if (t.some(x => x.type === 'everyone')) return 'Everyone';
    const parts = [
      ...t.filter(x => x.type === 'department').map(x => departmentName(x.departmentId)),
      ...t.filter(x => x.type === 'role').map(x => ROLE_LABEL[x.role] || x.role),
      ...t.filter(x => x.type === 'group').map(x => groupName(x.groupId))
    ];
    const people = t.filter(x => x.type === 'employee').length;
    if (people) parts.push(`${people} employee${people === 1 ? '' : 's'}`);
    return parts.join(', ');
  }
  const when = b => b.status === 'published' ? formatDateTime(b.publishAt) : b.status === 'scheduled' ? `Scheduled for ${formatDateTime(b.publishAt)}` : b.status === 'revoked' ? `Revoked ${formatDateTime(b.revokedAt)}` : `Edited ${formatDateTime(b.updatedAt)}`;

  function paintList() {
    if (!alive) return;
    const live = broadcasts.filter(b => b.status === 'published').length;
    count.textContent = broadcasts.length ? `${broadcasts.length} broadcast${broadcasts.length === 1 ? '' : 's'} · ${live} live` : '';
    if (!broadcasts.length) { list.innerHTML = state('Broadcast', 'No broadcasts yet', 'Compose the first message to every employee or a department.'); return; }
    list.innerHTML = `<div class="app-card app-surface"><div class="app-list">${broadcasts.map(b => {
      const [word, tone] = STATUS[b.status] || [b.status, 'quiet'];
      return `<button class="app-list-row" type="button" data-broadcast-open="${esc(b.id)}">
        <span class="app-list-row-main"><span class="app-list-row-title">${esc(b.titleEn)}</span><span class="app-list-row-meta">${esc([categoryLabel(b.category), b.priority !== 'normal' ? priorityLabel(b.priority) : '', audience(b.targets), when(b), b.status === 'published' ? `${b.readCount ?? 0} read` : ''].filter(Boolean).join(' · '))}</span></span>
        <span class="app-list-row-end">${b.pinned && b.status !== 'revoked' ? '<span class="app-badge" data-tone="quiet">Pinned</span>' : ''}<span class="app-badge"${tone ? ` data-tone="${tone}"` : ''}>${word}</span></span>
      </button>`; }).join('')}</div></div>`;
  }

  async function load() {
    try {
      const result = await supabaseRpc('sindhorn_broadcast_list_admin_v1', {});
      if (!result?.ok) throw new Error(result?.error || 'broadcast_unavailable');
      broadcasts = result.broadcasts || []; departments = result.departments || []; groups = result.groups || [];
      paintList();
    } catch (error) {
      if (alive) list.innerHTML = state('Error', 'Couldn\'t load broadcasts', explain(error), 'error') + '<div class="app-utility-row"><button class="app-utility-action" type="button" data-broadcast-retry>Try again</button></div>';
    }
  }

  const closeDialog = () => { if (dialog) dialog.close(''); };
  const open = markup => { closeDialog(); dialog = openDialog(markup, { onClose: () => { dialog = null; } }); return dialog; };

  /* Compose or edit. A draft or a scheduled broadcast is editable; a
     published one is read to the end and can only be revoked; a revoked one
     is read only. */
  function editor(b) {
    const isNew = !b, editable = isNew || b.status === 'draft' || b.status === 'scheduled', ro = !editable;
    const targets = b?.targets || [];
    const mode = !targets.length || targets.some(t => t.type === 'everyone') ? 'everyone' : targets.some(t => t.type === 'department') ? 'department' : targets.some(t => t.type === 'role') ? 'role' : 'group';
    const modes = [['everyone', 'Everyone'], ['department', 'Departments'], ['role', 'Roles'], ...(groups.length ? [['group', 'Groups']] : [])];
    const [word] = STATUS[b?.status] || ['Draft'];
    const d = open(`<form class="app-dialog-body" data-broadcast-form novalidate>
        ${dialogHead('Settings › Broadcast', isNew ? 'New broadcast' : editable ? 'Edit broadcast' : word)}
        <div class="app-dialog-grid">
          ${field('bc-title-en', 'title_en', 'Title', b?.titleEn, { note: 'English', required: true, disabled: ro })}
          ${area('bc-body-en', 'body_en', 'Message', b?.bodyEn, { note: 'English', required: true, disabled: ro })}
          ${field('bc-title-th', 'title_th', 'Title', b?.titleTh, { note: 'Thai · optional', disabled: ro })}
          ${area('bc-body-th', 'body_th', 'Message', b?.bodyTh, { note: 'Thai · optional', disabled: ro })}
          ${appSelect({ kind: 'category', label: 'Category', options: categoryOptions(), selected: b?.category || 'hotel_news', disabled: ro })}
          ${appSelect({ kind: 'priority', label: 'Priority', options: priorityOptions(), selected: b?.priority || 'normal', disabled: ro })}
          <div class="app-dialog-section"><span>Audience</span><small>Who sees this in Messages. Everyone, or the departments or roles you choose.</small></div>
          ${chips('bc-aud', 'Send to', '', 'mode', modes, [mode], { disabled: ro })}
          ${chips('bc-dep', 'Departments', 'choose any', 'department', departments.map(x => [x.id, x.name]), targets.filter(t => t.type === 'department').map(t => t.departmentId), { disabled: ro, hidden: mode !== 'department' })}
          ${chips('bc-role', 'Roles', 'choose any', 'role', ROLES, targets.filter(t => t.type === 'role').map(t => t.role), { disabled: ro, hidden: mode !== 'role' })}
          ${groups.length ? chips('bc-group', 'Groups', 'choose any', 'group', groups.map(x => [x.id, x.name]), targets.filter(t => t.type === 'group').map(t => t.groupId), { disabled: ro, hidden: mode !== 'group' }) : ''}
          <div class="app-dialog-section"><span>Options</span></div>
          <div data-width="full">${check('pinned', 'Pin to the top of Messages', Boolean(b?.pinned), ro)}</div>
          <div data-width="full">${check('sensitive', 'Sensitive - the text shows only after the message is opened', Boolean(b?.sensitive), ro)}</div>
          <div class="app-dialog-section"><span>Timing</span><small>${editable ? 'Leave the time empty and publish by hand, or set a time and save to schedule it. Hotel time.' : 'Hotel time.'}</small></div>
          ${field('bc-publish', 'publish_at', b?.status === 'published' ? 'Published' : 'Publish at', toLocal(b?.publishAt), { type: 'datetime-local', note: editable ? 'optional' : '', disabled: ro })}
          ${field('bc-expires', 'expires_at', 'Remove after', toLocal(b?.expiresAt), { type: 'datetime-local', note: editable ? 'optional' : '', disabled: ro })}
        </div>
        <p class="app-dialog-status" data-dialog-status role="status" aria-live="polite">${b?.status === 'published' ? esc(`${b.readCount ?? 0} read · ${audience(targets)}`) : ''}</p>
        <div class="app-dialog-actions app-dialog-actions-split">
          ${editable ? '<button class="app-utility-action" type="button" data-broadcast-publish>Publish now</button>' : b.status === 'published' ? '<button class="app-utility-action" type="button" data-tone="danger" data-broadcast-revoke>Revoke</button>' : '<span></span>'}
          <div class="app-row"><button class="app-utility-action" type="button" data-dialog-close>${editable ? 'Cancel' : 'Close'}</button>${editable ? '<button class="app-primary app-control" type="submit" data-broadcast-save>Save</button>' : ''}</div>
        </div>
      </form>`);
    const form = d.querySelector('[data-broadcast-form]');
    bindAppSelects(form, { signal });
    form.addEventListener('click', event => {
      const pressed = event.target.closest('[data-chip]'); if (!pressed || pressed.disabled) return;
      const group = pressed.dataset.chip, on = pressed.getAttribute('aria-pressed') === 'true';
      if (group === 'mode') {
        if (on) return;
        form.querySelectorAll('[data-chip="mode"]').forEach(c => c.setAttribute('aria-pressed', String(c === pressed)));
        form.querySelectorAll('[data-chip-field]').forEach(f => { if (f.dataset.chipField !== 'mode') f.hidden = f.dataset.chipField !== pressed.dataset.value; });
      } else pressed.setAttribute('aria-pressed', String(!on));
    });
    /* A correction clears the last complaint; the next save judges afresh. */
    if (editable) {
      const clear = () => { form.querySelector('[data-dialog-status]').textContent = ''; };
      form.addEventListener('input', clear);
      form.addEventListener('click', event => { if (event.target.closest('[data-chip]')) clear(); });
    }
    form.addEventListener('submit', event => { event.preventDefault(); save(form, b); });
    form.querySelector('[data-broadcast-publish]')?.addEventListener('click', () => publish(form, b));
    form.querySelector('[data-broadcast-revoke]')?.addEventListener('click', () => revoke(form, b));
    if (editable) form.querySelector('#bc-title-en')?.focus();
  }

  /* What the form says, in the RPC's words. Null when it is not ready. */
  function collect(form) {
    const status = form.querySelector('[data-dialog-status]');
    const value = name => form.elements[name]?.value.trim() || '';
    const chosen = group => [...form.querySelectorAll(`[data-chip="${group}"][aria-pressed="true"]`)].map(c => c.dataset.value);
    const mode = chosen('mode')[0] || 'everyone';
    const targets = mode === 'everyone' ? [{ type: 'everyone' }]
      : mode === 'department' ? chosen('department').map(departmentId => ({ type: 'department', departmentId }))
      : mode === 'role' ? chosen('role').map(role => ({ type: 'role', role }))
      : chosen('group').map(groupId => ({ type: 'group', groupId }));
    const fail = text => { status.dataset.tone = 'error'; status.textContent = text; return null; };
    if (!value('title_en') || !value('body_en')) return fail('A title and message in English are needed.');
    if (!targets.length) return fail('Choose at least one department, role or group, or send to everyone.');
    const publishAt = fromLocal(value('publish_at')), expiresAt = fromLocal(value('expires_at'));
    if (value('publish_at') && !publishAt) return fail('Check the publish time.');
    if (publishAt && Date.parse(publishAt) <= Date.now()) return fail('A scheduled time has to be in the future - or leave it empty and publish by hand.');
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) return fail('The removal time has to be in the future.');
    return {
      p_title_en: value('title_en'), p_title_th: value('title_th') || null, p_body_en: value('body_en'), p_body_th: value('body_th') || null,
      p_category: appSelectValue(form, 'category'), p_priority: appSelectValue(form, 'priority'),
      p_sensitive: form.elements.sensitive.checked, p_pinned: form.elements.pinned.checked, p_push_enabled: true,
      p_publish_at: publishAt, p_expires_at: expiresAt, p_targets: targets,
      audience: audience(targets)
    };
  }

  async function persist(form, b, params) {
    const { audience: _, ...rpc } = params;
    const result = await supabaseRpc('sindhorn_broadcast_save_v1', { p_id: b?.id || null, ...rpc });
    if (!result?.ok || !result.id) throw new Error(result?.error || 'save_failed');
    return result;
  }

  async function save(form, b) {
    const status = form.querySelector('[data-dialog-status]'), buttons = form.querySelectorAll('[data-broadcast-save],[data-broadcast-publish]');
    const params = collect(form); if (!params) return;
    buttons.forEach(x => { x.disabled = true; }); status.dataset.tone = ''; status.textContent = 'Saving…';
    try {
      const result = await persist(form, b, params);
      if (!alive) return;
      closeDialog();
      showToast(result.status === 'scheduled' ? `Scheduled for ${formatDateTime(params.p_publish_at)}` : 'Draft saved');
      await load();
    } catch (error) {
      status.dataset.tone = 'error'; status.textContent = explain(error); buttons.forEach(x => { x.disabled = false; });
    }
  }

  /* Publish saves what the form says first, so what goes out is what is on
     screen, then asks, then publishes. A time in the form is set aside:
     publishing now means now. */
  async function publish(form, b) {
    const status = form.querySelector('[data-dialog-status]'), buttons = form.querySelectorAll('[data-broadcast-save],[data-broadcast-publish]');
    const params = collect(form); if (!params) return;
    const yes = await confirmDialog({ kicker: 'Settings › Broadcast', title: `Publish to ${params.audience}?`, copy: `"${params.p_title_en}" appears in Messages for everyone in the audience right away${params.p_publish_at ? ', instead of at the scheduled time' : ''}.`, confirm: 'Publish', cancel: 'Not yet' });
    if (!yes || !alive) return;
    buttons.forEach(x => { x.disabled = true; }); status.dataset.tone = ''; status.textContent = 'Publishing…';
    try {
      const saved = await persist(form, b, params);
      const result = await supabaseRpc('sindhorn_broadcast_publish_v1', { p_id: saved.id });
      if (!result?.ok) throw new Error(result?.error || 'publish_failed');
      if (!alive) return;
      closeDialog();
      showToast(`Published to ${params.audience}`);
      await load();
    } catch (error) {
      status.dataset.tone = 'error'; status.textContent = explain(error); buttons.forEach(x => { x.disabled = false; });
    }
  }

  async function revoke(form, b) {
    const yes = await confirmDialog({ kicker: 'Settings › Broadcast', title: `Revoke "${b.titleEn}"?`, copy: 'It disappears from Messages for everyone and can\'t be edited or published again.', confirm: 'Revoke', cancel: 'Keep it', tone: 'danger' });
    if (!yes || !alive) return;
    const status = form.querySelector('[data-dialog-status]'), button = form.querySelector('[data-broadcast-revoke]');
    if (button) button.disabled = true; status.dataset.tone = ''; status.textContent = 'Revoking…';
    try {
      const result = await supabaseRpc('sindhorn_broadcast_revoke_v1', { p_id: b.id });
      if (!result?.ok) throw new Error(result?.error || 'revoke_failed');
      if (!alive) return;
      closeDialog();
      showToast('Broadcast revoked');
      await load();
    } catch (error) {
      status.dataset.tone = 'error'; status.textContent = explain(error); if (button) button.disabled = false;
    }
  }

  stack.addEventListener('click', event => {
    if (event.target.closest('[data-broadcast-new]')) { editor(null); return; }
    if (event.target.closest('[data-broadcast-retry]')) { load(); return; }
    const row = event.target.closest('[data-broadcast-open]');
    if (row) editor(broadcasts.find(b => b.id === row.dataset.broadcastOpen) || null);
  }, { signal });

  await load();
  return () => { alive = false; closeDialog(); };
}
