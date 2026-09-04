/* The UI Library as a shell route. The library lives in ci.html - one file,
   one set of specimens, precached with the shell - and this view mounts that
   same markup inside the running shell so the masthead, the navbar and the
   atmosphere stay continuous. The library stylesheet is attached once and
   kept; it styles only .ci-* hooks that no other route uses. */

import { bindLibrary } from './ci-library.js';

const LIBRARY_URL = '/ci.html';
const LIBRARY_CSS = '/ci-library.css?v=8';
let markup = null;

function ensureStylesheet() {
  if (document.querySelector(`link[href="${LIBRARY_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = LIBRARY_CSS;
  document.head.append(link);
}

async function loadMarkup() {
  if (markup) return markup;
  const response = await fetch(LIBRARY_URL);
  if (!response.ok) throw new Error(`Library unavailable (${response.status})`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  // The page body minus its own atmosphere and script: the shell already
  // runs both. Overlays (dialog, sheet, toast) sit beside <main> and come too.
  const main = doc.querySelector('main.app-page');
  const overlays = [...doc.querySelectorAll('body > .app-overlay')].map(node => node.outerHTML).join('');
  // Jump-links become route hashes so the shell router keeps this view
  // mounted; the view itself scrolls to the target section.
  for (const link of main.querySelectorAll('a[href^="#"]')) link.setAttribute('href', `#ci/${link.getAttribute('href').slice(1)}`);
  markup = main.innerHTML + overlays;
  return markup;
}

function scrollToSection(behavior) {
  const id = (location.hash.match(/^#ci\/([\w-]+)/) || [])[1];
  if (!id) return;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ block: 'start', behavior }); else window.scrollTo({ top: 0, behavior });
}

export async function mountCi(host) {
  ensureStylesheet();
  host.innerHTML = `<header class="app-hero"><p class="app-hero-eyebrow">Sindhorn Midtown Internal</p><h1 class="app-hero-title">UI Library</h1></header><section class="app-section" aria-busy="true"><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div></section>`;
  let disposed = false, unbind = null;
  try {
    const html = await loadMarkup();
    if (disposed) return () => {};
    host.innerHTML = html;
    unbind = bindLibrary(host, { page: host });
    scrollToSection('auto');
  } catch (error) {
    if (!disposed) host.innerHTML = `<header class="app-hero"><p class="app-hero-eyebrow">Sindhorn Midtown Internal</p><h1 class="app-hero-title">UI Library</h1></header><section class="app-section"><div class="app-state app-card" data-tone="error"><p class="app-state-label">Error</p><p class="app-state-title">Library unavailable</p><p class="app-state-copy">${String(error?.message || error).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</p></div></section>`;
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const onHash = () => { if (!disposed && /^#ci(\/|$)/.test(location.hash)) scrollToSection(reduced()); };
  addEventListener('hashchange', onHash);
  return () => { disposed = true; removeEventListener('hashchange', onHash); if (unbind) unbind(); };
}
