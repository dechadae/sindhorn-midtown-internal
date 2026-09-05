/* The Voice library as a shell route, the way ci-page.js mounts the UI
   Library. The document lives in voice.html - one file, precached with the
   shell - and this view mounts that same markup inside the running shell so
   the masthead, the navbar and the atmosphere stay continuous. It borrows the
   UI Library's chrome (ci-library.css) and behavior (bindLibrary) and adds
   one thing of its own: the dates and numbers on the page are written by
   app-format.js at mount, so the specimens are the code's own output. */

import { bindLibrary } from './ci-library.js';
import { formatDate, formatTime, formatDateTime, formatClock, formatMoney, formatPercent, formatCount } from './app-format.js';

const LIBRARY_URL = '/voice.html';
const LIBRARY_CSS = '/ci-library.css?v=10';
let markup = null;

// The reference moment every specimen is written from: 5 September 2026,
// 6 pm and 11:30 am hotel time.
const EVENING = '2026-09-05T18:00:00+07:00';
const MORNING = '2026-09-05T11:30:00+07:00';

const FORMATS = {
  'date:short:en': () => formatDate(EVENING),
  'date:short:th': () => formatDate(EVENING, { lang: 'th' }),
  'date:long:en': () => formatDate(EVENING, { style: 'long' }),
  'date:long:th': () => formatDate(EVENING, { style: 'long', lang: 'th' }),
  'date:weekday:en': () => formatDate(EVENING, { style: 'weekday' }),
  'date:weekday:th': () => formatDate(EVENING, { style: 'weekday', lang: 'th' }),
  'date:day:en': () => formatDate(EVENING, { style: 'day' }),
  'date:day:th': () => formatDate(EVENING, { style: 'day', lang: 'th' }),
  'date:month:en': () => formatDate(EVENING, { style: 'month' }),
  'date:month:th': () => formatDate(EVENING, { style: 'month', lang: 'th' }),
  'time:en': () => formatTime(EVENING),
  'time:th': () => formatTime(EVENING, { lang: 'th' }),
  'time2:en': () => formatTime(MORNING),
  'time2:th': () => formatTime(MORNING, { lang: 'th' }),
  'noon:en': () => `${formatClock('12:00')} · ${formatClock('00:00')}`,
  'noon:th': () => `${formatClock('12:00', { lang: 'th' })} · ${formatClock('00:00', { lang: 'th' })}`,
  'datetime:en': () => formatDateTime(EVENING),
  'datetime:th': () => formatDateTime(EVENING, { lang: 'th' }),
  'clock:en': () => formatClock('06:30–11:00'),
  'clock:th': () => formatClock('06:30–11:00', { lang: 'th' }),
  'clock2:en': () => formatClock('17:00–02:00'),
  'clock2:th': () => formatClock('17:00–02:00', { lang: 'th' }),
  'money': () => formatMoney(1300),
  'money-code': () => `${formatMoney(1300, { code: true })} net · ${formatMoney(250, { code: true })}++`,
  'money-compact': () => `${formatMoney(1234567, { compact: true })} · ${formatMoney(480000, { compact: true })}`,
  'percent': () => `${formatPercent(0.724)} · ${formatPercent(-0.032, { signed: true })} · ${formatPercent(0.018, { signed: true })}`,
  'count': () => `${formatCount(1, 'job')} · ${formatCount(3, 'job')} · ${formatCount(0, 'session')}`
};

/* Fill every [data-format] slot from app-format.js, then hand the rest of the
   page to the UI Library's behavior. Shared by the standalone document and
   the shell route. */
export function bindVoice(root, options = {}) {
  for (const slot of root.querySelectorAll('[data-format]')) {
    const write = FORMATS[slot.dataset.format];
    if (write) slot.textContent = write();
  }
  return bindLibrary(root, options);
}

function ensureStylesheet() {
  if (document.querySelector(`link[href="${LIBRARY_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = LIBRARY_CSS;
  document.head.append(link);
}

async function loadMarkup() {
  if (markup) return markup;
  const response = await fetch(LIBRARY_URL);
  if (!response.ok) throw new Error(`Voice unavailable (${response.status})`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const main = doc.querySelector('main.app-page');
  const overlays = [...doc.querySelectorAll('body > .app-overlay')].map(node => node.outerHTML).join('');
  for (const link of main.querySelectorAll('a[href^="#"]')) link.setAttribute('href', `#voice/${link.getAttribute('href').slice(1)}`);
  markup = main.innerHTML + overlays;
  return markup;
}

function scrollToSection(behavior) {
  const id = (location.hash.match(/^#voice\/([\w-]+)/) || [])[1];
  if (!id) return;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ block: 'start', behavior }); else window.scrollTo({ top: 0, behavior });
}

const HERO = `<header class="app-hero"><p class="app-hero-eyebrow">Sindhorn Midtown Internal</p><h1 class="app-hero-title">Voice</h1></header>`;

export async function mountVoice(host) {
  ensureStylesheet();
  host.innerHTML = `${HERO}<section class="app-section" aria-busy="true"><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div></section>`;
  let disposed = false, unbind = null;
  try {
    const html = await loadMarkup();
    if (disposed) return () => {};
    host.innerHTML = html;
    unbind = bindVoice(host, { page: host });
    scrollToSection('auto');
  } catch (error) {
    if (!disposed) host.innerHTML = `${HERO}<section class="app-section"><div class="app-state app-card" data-tone="error"><p class="app-state-label">Error</p><p class="app-state-title">Couldn't load Voice</p><p class="app-state-copy">${String(error?.message || error).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</p></div></section>`;
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const onHash = () => { if (!disposed && /^#voice(\/|$)/.test(location.hash)) scrollToSection(reduced()); };
  addEventListener('hashchange', onHash);
  return () => { disposed = true; removeEventListener('hashchange', onHash); if (unbind) unbind(); };
}
