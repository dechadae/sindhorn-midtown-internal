/* Brand, rebuilt on the UI Library. The same content as the live /brand,
   /ihg-history and /hotel-factsheet routes - the index, IHG's history by
   period, and the employee factsheet - in library primitives and nothing
   else. No brand-* class, no stylesheet of its own.

   ihg-history-data.js and hotel-factsheet-data.js are the data; this file is
   the markup and behaviour. The route is addressed by hash so the browser's
   back button works: #brand, #brand/history, #brand/factsheet. */
import { IHG_HISTORY_PERIODS, IHG_HISTORY_SOURCE } from './ihg-history-data.js';
import { HOTEL_FACTSHEET, HOTEL_FACTSHEET_IMAGES, HOTEL_FACTSHEET_SOURCES, HOTEL_FACTSHEET_SOURCE_NOTES } from './hotel-factsheet-data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const DISCLOSURE_CHEVRON = '<svg class="app-disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13l-1.5 1.5a2.5 2.5 0 0 1-3.5-3.5L4.5 8.5a2.5 2.5 0 0 1 3.5 0M13 7l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L15.5 11.5a2.5 2.5 0 0 1-3.5 0"/></svg>';
const TOP_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5 9l5-5 5 5"/></svg>';
const BACK = '<button class="app-back-control app-control" type="button" data-back aria-label="Back to Brand"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg></button>';
const FACTSHEET_SECTIONS = [['overview', 'Overview'], ['stay', 'Stay'], ['dine', 'Dine'], ['facilities', 'Facilities'], ['meet', 'Meet'], ['access', 'Access']];
// Archive images per period, as the live route shows them.
const HISTORY_IMAGES = {
  '1777–1899': ['img-1770.jpg?h=422&iar=0&w=750', 'IHG history archive · 1777', 422],
  '1900–1949': ['img-1946.jpg?h=422&iar=0&w=750', 'IHG history archive · 1946', 422],
  '1950–1959': ['img-1952.jpg?h=750&iar=0&w=750', 'IHG history archive · 1952', 750],
  '1960–1969': ['img-1961.jpg?h=750&iar=0&w=750', 'IHG history archive · 1961', 750],
  '1970–1979': ['img-1972.jpg?h=422&iar=0&w=750', 'IHG history archive · 1972', 422],
  '1980–1989': ['img-1981.jpg?h=750&iar=0&w=750', 'IHG history archive · 1981', 750],
  '1990–1999': ['img-1990.jpg?h=750&iar=0&w=750', 'IHG history archive · 1990', 750],
  '2000–2009': ['img-2000.png?h=750&iar=0&w=750', 'IHG history archive · 2000', 750],
  '2010–2019': ['img-2010.jpg?h=750&iar=0&w=750', 'IHG history archive · 2010', 750],
  '2020–Present': ['history-2.jpg?h=422&iar=0&w=750', 'IHG history archive · 2021', 422]
};
const HISTORY_IMAGE_BASE = 'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/';

/* ---- shared markup ------------------------------------------------------ */
function fact(label, value, note = '') {
  return `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value)}</span>${note ? `<span class="app-metric-note">${esc(note)}</span>` : ''}</div>`;
}
function disclosure({ id = '', kicker = '', title, copy = '', body, open = false }) {
  return `<article class="app-disclosure" data-disclosure${id ? ` data-item="${esc(id)}"` : ''}${open ? ' data-open="true"' : ''}>
    <button class="app-disclosure-button" type="button" aria-expanded="${open}">
      <span class="app-disclosure-head">${kicker ? `<span class="app-disclosure-kicker">${esc(kicker)}</span>` : ''}<span class="app-disclosure-title">${esc(title)}</span>${copy ? `<span class="app-disclosure-copy">${esc(copy)}</span>` : ''}</span>
      ${DISCLOSURE_CHEVRON}
    </button>
    <div class="app-disclosure-panel"><div class="app-disclosure-panel-inner"><div class="app-stack">${body}</div></div></div>
  </article>`;
}
function figure(src, alt, caption, { width = 0, height = 0 } = {}) {
  return `<figure class="app-figure"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer-when-downgrade"${width ? ` width="${width}" height="${height}"` : ''}>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
}
const externalLink = (href, label) => `<a class="app-utility-action" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${LINK_ICON}${esc(label)}</a>`;
const topButton = () => `<button class="app-utility-action" type="button" data-brand-top>${TOP_ICON}Back to top</button>`;
const utilityRow = (...actions) => `<div class="app-utility-row">${actions.filter(Boolean).join('')}</div>`;
const listLink = (href, title, meta, end = '') => `<a class="app-list-row" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="app-list-row-main"><span class="app-list-row-title">${esc(title)}</span>${meta ? `<span class="app-list-row-meta">${esc(meta)}</span>` : ''}</span><span class="app-list-row-end">${end}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l6 6-6 6"/></svg></span></a>`;
const listRow = (title, meta, end = '') => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(title)}</span>${meta ? `<span class="app-list-row-meta">${esc(meta)}</span>` : ''}</span>${end ? `<span class="app-list-row-end">${esc(end)}</span>` : ''}</div>`;

/* ---- index ---------------------------------------------------------------- */
function indexMarkup() {
  const milestones = IHG_HISTORY_PERIODS.reduce((sum, period) => sum + period.milestones.length, 0);
  const h = HOTEL_FACTSHEET.hotel;
  const card = (id, index, title, copy, meta) => `<article class="app-action-card">
    <button class="app-action-card-button" type="button" data-brand="${id}">
      <span class="app-action-card-head"><span class="app-action-card-status">${esc(index)}</span></span>
      <span class="app-action-card-title">${esc(title)}</span>
      <span class="app-action-card-copy">${esc(copy)}</span>
      <span class="app-action-card-foot"><span>${esc(meta)}</span>${CHEVRON}</span>
    </button>
  </article>`;
  return `<header class="app-hero"><p class="app-hero-eyebrow">Brand</p><h1 class="app-hero-title">Know Our Hotel</h1><p class="app-hero-copy">History, identity and essential hotel knowledge.</p></header>
  <section class="app-section">
    <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${fact('Hotel', 'Sindhorn Midtown')}${fact('Collection', 'Vignette Collection by IHG')}</div>
    <h3 class="app-section-subhead">Reference</h3>
    <div class="app-stack">
      ${card('history', '01 · IHG Hotels & Resorts', 'Our History', 'From the origins of Bass in 1777 to today’s global IHG portfolio.', `${milestones} milestones`)}
      ${card('factsheet', '02 · Sindhorn Midtown', 'Hotel Factsheet', 'The essential employee reference for rooms, dining, facilities, meetings and location.', `${h.roomsAndSuites} rooms & suites`)}
    </div>
  </section>`;
}

/* ---- history -------------------------------------------------------------- */
function historyMarkup() {
  const years = IHG_HISTORY_PERIODS.flatMap(p => p.milestones.map(m => Number(String(m[0]).slice(0, 4)) || 0));
  const latest = Math.max(...years);
  const period = (p, i) => {
    const image = HISTORY_IMAGES[p.period];
    // Inside a disclosure nothing draws an edge (glass never nests), so
    // the context stands as a bare label and copy.
    const body = `${image ? figure(HISTORY_IMAGE_BASE + image[0], '', image[1], { width: 750, height: image[2] }) : ''}
      <div><p class="app-surface-label">At this time</p><div class="app-surface-copy">${esc(p.context)}</div></div>
      <div class="app-prose" data-rule="true">${p.milestones.map(m => `<h3>${esc(m[0])} · ${esc(m[1])}</h3><p>${esc(m[2])}</p>`).join('')}</div>`;
    return disclosure({ id: `period-${i}`, kicker: p.period, title: p.title, copy: `${p.milestones.length} milestone${p.milestones.length === 1 ? '' : 's'}`, body });
  };
  return `<header class="app-hero"><div class="app-hero-head">${BACK}</div><p class="app-hero-eyebrow">IHG Hotels &amp; Resorts</p><h1 class="app-hero-title">Our History</h1><p class="app-hero-copy">From a Burton-on-Trent brewery in 1777 to a global hospitality group.</p></header>
  <section class="app-section">
    <div class="app-metric-grid" data-columns="3" data-values="text" data-rule="true">${fact('Story begins', '1777')}${fact('IHG is born', '2003')}${fact('Latest milestone', latest)}</div>
  </section>
  <section class="app-section" id="periods"><p class="app-section-kicker">01 · Periods</p><h2 class="app-section-title">Ten Chapters</h2>
    <div class="app-stack">${IHG_HISTORY_PERIODS.map(period).join('')}</div>
  </section>
  <section class="app-section" id="history-source"><p class="app-section-kicker">02 · Source</p>
    <div class="app-card app-surface"><p class="app-surface-label">IHG Hotels &amp; Resorts — Our history</p><div class="app-surface-copy">Milestones and selected archive images are sourced from IHG plc.</div></div>
    ${utilityRow(externalLink(IHG_HISTORY_SOURCE, 'View official history'), topButton())}
  </section>`;
}

/* ---- factsheet ------------------------------------------------------------ */
function factsheetMarkup() {
  const D = HOTEL_FACTSHEET, h = D.hotel, I = HOTEL_FACTSHEET_IMAGES, S = HOTEL_FACTSHEET_SOURCES;
  const num = value => value === null || value === undefined ? '—' : String(value);
  const verified = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${D.verifiedOn}T00:00:00+07:00`));
  const rail = `<nav class="app-rail" data-columns="3" aria-label="Factsheet sections">${FACTSHEET_SECTIONS.map(([id, label], i) => `<button class="app-chip app-control${i === 0 ? ' is-active' : ''}" type="button" data-section="${id}"${i === 0 ? ' aria-current="true"' : ''}>${label}</button>`).join('')}</nav>`;
  const roomBody = room => `<div class="app-prose"><ul>${room.highlights.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>`;
  const venueBody = venue => `<div><p class="app-surface-label">Hours</p><div class="app-surface-copy">${venue.hours.map(esc).join('<br>')}</div></div>`;
  const facilityBody = item => `<div class="app-prose"><p>${esc(item.detail)}</p></div>`;
  const space = s => `<tr><th scope="row">${esc(s.name)}<small>${esc(s.floor)} · ${esc(s.sqm)} sqm</small></th><td>${num(s.classroom)}</td><td>${num(s.theater)}</td><td>${num(s.banquet)}</td><td>${num(s.halfMoon)}</td><td>${num(s.uShape)}</td><td>${num(s.boardroom)}</td><td>${num(s.cocktail)}</td></tr>`;
  const noteBody = note => `<div class="app-prose"><p>${esc(note.note)}</p></div><div><p class="app-surface-label">Authority</p><div class="app-surface-copy">${esc(note.authority)}</div></div>${utilityRow(...note.urls.map((url, i) => externalLink(url, `Source ${i + 1}`)))}`;
  return `<header class="app-hero"><div class="app-hero-head">${BACK}</div><p class="app-hero-eyebrow">Sindhorn Midtown Hotel Bangkok</p><h1 class="app-hero-title">Hotel Factsheet</h1><p class="app-hero-copy">Vignette Collection by IHG · Langsuan, Bangkok</p><p class="app-note">Verified against the official hotel site on ${esc(verified)}</p></header>
  ${rail}
  <section class="app-section" id="overview">
    ${figure(I.overview.src, I.overview.alt, '')}
    <div class="app-metric-grid" data-columns="3" data-values="text" data-rule="true">${fact('Rooms & suites', h.roomsAndSuites)}${fact('Room types', h.roomTypes)}${fact('Dining venues', h.diningVenues)}${fact('Meetings', `Up to ${h.meetingMaxGuests}`)}${fact('Check-in', h.checkIn)}${fact('Check-out', h.checkOut)}</div>
    <div class="app-card app-surface"><div class="app-list">
      ${listRow(h.name, h.positioning)}
      ${listRow('Owner and operator', h.ownerOperator)}
      ${listLink(`https://maps.google.com/?q=${encodeURIComponent(h.address)}`, 'Address', h.address)}
      ${listLink(`tel:${h.phone.replace(/[^\d+]/g, '')}`, 'Telephone', h.phone)}
      ${listLink(`tel:${h.internationalPhone.replace(/[^\d+]/g, '')}`, 'International toll-free', h.internationalPhone)}
      ${listLink(`mailto:${h.stayEmail}`, 'Reservations', h.stayEmail)}
    </div></div>
    ${utilityRow(externalLink(S.overview, 'Hotel site'))}
  </section>
  <section class="app-section" id="stay"><p class="app-section-kicker">01 · Stay</p><h2 class="app-section-title">Rooms &amp; Suites</h2><p class="app-section-lede">Twelve published room and suite categories. Open a category for the essential employee-facing differences.</p>
    ${figure(I.stay.src, I.stay.alt, '')}
    <div class="app-stack">${D.rooms.map((room, i) => disclosure({ id: `room-${i}`, kicker: `${room.sizeSqm} sqm · ${room.beds}`, title: room.name, body: roomBody(room) })).join('')}</div>
    ${utilityRow(externalLink(S.rooms, 'Rooms & suites source'))}
  </section>
  <section class="app-section" id="dine"><p class="app-section-kicker">02 · Dine</p><h2 class="app-section-title">Restaurants &amp; Bars</h2>
    ${figure(I.dine.src, I.dine.alt, '')}
    <div class="app-stack">${D.dining.map((venue, i) => disclosure({ id: `venue-${i}`, kicker: venue.floor, title: venue.name, copy: venue.concept, body: venueBody(venue) })).join('')}</div>
    <div class="app-card app-surface"><div class="app-list">${listLink(`mailto:${h.diningEmail}`, 'Dining enquiries', h.diningEmail)}</div></div>
    ${utilityRow(externalLink(S.bangkok78, 'Dining source'))}
  </section>
  <section class="app-section" id="facilities"><p class="app-section-kicker">03 · Facilities</p><h2 class="app-section-title">Facilities &amp; Services</h2>
    ${figure(I.facilities.src, I.facilities.alt, '')}
    <div class="app-stack">${D.facilities.map((item, i) => disclosure({ id: `facility-${i}`, title: item.name, copy: item.fact, body: facilityBody(item) })).join('')}</div>
    ${utilityRow(externalLink(S.facilities, 'Facilities source'), externalLink(S.shuttle, 'Shuttle source'))}
  </section>
  <section class="app-section" id="meet"><p class="app-section-kicker">04 · Meet</p><h2 class="app-section-title">Meetings &amp; Events</h2><p class="app-section-lede">${esc(D.meetings.summary)}</p>
    ${figure(I.meetings.src, I.meetings.alt, '')}
    <div class="app-table-wrap"><table class="app-table">
      <thead><tr><th scope="col">Room</th><th scope="col">Class</th><th scope="col">Theatre</th><th scope="col">Banquet</th><th scope="col">Half-moon</th><th scope="col">U-shape</th><th scope="col">Board</th><th scope="col">Cocktail</th></tr></thead>
      <tbody>${D.meetings.spaces.map(space).join('')}</tbody>
    </table></div>
    <h3 class="app-section-subhead">Private events</h3>
    <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${D.meetings.privateEvents.map(item => fact(item.name, item.capacity)).join('')}</div>
    <div class="app-card app-surface"><p class="app-surface-label">Included</p><div class="app-prose"><ul>${D.meetings.included.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div></div>
    <div class="app-card app-surface"><div class="app-list">${listLink(`mailto:${h.commercialEmail}`, 'Meetings & events', h.commercialEmail)}</div></div>
    ${utilityRow(externalLink(S.meetings, 'Meeting source'), externalLink(S.privateEvents, 'Venues source'))}
  </section>
  <section class="app-section" id="access"><p class="app-section-kicker">05 · Access</p><h2 class="app-section-title">Getting Here</h2>
    <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${D.access.bts.map(item => fact(`${item.distance} · ${item.walk}`, item.station, item.exit)).join('')}</div>
    <div class="app-card app-surface"><p class="app-surface-label">Nearby destinations</p><div class="app-row">${D.access.nearby.map(item => `<span class="app-badge" data-tone="quiet">${esc(item)}</span>`).join('')}</div></div>
    ${utilityRow(externalLink(S.location, 'Location source'))}
  </section>
  <section class="app-section" id="source-notes"><p class="app-section-kicker">06 · Source notes</p><h2 class="app-section-title">Where Sources Disagree</h2><p class="app-section-lede">The official site sometimes publishes two values for one fact. These notes record which one this factsheet uses and why.</p>
    <div class="app-stack">${HOTEL_FACTSHEET_SOURCE_NOTES.map((note, i) => disclosure({ id: `note-${i}`, kicker: note.topic, title: note.selected, body: noteBody(note) })).join('')}</div>
    ${utilityRow(externalLink(S.gallery, 'Photo gallery'), topButton())}
  </section>`;
}

/* ---- mount ---------------------------------------------------------------- */
export async function mountBrand(host) {
  let disposed = false, spyRaf = 0, indexScroll = 0;
  const openItems = new Set();
  const q = selector => host.querySelector(selector);
  const qa = selector => [...host.querySelectorAll(selector)];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = () => (location.hash.match(/^#brand\/(history|factsheet)/) || [])[1] || '';

  function setActiveSection(id) {
    for (const chip of qa('[data-section]')) { const active = chip.dataset.section === id; chip.classList.toggle('is-active', active); if (active) chip.setAttribute('aria-current', 'true'); else chip.removeAttribute('aria-current'); }
  }
  function spy() {
    spyRaf = 0; if (view() !== 'factsheet') return;
    const probe = Math.min(innerHeight * 0.3, 238); let active = FACTSHEET_SECTIONS[0][0];
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 36) active = FACTSHEET_SECTIONS[FACTSHEET_SECTIONS.length - 1][0];
    else for (const [id] of FACTSHEET_SECTIONS) { const el = q(`#${id}`); if (el && el.getBoundingClientRect().top <= probe) active = id; }
    setActiveSection(active);
  }
  const scheduleSpy = () => { if (!spyRaf) spyRaf = requestAnimationFrame(spy); };

  function render() {
    const current = view();
    host.innerHTML = current === 'history' ? historyMarkup() : current === 'factsheet' ? factsheetMarkup() : indexMarkup();
    // Panels a reader had open stay open across the index round-trip.
    for (const item of qa('[data-item]')) if (openItems.has(`${current}:${item.dataset.item}`)) { item.dataset.open = 'true'; item.querySelector('.app-disclosure-button')?.setAttribute('aria-expanded', 'true'); }
    if (current) { scrollTo({ top: 0, behavior: 'auto' }); scheduleSpy(); }
    else { scrollTo({ top: indexScroll, behavior: 'auto' }); indexScroll = 0; }
  }

  const onClick = event => {
    const t = event.target;
    const open = t.closest('[data-brand]'); if (open) { indexScroll = scrollY; location.hash = `#brand/${open.dataset.brand}`; return; }
    if (t.closest('[data-back]')) { location.hash = '#brand'; return; }
    if (t.closest('[data-brand-top]')) { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
    const section = t.closest('[data-section]');
    if (section) { const el = q(`#${section.dataset.section}`); setActiveSection(section.dataset.section); el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); return; }
    const button = t.closest('.app-disclosure-button');
    if (button) {
      const root = button.closest('[data-disclosure]'), isOpen = root.dataset.open === 'true';
      root.dataset.open = String(!isOpen); button.setAttribute('aria-expanded', String(!isOpen));
      const key = `${view()}:${root.dataset.item}`; if (isOpen) openItems.delete(key); else openItems.add(key);
    }
  };
  const onHash = () => { if (!disposed && /^#brand(\/|$)/.test(location.hash)) render(); };
  host.addEventListener('click', onClick);
  addEventListener('hashchange', onHash);
  addEventListener('scroll', scheduleSpy, { passive: true });
  addEventListener('resize', scheduleSpy, { passive: true });
  render();
  return () => {
    disposed = true;
    host.removeEventListener('click', onClick);
    removeEventListener('hashchange', onHash); removeEventListener('scroll', scheduleSpy); removeEventListener('resize', scheduleSpy);
    if (spyRaf) cancelAnimationFrame(spyRaf);
  };
}
