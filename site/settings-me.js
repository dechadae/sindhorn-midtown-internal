/* Settings › Me: the employee's own facts and their digital business card.

   The frame (settings-page.js) paints the hero and decides the tab may be
   seen; this module fills the stack. The facts come from the settings
   manifest the frame already loaded. The business card comes from the same
   RPCs the live app uses - sindhorn_business_card_self to read,
   sindhorn_business_card_update_self to save - so the two apps agree on
   what the public page at /<slug> shows.

   Everything here is library: the card body is business-card-page.js
   (the same markup the public page renders), editing is the dialog
   standard with option checks, "Copied" is the toast asked from code. Notifications are one list row with a badge
   for the state and a utility action to change it (push-client.js does the
   work); a subscription belongs to the phone, so the card says so. */
import { getState, supabaseRpc } from './auth-client.js';
import { pushStatus, enablePush, disablePush } from './push-client.js';
import { hasCapability } from './capabilities.js';
import { businessCardUrl } from './business-card-core.js';
import { businessCardMarkup, publicView, shareCard } from './business-card-page.js';
import { showToast } from './app-toast.js';
import { openDialog, dialogHead } from './app-dialog.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Admin', manager: 'Manager', supervisor: 'Supervisor', editor: 'Editor', employee: 'Employee' };
const LANGUAGE_LABEL = { en: 'English', th: 'Thai' };

/* The fields the employee may show or hide on the public card, in the order
   the public page prints them. */
const VISIBLE_FIELDS = [
  ['positionTitle', 'Position title', 'p_show_position_title'],
  ['workEmail', 'Work email', 'p_show_work_email'],
  ['businessMobile', 'Business mobile', 'p_show_business_mobile'],
  ['directPhone', 'Direct phone', 'p_show_direct_phone'],
  ['hotelPhone', 'Hotel telephone', 'p_show_hotel_phone'],
  ['hotelAddress', 'Hotel address', 'p_show_hotel_address'],
  ['hotelWebsite', 'Hotel website', 'p_show_hotel_website']
];

const fact = (label, value) => `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value || '—')}</span></div>`;
const state = (label, title, copy, tone = 'empty') => `<div class="app-state app-card" data-tone="${tone}"><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const check = (name, label, checked) => `<label class="app-check" data-mode="option"><input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}><span class="app-check-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg></span><span class="app-check-label">${esc(label)}</span></label>`;

export function factsMarkup(manifest) {
  const p = manifest.profile || {}, auth = getState().profile || {};
  return `<div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">Account</p>
        <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">
          ${fact('Name', p.displayName || auth.display_name)}${fact('Employee ID', p.employeeNumber || auth.employee_number)}
          ${fact('Position', p.positionTitle)}${fact('Department', p.departmentName)}
          ${fact('Role', ROLE_LABEL[p.role] || p.role)}${fact('Language', LANGUAGE_LABEL[p.preferredLanguage] || p.preferredLanguage)}
        </div>
      </div>
    </div>`;
}

/* Notifications on this phone. The browser answers pushStatus() without a
   network round trip, so the row paints its true state at once; enabling is
   the one moment permission is asked, and it happens from the tap. */
const PUSH_COPY = {
  unconfigured: ['Not available', 'The notification service is not configured yet.', 'quiet'],
  unsupported: ['Not available', 'This browser can\'t receive push notifications. Install the app to your home screen if your phone requires it.', 'quiet'],
  blocked: ['Blocked', 'Notifications are turned off for this app in the phone or browser settings.', 'danger'],
  off: ['Off', 'Weather, air-quality, business and broadcast alerts arrive here when this is on.', 'quiet'],
  on: ['On', 'Weather, air-quality, business and broadcast alerts reach this phone.', '']
};
function notificationsMarkup(status, note = '') {
  const key = status.support !== 'ready' ? status.support : status.enabled ? 'on' : 'off';
  const [label, copy, tone] = PUSH_COPY[key];
  const action = status.support === 'ready' ? `<div class="app-utility-row">${note ? `<span class="app-utility-note">${esc(note)}</span>` : ''}<button class="app-utility-action" type="button" data-push-toggle${status.busy ? ' disabled' : ''}>${status.enabled ? 'Turn off' : 'Turn on'}</button></div>` : '';
  return `<div class="app-card-section"><p class="app-surface-label">Notifications on this phone</p>
      <div class="app-list"><div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Device alerts</span><span class="app-list-row-meta">${esc(copy)}</span></span><span class="app-list-row-end"><span class="app-badge"${tone ? ` data-tone="${tone}"` : ''}>${esc(label)}</span></span></div></div>
      ${action}
    </div>`;
}

export async function mountMe(stack, { manifest, signal }) {
  let alive = true, data = null, dialog = null;
  const canRead = hasCapability('business_card.read', manifest);
  const canManage = hasCapability('business_card.manage_self', manifest);
  const cardHost = document.createElement('div');
  cardHost.dataset.businessCard = '';
  stack.insertAdjacentHTML('beforeend', factsMarkup(manifest));
  const pushHost = document.createElement('div');
  pushHost.className = 'app-card app-surface';
  pushHost.dataset.notifications = '';
  stack.append(pushHost);
  const paintPush = (status, note) => { if (alive) pushHost.innerHTML = notificationsMarkup(status, note); };
  pushStatus().then(status => paintPush(status)).catch(() => paintPush({ support: 'unsupported', enabled: false, busy: false }));
  async function togglePush() {
    const before = await pushStatus();
    paintPush({ ...before, busy: true }, before.enabled ? 'Turning off…' : 'Waiting for permission…');
    try {
      const after = before.enabled ? await disablePush() : await enablePush();
      paintPush(after);
      showToast(after.enabled ? 'Notifications on' : 'Notifications off');
    } catch (error) {
      console.warn('Push toggle failed', error);
      const after = await pushStatus().catch(() => before);
      paintPush(after, after.support === 'blocked' ? '' : 'Couldn\'t change notifications. Try again.');
    }
  }
  stack.addEventListener('click', event => { if (event.target.closest('[data-push-toggle]')) togglePush(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pushStatus().then(status => paintPush(status)).catch(() => {}); }, { signal });
  if (!canRead) return () => { alive = false; };
  stack.append(cardHost);
  cardHost.innerHTML = `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line" data-size="square"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;

  const url = () => data?.card?.publicSlug ? businessCardUrl(location.origin, data.card.publicSlug) : '';
  const share = () => {
    const view = publicView(data);
    if (!view.published) { showToast('Publish the card before sharing'); return; }
    return shareCard(view, url());
  };

  function paint() {
    if (!alive) return;
    const view = publicView(data);
    const actions = `<div class="app-utility-row">
        <button class="app-utility-action" type="button" data-card-present${view.published ? '' : ' disabled'}>Present QR</button>
        <button class="app-utility-action" type="button" data-card-share${view.published ? '' : ' disabled'}>Share</button>
        ${canManage ? '<button class="app-utility-action" type="button" data-card-edit>Edit card</button>' : ''}
      </div>`;
    cardHost.innerHTML = `<div class="app-card app-surface">${businessCardMarkup(view, { url: url(), qr: true, actions })}</div>`;
  }

  const closeDialog = () => { if (dialog) dialog.close(''); };
  const open = markup => { closeDialog(); dialog = openDialog(markup, { onClose: () => { dialog = null; } }); return dialog; };

  function present() {
    const view = publicView(data);
    if (!view.published) return;
    open(`<div class="app-dialog-body">
        ${dialogHead('Settings › Me', 'Scan to save')}
        <div class="app-stack">${businessCardMarkup(view, { url: url() })}</div>
        <div class="app-dialog-actions"><button class="app-utility-action" type="button" data-card-share>Share</button><button class="app-primary app-control" type="button" data-dialog-close>Done</button></div>
      </div>`);
  }

  function edit() {
    const card = data.card || {}, vis = card.fieldVisibility || {};
    const d = open(`<form class="app-dialog-body" data-card-form>
        ${dialogHead('Settings › Me', 'Edit card')}
        <p class="app-dialog-copy">Your name, position and work email come from your employee record; the numbers and what the public card shows are yours to set.</p>
        <div class="app-dialog-grid">
          <div class="app-field"><label for="card-mobile">Business mobile <span>optional · +66…</span></label><input id="card-mobile" name="mobile" type="tel" inputmode="tel" maxlength="16" autocomplete="off" value="${esc(card.businessMobile || '')}"></div>
          <div class="app-field"><label for="card-direct">Direct phone <span>optional</span></label><input id="card-direct" name="direct" type="tel" inputmode="tel" maxlength="64" autocomplete="off" value="${esc(card.directPhone || '')}"></div>
          <div data-span="full">${check('published', 'Publish the card at its public link', card.published === true)}</div>
          <div class="app-dialog-section"><span>Shown on the public card</span><small>Uncheck a line to leave it off the public page and the saved contact.</small></div>
          ${VISIBLE_FIELDS.map(([key, label]) => `<div>${check(key, label, vis[key] !== false)}</div>`).join('')}
        </div>
        <p class="app-dialog-status" data-dialog-status role="status" aria-live="polite"></p>
        <div class="app-dialog-actions"><button class="app-utility-action" type="button" data-dialog-close>Cancel</button><button class="app-primary app-control" type="submit" data-card-save>Save</button></div>
      </form>`);
    d.querySelector('[data-card-form]').addEventListener('submit', save);
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget, status = form.querySelector('[data-dialog-status]'), button = form.querySelector('[data-card-save]');
    const on = name => form.elements[name]?.checked === true;
    const params = {
      p_business_mobile_e164: form.elements.mobile.value.trim() || null,
      p_direct_phone: form.elements.direct.value.trim() || null,
      p_published: on('published')
    };
    for (const [key, , param] of VISIBLE_FIELDS) params[param] = on(key);
    button.disabled = true; status.dataset.tone = ''; status.textContent = 'Saving…';
    try {
      const result = await supabaseRpc('sindhorn_business_card_update_self', params);
      if (!result?.card) throw new Error('business_card_unavailable');
      data = result;
      if (!alive) return;
      closeDialog(); paint(); showToast('Business card updated');
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      status.dataset.tone = 'error';
      status.textContent = message.includes('invalid business mobile') ? 'Use an international business mobile such as +66…' : 'The card didn\'t save. Try again.';
      button.disabled = false;
    }
  }

  stack.addEventListener('click', event => {
    if (event.target.closest('[data-card-present]')) present();
    else if (event.target.closest('[data-card-share]')) share();
    else if (event.target.closest('[data-card-edit]')) edit();
  }, { signal });
  document.addEventListener('click', event => {
    if (dialog && dialog.contains(event.target) && event.target.closest('[data-card-share]')) share();
  }, { signal });

  try {
    const result = await supabaseRpc('sindhorn_business_card_self', {});
    if (!result?.card?.publicSlug) throw new Error('business_card_unavailable');
    data = result;
    paint();
  } catch (_) {
    if (alive) cardHost.innerHTML = state('Business card', 'Couldn\'t load your business card', 'Check the connection and open Me again.', 'error');
  }

  return () => { alive = false; closeDialog(); };
}
