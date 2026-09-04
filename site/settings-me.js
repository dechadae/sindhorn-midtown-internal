/* Settings › Me: the employee's own facts and their digital business card.

   The frame (settings-page.js) paints the hero and decides the tab may be
   seen; this module fills the stack. The facts come from the settings
   manifest the frame already loaded. The business card comes from the same
   RPCs the live app uses - sindhorn_business_card_self to read,
   sindhorn_business_card_update_self to save - so the two apps agree on
   what the public page at /<slug> shows.

   Everything here is library: the card is .app-card around
   .app-business-card, the QR is an .app-figure, the details are a text
   metric grid, editing is the dialog standard with option checks, "Copied"
   is the toast asked from code. */
import { getState, supabaseRpc } from './auth-client.js';
import { hasCapability } from './capabilities.js';
import { businessCardUrl, primaryPhone } from './business-card-core.js';
import { qrStyledSvg } from './qr-v6.js';
import { showToast } from './app-toast.js';
import { openDialog, dialogHead } from './app-dialog.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const HOTEL_NAME = 'Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
const HOTEL_LOGO = '/assets/brand/sindhorn-midtown-vignette-white.png';
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
const telHref = value => { const raw = String(value || '').trim(); return raw ? `tel:${raw.startsWith('+') ? '+' : ''}${raw.replace(/\D/g, '')}` : ''; };
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; } };

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

/* What the public page would print for this card right now: a hidden field
   is simply absent, exactly as the public RPC leaves it out. */
function publicView(data) {
  const card = data.card || {}, hotel = data.hotel || {}, vis = card.fieldVisibility || {};
  const shown = key => vis[key] !== false;
  return {
    slug: card.publicSlug || '',
    displayName: card.displayName || '',
    positionTitle: shown('positionTitle') ? card.positionTitle : null,
    workEmail: shown('workEmail') ? card.workEmail : null,
    businessMobile: shown('businessMobile') ? card.businessMobile : null,
    directPhone: shown('directPhone') ? card.directPhone : null,
    hotelName: hotel.hotelName || HOTEL_NAME,
    hotelMainPhone: shown('hotelPhone') ? hotel.hotelMainPhone : null,
    hotelAddress: shown('hotelAddress') ? hotel.hotelAddress : null,
    hotelWebsite: shown('hotelWebsite') ? hotel.hotelWebsite : null,
    hotelLogo: /^\/assets\/brand\/[a-z0-9._-]+$/i.test(hotel.hotelLogoPath || '') ? hotel.hotelLogoPath : HOTEL_LOGO,
    published: card.published === true
  };
}

function detail(label, value, href = '', text = value) {
  if (!value) return '';
  return `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${href ? `<a href="${esc(href)}">${esc(text)}</a>` : esc(text)}</span></div>`;
}

/* The card body, shared by the page and the presenting dialog. */
export function businessCardMarkup(view, { url, qr = true, actions = '' } = {}) {
  let figure = '';
  if (qr && view.published && url) {
    try { figure = `<figure class="app-figure" data-card-qr>${qrStyledSvg(url)}</figure>`; } catch (_) { figure = ''; }
  }
  const details = [
    detail('Work email', view.workEmail, view.workEmail ? `mailto:${encodeURIComponent(view.workEmail)}` : ''),
    detail('Business mobile', view.businessMobile, telHref(view.businessMobile)),
    detail('Direct phone', view.directPhone, telHref(view.directPhone)),
    detail('Hotel telephone', view.hotelMainPhone, telHref(view.hotelMainPhone)),
    detail('Hotel address', view.hotelAddress),
    detail('Hotel website', view.hotelWebsite, view.hotelWebsite, hostOf(view.hotelWebsite))
  ].join('');
  return `<div class="app-business-card">
      <div>
        <p class="app-business-card-kicker">Digital business card</p>
        <h2 class="app-business-card-name">${esc(view.displayName)}</h2>
        ${view.positionTitle ? `<p class="app-business-card-position">${esc(view.positionTitle)}</p>` : ''}
        <p class="app-business-card-hotel">${esc(view.hotelName)}</p>
      </div>
      ${figure}
      <img class="app-business-card-logo" src="${esc(view.hotelLogo)}" alt="">
      ${details ? `<div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${details}</div>` : ''}
      ${actions}
      ${url ? `<p class="app-business-card-link">${view.published ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a>` : 'Unpublished — the link and QR are off until you publish the card.'}</p>` : ''}
    </div>`;
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch (_) { return false; }
}

export async function mountMe(stack, { manifest, signal }) {
  let alive = true, data = null, dialog = null;
  const canRead = hasCapability('business_card.read', manifest);
  const canManage = hasCapability('business_card.manage_self', manifest);
  const cardHost = document.createElement('div');
  cardHost.dataset.businessCard = '';
  stack.insertAdjacentHTML('beforeend', factsMarkup(manifest));
  if (!canRead) return () => {};
  stack.append(cardHost);
  cardHost.innerHTML = `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line" data-size="square"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;

  const url = () => data?.card?.publicSlug ? businessCardUrl(location.origin, data.card.publicSlug) : '';
  const share = async () => {
    const view = publicView(data);
    if (!view.published) { showToast('Publish the card before sharing.'); return; }
    const payload = { title: `${view.displayName} | ${view.hotelName}`, text: [view.displayName, view.positionTitle, view.hotelName].filter(Boolean).join(' · '), url: url() };
    if (typeof navigator.share === 'function') { try { await navigator.share(payload); return; } catch (error) { if (error?.name === 'AbortError') return; } }
    showToast(await copyText(payload.url) ? 'Link copied' : 'Could not copy the link');
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
        <div class="app-stack">${businessCardMarkup({ ...view, workEmail: null, businessMobile: null, directPhone: null, hotelMainPhone: null, hotelAddress: null, hotelWebsite: null }, { url: url() })}</div>
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
          <div class="app-dialog-section"><span>Shown on the public card</span><small>Untick a line to leave it off the public page and the saved contact.</small></div>
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
      status.textContent = message.includes('invalid business mobile') ? 'Use an international business mobile such as +66…' : 'The card could not be saved. Try again.';
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
    if (alive) cardHost.innerHTML = state('Business card', 'Your business card is not available right now.', 'Check the connection and open Me again.', 'error');
  }

  return () => { alive = false; closeDialog(); };
}
