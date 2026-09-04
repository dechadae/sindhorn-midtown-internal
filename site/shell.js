/* The app shell's behaviour: atmosphere, sign-in gate, hash router, masthead
   controls and the two-set navbar. next.html is markup only; everything
   that moves lives here, so a shell change is one file and one precache
   entry.

   Routes are modules exporting mount(host) that return a dispose function.
   The shell swaps views on hashchange, keeps the navbar honest (the current
   view's button carries aria-current="page") and refuses every route but
   sign-in until an employee with a permanent code has a session - the same
   line the legacy app draws. Data pages never see a signed-out host. */
import { initAuth, getState } from './auth-client.js';
import { updateBadge } from './notification-inbox.js';

/* The full WebGL runtime directly. betta-runtime.js is a bootstrap that paints
   a still frame and waits for a startup signal the old app shell emits; a page
   outside that shell never receives it, and the glass would be frosting a
   photograph. */
(async () => {
  try {
    const betta = await import('/betta-runtime-full.js?v=1');
    await betta.initEnvironment();
    document.getElementById('environmentStage')?.setAttribute('data-ready', 'true');
  } catch (error) {
    console.warn('Atmosphere unavailable; the shell renders over the flat ground.', error);
  }
})();

const ROUTES = {
  today: () => import('./today.js').then(m => m.mountToday),
  fnb: () => import('./fnb-page.js').then(m => m.mountFnb),
  messages: () => import('./messages-page.js').then(m => m.mountMessages),
  brand: () => import('./brand-page.js').then(m => m.mountBrand),
  settings: () => import('./settings-page.js').then(m => m.mountSettings),
  signin: () => import('./signin-page.js').then(m => m.mountSignin),
  ci: () => import('./ci-page.js').then(m => m.mountCi)
};
const SETTINGS_TABS = ['me', 'admin', 'broadcast', 'system'];

/* The shell's layers: the app tabs are the ground; Settings and the library
   it opens sit one layer up; sign-in covers everything. Closing a layer
   returns to where the layer below was. */
const layerOf = view => view === 'signin' ? 2 : (view.startsWith('settings') || view === 'ci') ? 1 : 0;

const host = document.getElementById('routeView');
const masthead = document.querySelector('.app-masthead');
const navbar = document.querySelector('.app-navbar');
const home = masthead.querySelector('.app-masthead-home');
const account = masthead.querySelector('.app-masthead-account');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* An employee is signed in once a session, a profile and a permanent code
   all exist; an activated account still choosing its code stays on sign-in. */
const signedIn = () => { const state = getState(); return Boolean(state.authenticated && state.profile?.pin_configured_at); };

const initials = name => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '').slice(0, 2);
  return letters.toUpperCase() || '—';
};

/* The hash names the wanted view; the gate decides what actually mounts. */
const wantedName = () => { const name = (location.hash.match(/^#([a-z]+)/) || [])[1]; return ROUTES[name] ? name : 'today'; };
const settingsTab = () => { const tab = (location.hash.match(/^#settings\/([a-z]+)/) || [])[1]; return SETTINGS_TABS.includes(tab) ? tab : 'me'; };
const resolve = () => { const name = wantedName(); if (!signedIn()) return 'signin'; return name === 'signin' ? 'today' : name; };
/* A view is a route plus, for Settings, its tab - so a tab change is a view change. */
const viewOf = name => name === 'settings' ? `settings/${settingsTab()}` : name;

let current = '', dispose = null, generation = 0, returnHash = '';

/* The library is reached from Settings › System, so it keeps the settings
   set beneath it with System still current. */
function paintNavbar(name) {
  const locked = !signedIn();
  const mode = name === 'settings' || name === 'ci' ? 'settings' : 'app';
  const full = name === 'ci' ? 'settings/system' : viewOf(name);
  navbar.dataset.mode = mode;
  if (locked) navbar.dataset.locked = ''; else delete navbar.dataset.locked;
  for (const set of navbar.querySelectorAll('.app-navbar-set')) set.inert = set.dataset.set !== mode;
  for (const button of navbar.querySelectorAll('[data-route]')) {
    button.disabled = locked;
    if (button.dataset.route === full) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  account.hidden = locked;
  account.dataset.mode = mode === 'settings' ? 'close' : 'initials';
  account.setAttribute('aria-label', mode === 'settings' ? 'Close settings' : 'Settings');
  account.querySelector('span').textContent = initials(getState().profile?.display_name);
}

/* A page change is a cut, the way r12 shipped it: the old page goes, the
   new one is there. The navbar still pushes between its app and settings
   sets (app-components.css). Earlier releases moved the page - slides,
   settles, fades, the browser's own view transition - and each one either
   stuttered on a phone (frosted cards re-sampling the atmosphere every
   frame) or switched the glass off; the library keeps the specimen. */
async function route() {
  const name = resolve();
  const view = viewOf(name);
  if (layerOf(view) === 0) returnHash = location.hash;
  if (name !== 'signin' && wantedName() === 'signin') history.replaceState(null, '', location.pathname + location.search);
  paintNavbar(name);
  /* An invitation link arriving as a hash change remounts sign-in so it can
     read the link; otherwise the same view stays put. */
  if (view === current && !(name === 'signin' && /^#signin\?/.test(location.hash))) return;
  const mine = ++generation;
  current = view;
  if (typeof dispose === 'function') dispose();
  dispose = null;
  const mount = await ROUTES[name]();
  if (mine !== generation) return;
  scrollTo(0, 0);
  dispose = await mount(host);
  if (mine !== generation && typeof dispose === 'function') dispose();
}

navbar.addEventListener('click', event => {
  const button = event.target.closest('[data-route]');
  if (!button || button.disabled) return;
  const name = button.dataset.route;
  if (button.getAttribute('aria-current') === 'page') { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
  location.hash = name === 'today' ? '' : `#${name}`;
});

/* The logo is Home: back to Today from anywhere, to the top if already there. */
home.addEventListener('click', () => {
  if (current === 'today' || current === 'signin') { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
  location.hash = '';
});

/* The account chip opens Settings; while Settings is open it is the way back
   to wherever the employee came from. */
account.addEventListener('click', () => {
  if (layerOf(current) === 1) { const back = returnHash; returnHash = ''; location.hash = back; return; }
  location.hash = '#settings/me';
});

/* Unread messages on the navbar: on launch, when the service worker stores a
   push while the app is open, and whenever the app returns to the front. */
const badge = () => updateBadge().catch(() => {});
navigator.serviceWorker?.addEventListener?.('message', event => { if (event.data?.type === 'SINDHORN_NOTIFICATION_STORED') badge(); });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') badge(); });
document.addEventListener('sindhorn:messages-changed', badge);

/* Signing in or out re-runs the gate. auth-client dispatches on document. */
document.addEventListener('sindhorn:auth-changed', event => {
  if (event.detail?.reason === 'signed_out' && location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (viewOf(resolve()) !== current) route(); else paintNavbar(resolve());
});
addEventListener('hashchange', route);

/* First paint is a placeholder in the shell's own vocabulary, so the auth
   round trip never shows an empty page or a sign-in that then vanishes. */
host.innerHTML = `<header class="app-hero"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line" data-width="medium"></div></div></header>
<section class="app-section"><div class="app-stack"><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-block"></div></div></div></div></section>`;
paintNavbar('signin');
initAuth().finally(() => { route(); badge(); });
