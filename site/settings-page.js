/* Settings, rebuilt on the UI Library. Four tabs - Me, Admin, Broadcast,
   System - that the navbar shows in place of the app's four while the
   account chip is open. Every tab is visible to every employee; what a tab
   holds depends on the capabilities the settings manifest grants, and a
   tab the account cannot use says so in an ordinary state card rather than
   disappearing. This release lays the frame and fills Me and System; Admin
   and Broadcast arrive with their own data work. */
import { getState, signOut } from './auth-client.js';
import { loadSettingsAuthority, hasCapability } from './capabilities.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

const TABS = {
  me: { eyebrow: 'Settings', title: 'Me', copy: 'Your account and how you appear to colleagues.', capability: 'account.read', gate: 'Your account', gateTitle: 'This account cannot read its own profile yet.', gateCopy: 'Ask People & Culture to check your access.' },
  admin: { eyebrow: 'Settings', title: 'Admin', copy: 'Employees, access and one-time codes.', capability: 'people.read', gate: 'Admin only', gateTitle: 'This tab is only for admins.', gateCopy: 'Ask People & Culture if you need access.' },
  broadcast: { eyebrow: 'Settings', title: 'Broadcast', copy: 'Messages sent to every employee or a department.', capability: 'broadcasts.manage', gate: 'Broadcast only', gateTitle: 'This tab is only for employees who send broadcasts.', gateCopy: 'Ask People & Culture if you need access.' },
  system: { eyebrow: 'Settings', title: 'System', copy: 'The app itself: version, library and diagnostics.', capability: 'system.manage', gate: 'System only', gateTitle: 'This tab is only for system administrators.', gateCopy: '' }
};
const tabOf = () => { const tab = (location.hash.match(/^#settings\/([a-z]+)/) || [])[1]; return TABS[tab] ? tab : 'me'; };

const hero = tab => `<header class="app-hero"><p class="app-hero-eyebrow">${esc(TABS[tab].eyebrow)}</p><h1 class="app-hero-title">${esc(TABS[tab].title)}</h1><p class="app-hero-copy">${esc(TABS[tab].copy)}</p></header>`;
const state = (label, title, copy, tone = 'empty', attrs = '') => `<div class="app-state app-card" data-tone="${tone}"${attrs}><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const fact = (label, value) => `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value || '—')}</span></div>`;
const skeleton = () => `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;

const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Admin', editor: 'Editor', employee: 'Employee' };
const LANGUAGE_LABEL = { en: 'English', th: 'Thai' };

function meMarkup(manifest) {
  const p = manifest.profile || {}, auth = getState().profile || {};
  return `<div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">Account</p>
        <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">
          ${fact('Name', p.displayName || auth.display_name)}${fact('Employee ID', p.employeeNumber || auth.employee_number)}
          ${fact('Position', p.positionTitle)}${fact('Department', p.departmentName)}
          ${fact('Role', ROLE_LABEL[p.role] || p.role)}${fact('Language', LANGUAGE_LABEL[p.preferredLanguage] || p.preferredLanguage)}
        </div>
      </div>
    </div>
    ${state('Coming next', 'Your digital business card', 'Edit how you appear, then share your card as a QR code or a link.')}
    <div class="app-utility-row"><button class="app-utility-action" type="button" data-settings-signout>Sign out</button></div>`;
}

function systemMarkup(manifest, version) {
  const library = hasCapability('developer.ui_library', manifest) || hasCapability('system.manage', manifest);
  return `<div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">This app</p>
        <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${fact('Version', version)}${fact('Display', matchMedia('(display-mode: standalone)').matches ? 'Installed' : 'Browser')}</div>
      </div>
    </div>
    ${library ? `<article class="app-action-card"><button class="app-action-card-button" type="button" data-settings-go="#ci">
      <span class="app-action-card-head"><span class="app-action-card-status">Developer</span></span>
      <span class="app-action-card-title">UI Library</span>
      <span class="app-action-card-copy">Every component the app is built from, with its material and motion demonstrated live.</span>
      <span class="app-action-card-foot"><span>/ci</span>${CHEVRON}</span>
    </button></article>` : ''}`;
}

async function appVersion() {
  try {
    const text = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    return (text.match(/VERSION\s*=\s*'([^']+)'/) || [])[1]?.replace(/^sindhorn-midtown-internal-pwa-/, '') || '—';
  } catch (_) { return '—'; }
}

export async function mountSettings(host) {
  let alive = true, tab = tabOf();
  const controller = new AbortController();
  const { signal } = controller;

  const paint = body => { if (alive) host.innerHTML = `${hero(tab)}<section class="app-section"><div class="app-stack">${body}</div></section>`; };

  async function render() {
    tab = tabOf();
    paint(skeleton());
    let manifest;
    try { manifest = await loadSettingsAuthority(); }
    catch (error) {
      if (!alive) return;
      paint(state('Error', 'Settings could not be loaded.', 'Check the connection and try again.', 'error') + `<div class="app-utility-row"><button class="app-utility-action" type="button" data-settings-retry>Try again</button></div>`);
      return;
    }
    if (!alive || tab !== tabOf()) return;
    const spec = TABS[tab];
    if (!hasCapability(spec.capability, manifest)) { paint(state(spec.gate, spec.gateTitle, spec.gateCopy, 'empty', ` data-gate="${esc(spec.capability)}"`) + (tab === 'me' ? `<div class="app-utility-row"><button class="app-utility-action" type="button" data-settings-signout>Sign out</button></div>` : '')); return; }
    if (tab === 'me') paint(meMarkup(manifest));
    else if (tab === 'admin') paint(state('Coming next', 'Employees, access and codes', 'Add, edit and remove employees and issue one-time codes - this tab fills in the next release.'));
    else if (tab === 'broadcast') paint(state('Coming next', 'Broadcast messages', 'Compose and publish messages to every employee or a department - this tab arrives with its data work.'));
    else paint(systemMarkup(manifest, await appVersion()));
  }

  host.addEventListener('click', event => {
    const go = event.target.closest('[data-settings-go]');
    if (go) { location.hash = go.dataset.settingsGo; return; }
    if (event.target.closest('[data-settings-retry]')) { render(); return; }
    const out = event.target.closest('[data-settings-signout]');
    if (out) { out.disabled = true; signOut().catch(() => { out.disabled = false; }); }
  }, { signal });
  addEventListener('hashchange', () => { if (/^#settings(\/|$)/.test(location.hash) && tabOf() !== tab) render(); }, { signal });

  render();
  return () => { alive = false; controller.abort(); };
}
