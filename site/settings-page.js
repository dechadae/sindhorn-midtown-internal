/* Settings, rebuilt on the UI Library. Four tabs - Me, Admin, Broadcast,
   System - that the navbar shows in place of the app's four while the
   account chip is open. Every tab is visible to every employee; what a tab
   holds depends on the capabilities the settings manifest grants, and a
   tab the account cannot use says so in an ordinary state card rather than
   disappearing. The frame fills System itself; Me, Admin and Broadcast are
   modules it loads only when their tab opens (settings-me.js,
   settings-admin.js, settings-broadcast.js), so the shell pays for none of
   them until an employee asks. */
import { signOut } from './auth-client.js';
import { loadSettingsAuthority, hasCapability } from './capabilities.js';
import { confirmDialog } from './app-dialog.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const LOGOUT_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3M13 6l4 4-4 4M17 10H8"/></svg>';

const TABS = {
  me: { eyebrow: 'Settings', title: 'Me', copy: 'Your account and how you appear to colleagues.', capability: 'account.read', gate: 'Your account', gateTitle: 'This account cannot read its own profile yet.', gateCopy: 'Ask People & Culture to check your access.' },
  admin: { eyebrow: 'Settings', title: 'Admin', copy: 'Employees, access and one-time codes.', capability: 'people.read', gate: 'Admin only', gateTitle: 'This tab is only for admins.', gateCopy: 'Ask People & Culture if you need access.' },
  broadcast: { eyebrow: 'Settings', title: 'Broadcast', copy: 'Messages sent to every employee or a department.', capability: 'broadcasts.manage', gate: 'Broadcast only', gateTitle: 'This tab is only for employees who send broadcasts.', gateCopy: 'Ask People & Culture if you need access.' },
  system: { eyebrow: 'Settings', title: 'System', copy: 'The app itself: version, library and diagnostics.', capability: 'system.manage', gate: 'System only', gateTitle: 'This tab is only for system administrators.', gateCopy: '' }
};
const tabOf = () => { const tab = (location.hash.match(/^#settings\/([a-z]+)/) || [])[1]; return TABS[tab] ? tab : 'me'; };

/* Me carries Sign out in its hero head, where F&B carries Share: the page's
   one utility sits beside the eyebrow rather than at the foot of the page. */
const signOutButton = () => `<button class="app-utility-action" type="button" data-settings-signout>${LOGOUT_ICON}Sign out</button>`;
const hero = tab => `<header class="app-hero"><div class="app-hero-head"><p class="app-hero-eyebrow">${esc(TABS[tab].eyebrow)}</p>${tab === 'me' ? signOutButton() : ''}</div><h1 class="app-hero-title">${esc(TABS[tab].title)}</h1><p class="app-hero-copy">${esc(TABS[tab].copy)}</p></header>`;
const state = (label, title, copy, tone = 'empty', attrs = '') => `<div class="app-state app-card" data-tone="${tone}"${attrs}><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const fact = (label, value) => `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value || '—')}</span></div>`;
const skeleton = () => `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;

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
  let alive = true, tab = tabOf(), tabDispose = null, tabController = null;
  const controller = new AbortController();
  const { signal } = controller;
  /* A tab module's listeners and dialogs live only while its tab does. */
  const disposeTab = () => { tabDispose?.(); tabDispose = null; tabController?.abort(); tabController = null; };

  /* A tab change is a new mount: the shell remounts Settings through its view
     transition so the tab arrives rather than repaints in place. */
  const paint = body => { if (alive) host.innerHTML = `${hero(tab)}<section class="app-section"><div class="app-stack">${body}</div></section>`; };

  async function render() {
    tab = tabOf();
    disposeTab();
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
    if (!hasCapability(spec.capability, manifest)) { paint(state(spec.gate, spec.gateTitle, spec.gateCopy, 'empty', ` data-gate="${esc(spec.capability)}"`)); return; }
    if (tab === 'me' || tab === 'admin' || tab === 'broadcast') { await mountTab(tab, manifest); return; }
    paint(systemMarkup(manifest, await appVersion()));
  }

  /* The module gets the empty stack, the manifest already loaded, and a
     signal that ends with the tab. */
  async function mountTab(which, manifest) {
    let module;
    try { module = which === 'me' ? await import('./settings-me.js') : which === 'admin' ? await import('./settings-admin.js') : await import('./settings-broadcast.js'); }
    catch (_) { paint(state('Error', 'This tab could not be loaded.', 'Check the connection and try again.', 'error') + `<div class="app-utility-row"><button class="app-utility-action" type="button" data-settings-retry>Try again</button></div>`); return; }
    if (!alive || which !== tabOf()) return;
    paint('');
    tabController = new AbortController();
    const stack = host.querySelector('.app-stack');
    tabDispose = await (which === 'me' ? module.mountMe : which === 'admin' ? module.mountAdmin : module.mountBroadcast)(stack, { manifest, signal: tabController.signal });
  }

  host.addEventListener('click', event => {
    const go = event.target.closest('[data-settings-go]');
    if (go) { location.hash = go.dataset.settingsGo; return; }
    if (event.target.closest('[data-settings-retry]')) { render(); return; }
    const out = event.target.closest('[data-settings-signout]');
    if (out) askSignOut(out);
  }, { signal });

  /* Signing out is one tap away from the hero, so it asks first. The button
     stays disabled while the session closes; if that fails it comes back. */
  async function askSignOut(button) {
    const yes = await confirmDialog({ kicker: 'Settings', title: 'Sign out of this device?', copy: 'You will need your Employee ID and permanent code to sign back in.', confirm: 'Sign out', cancel: 'Stay signed in', tone: 'danger' });
    if (!yes || !alive) return;
    button.disabled = true;
    signOut().catch(() => { button.disabled = false; });
  }

  render();
  return () => { alive = false; disposeTab(); controller.abort(); };
}
