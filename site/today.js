/* Today, rebuilt on the UI Library. Mirrors the live business dashboard's
   content 1:1 (hero, At a Glance, exceptions, F&B, Rooms, outlook, market
   segments, operations notes) - only the markup changed, from bd-* classes
   and business-dashboard.css to library primitives and nothing else.

   business-dashboard-data.js is reused unmodified: it already fetches
   sindhorn_business_dashboard_read_model correctly and is not route markup.
   Numbers and dates are read through app-format.js (the Voice library's
   one spelling), never business-dashboard.js - that file is the still-live
   legacy route, and this rebuild does not patch or depend on route code it
   is replacing.

   That RPC requires an authenticated session. This shell has none yet (auth
   returns in a later phase), so today a fresh visitor sees the real error
   state below, not a fake success - which is the correct behavior, not a
   bug to route around. */
import { loadBusinessDashboard } from './business-dashboard-data.js';
import { initAuth } from './auth-client.js';
import { formatMoney as money, formatInteger as integer, formatPercent as percent, formatDate, formatDateTime } from './app-format.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const directionOf = delta => delta === null || delta === undefined || Number.isNaN(delta) ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

/* Hotel days: the business date reads with its weekday, a report date short,
   a stay month as "Sep 2026". */
const dateLabel = (value, { monthOnly = false } = {}) => formatDate(String(value || '').slice(0, 10), { style: monthOnly ? 'month' : 'weekday' }) || String(value || '');
const shortDateLabel = value => formatDate(String(value || '').slice(0, 10)) || String(value || '');
const dateTimeLabel = value => formatDateTime(value) || String(value || '');
function sourceFor(data, type) { return (data.sources || []).find(source => source?.type === type) || null; }
function variance(actual, forecast, { moneyValue = true } = {}) {
  const a = num(actual), f = num(forecast);
  if (a === null || f === null || f === 0) return 'No forecast comparison';
  const diff = a - f, pct = diff / f;
  return `${moneyValue ? money(diff, { compact: true, signed: true }) : integer(diff, { signed: true })} · ${percent(pct, { signed: true })} vs forecast`;
}
function currentRooms(data) {
  const month = String(data.businessDate).slice(0, 7);
  return data.rooms?.months?.find(item => String(item.stayMonth).slice(0, 7) === month) || data.rooms?.months?.[0] || null;
}

function track(actual, reference, stagger = 0) {
  const a = num(actual), r = num(reference);
  if (a === null || r === null || r <= 0) return '';
  const width = Math.max(0, Math.min(100, (a / r) * 80)).toFixed(1);
  return `<svg class="app-track"${stagger ? ` data-stagger="${Math.min(stagger, 7)}"` : ''} aria-hidden="true"><rect class="app-track-rail" x="0" y="3.5" width="100%" height="3" rx="1.5"/><rect class="app-track-bar" x="0" y="3.5" width="${width}%" height="3" rx="1.5"/><rect class="app-track-mark" x="80%" y="0" width="1.5" height="10" rx=".75"/></svg>`;
}
// meta is one note or a list of notes; each note is its own line of the
// library anatomy, so a metric never composes two facts on one line.
function metric({ label, value, comparison = '', meta = '', direction = null, track: trackMarkup = '' }) {
  const notes = (Array.isArray(meta) ? meta : [meta]).filter(Boolean).map(note => `<p class="app-metric-note">${esc(note)}</p>`).join('');
  return `<div class="app-metric">${label ? `<p class="app-metric-label">${esc(label)}</p>` : ''}<p class="app-metric-value">${esc(value)}</p>${comparison ? `<p class="app-metric-delta"${direction ? ` data-direction="${esc(direction)}"` : ''}>${esc(comparison)}</p>` : ''}${trackMarkup}${notes}</div>`;
}
function comparisonRow(label, actual, reference, { kind = 'money', referenceLabel = 'Forecast' } = {}) {
  const a = num(actual), r = num(reference), diff = a !== null && r !== null ? a - r : null;
  const f = kind === 'percent' ? v => percent(v) : kind === 'integer' ? v => integer(v) : v => money(v, { compact: true });
  const delta = diff === null ? '—' : kind === 'percent' ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff * 100).toFixed(1)} pp` : kind === 'integer' ? integer(diff, { signed: true }) : money(diff, { compact: true, signed: true });
  return `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(label)}: ${esc(f(a))}</span><span class="app-list-row-meta">${esc(referenceLabel)} ${esc(f(r))}</span></span><span class="app-list-row-end">${esc(delta)}</span></div>`;
}
function disclosure({ kicker, title, copy = '', body }) {
  return `<article class="app-disclosure" data-disclosure><button class="app-disclosure-button" type="button" aria-expanded="false"><span class="app-disclosure-head"><span class="app-disclosure-kicker">${esc(kicker)}</span><span class="app-disclosure-title">${esc(title)}</span>${copy ? `<span class="app-disclosure-copy">${esc(copy)}</span>` : ''}</span><svg class="app-disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg></button><div class="app-disclosure-panel"><div class="app-disclosure-panel-inner">${body}</div></div></article>`;
}

function renderHero(data) {
  const fnbSource = sourceFor(data, 'fnb_xlsx'), roomsSource = sourceFor(data, 'rooms_pdf');
  const roomsCarried = Boolean(roomsSource?.metadata?.carriedForwardFromRun), pickupTo = roomsSource?.metadata?.pickupTo;
  return `<header class="app-hero"><p class="app-hero-eyebrow">Today</p><h1 class="app-hero-title">Hotel Business</h1><p class="app-hero-copy">${esc(dateLabel(data.businessDate))} · Daily operating pulse from approved F&amp;B and Rooms reports.</p></header>
  <section class="app-section"><div class="app-card app-surface"><div class="app-card-section"><div class="app-list">
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Data updated</span><span class="app-list-row-meta">${esc(data.validationStatus === 'passed_with_warnings' ? 'Validated with source warnings' : 'Validated')}</span></span><span class="app-list-row-end">${esc(dateTimeLabel(data.publishedAt || data.importedAt))}</span></div>
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">F&amp;B report</span><span class="app-list-row-meta">Revision ${esc(data.revision)}</span></span><span class="app-list-row-end">${esc(shortDateLabel(fnbSource?.detectedReportDate || data.businessDate))}</span></div>
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Rooms report</span><span class="app-list-row-meta">${esc(`${pickupTo ? `Pickup through ${shortDateLabel(pickupTo)}` : 'Approved source'}${roomsCarried ? ' · carried forward unchanged' : ''}`)}</span></span><span class="app-list-row-end">${esc(shortDateLabel(roomsSource?.detectedReportDate || data.businessDate))}</span></div>
  </div></div></div></section>`;
}
function renderGlance(data) {
  const f = data.fnb?.summary || {}, daily = f.daily || {}, mtd = f.mtd || {};
  const rooms = currentRooms(data), otb = rooms?.otb || {}, pickup = rooms?.pickup || {};
  const occDelta = rooms && num(otb.occupancy) !== null && num(rooms.forecast?.occupancy) !== null ? num(otb.occupancy) - num(rooms.forecast?.occupancy) : null;
  const adrDelta = rooms ? num(otb.adr) - num(rooms.forecast?.adr) : null;
  const revparDelta = rooms ? num(otb.revpar) - num(rooms.forecast?.revpar) : null;
  const fnbSource = sourceFor(data, 'fnb_xlsx'), roomsSource = sourceFor(data, 'rooms_pdf');
  return `<section class="app-section" id="today-glance"><p class="app-section-kicker">01 · Business pulse</p><h2 class="app-section-title">At a Glance</h2>
    <div class="app-stack">
      <div class="app-card app-surface">
        <div class="app-card-section"><p class="app-surface-label">Food &amp; Beverage · ${esc(shortDateLabel(fnbSource?.detectedReportDate || data.businessDate))}</p></div>
        <div class="app-card-section"><div class="app-metric-grid">
          ${metric({ label: 'Today Revenue', value: money(daily.revenue, { compact: true }), comparison: variance(daily.revenue, daily.forecast), direction: directionOf(num(daily.revenue) - num(daily.forecast)), track: track(daily.revenue, daily.forecast, 0) })}
          ${metric({ label: 'MTD Revenue', value: money(mtd.revenue, { compact: true }), comparison: variance(mtd.revenue, mtd.forecast), direction: directionOf(num(mtd.revenue) - num(mtd.forecast)), track: track(mtd.revenue, mtd.forecast, 1) })}
        </div></div>
      </div>
      <div class="app-card app-surface">
        <div class="app-card-section"><p class="app-surface-label">Rooms · ${esc(shortDateLabel(roomsSource?.detectedReportDate || data.businessDate))}</p></div>
        <div class="app-card-section"><div class="app-metric-grid">
          ${metric({ label: 'Occupancy OTB', value: percent(otb.occupancy), comparison: occDelta === null ? '' : `${occDelta >= 0 ? '+' : '−'}${Math.abs(occDelta * 100).toFixed(1)} pp vs forecast`, direction: directionOf(occDelta), track: track(otb.occupancy, rooms?.forecast?.occupancy, 2) })}
          ${metric({ label: 'ADR', value: money(otb.adr), comparison: rooms ? `${money(adrDelta, { compact: true, signed: true })} vs forecast` : '', direction: directionOf(adrDelta), track: track(otb.adr, rooms?.forecast?.adr, 3) })}
        </div></div>
        <div class="app-card-section"><div class="app-metric-grid">
          ${metric({ label: 'RevPAR', value: money(otb.revpar), comparison: rooms ? `${money(revparDelta, { compact: true, signed: true })} vs forecast` : '', direction: directionOf(revparDelta), track: track(otb.revpar, rooms?.forecast?.revpar, 4) })}
          ${metric({ label: '24h Pickup', value: `${integer(pickup.rns, { signed: true })} RN`, comparison: money(pickup.revenue, { compact: true, signed: true }), meta: pickup.adr ? `Pickup ADR ${money(pickup.adr)}` : '', direction: directionOf(num(pickup.rns)) })}
        </div></div>
      </div>
    </div></section>`;
}
function renderFlags(data) {
  const flags = Array.isArray(data.flags) ? data.flags : [];
  if (!flags.length) return '';
  const groups = new Map();
  for (const flag of flags) { const key = String(flag.domain || 'other').toLowerCase(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(flag); }
  const domainLabel = d => d === 'fnb' ? 'Food & Beverage' : d === 'rooms' ? 'Rooms' : d;
  return `<section class="app-section" id="today-flags"><p class="app-section-kicker">02 · Exceptions</p><h2 class="app-section-title">Needs Attention</h2><p class="app-section-lede">Rule-based exceptions from the approved daily dataset.</p>
    <div class="app-stack">${[...groups.entries()].map(([domain, items]) => `<div class="app-card app-surface"><div class="app-card-section"><p class="app-surface-label">${esc(domainLabel(domain))} · ${items.length} exception${items.length === 1 ? '' : 's'}</p></div><div class="app-card-section"><div class="app-list">${items.map(flag => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(flag.title)}</span><span class="app-list-row-meta">${esc(flag.detail)}</span></span><span class="app-list-row-end">${flag.payload?.variancePct !== undefined ? esc(percent(flag.payload.variancePct, { signed: true })) : ''}</span></div>`).join('')}</div></div></div>`).join('')}</div>
  </section>`;
}
function renderOutlet(outlet) {
  const dayparts = Array.isArray(outlet.dayparts) ? outlet.dayparts : [];
  const body = `<div>
    <div class="app-card-section"><div class="app-metric-grid">
      ${metric({ label: 'Forecast', value: num(outlet.forecast) > 0 ? money(outlet.forecast, { compact: true }) : '—' })}
      ${metric({ label: 'Covers', value: integer(outlet.covers) })}
    </div></div>
    <div class="app-card-section"><div class="app-metric-grid">
      ${metric({ label: 'Food', value: money(outlet.foodNet, { compact: true }) })}
      ${metric({ label: 'Beverage', value: money(outlet.beverageNet, { compact: true }) })}
    </div></div>${dayparts.length ? `<div class="app-card-section"><div class="app-list">${dayparts.map(day => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(day.label)}</span><span class="app-list-row-meta">${esc(integer(day.covers))} covers · Food ${esc(money(day.foodNet, { compact: true }))} · Beverage ${esc(money(day.beverageNet, { compact: true }))}</span></span><span class="app-list-row-end">${esc(money(day.revenue, { compact: true }))}</span></div>`).join('')}</div></div>` : ''}</div>`;
  return disclosure({ kicker: outlet.label, title: money(outlet.revenue, { compact: true }), copy: num(outlet.forecast) > 0 ? variance(outlet.revenue, outlet.forecast) : 'Forecast not loaded', body });
}
function renderFnb(data) {
  const s = data.fnb?.summary || {}, d = s.daily || {}, outlets = data.fnb?.outlets || [];
  return `<section class="app-section" id="today-fnb"><p class="app-section-kicker">03 · Food &amp; Beverage</p><h2 class="app-section-title">F&amp;B Today</h2><p class="app-section-lede">Daily actual against source forecast, then outlet detail on demand.</p>
    <div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">Total F&amp;B</p>${metric({ value: money(d.revenue), comparison: variance(d.revenue, d.forecast), direction: directionOf(num(d.revenue) - num(d.forecast)), track: track(d.revenue, d.forecast) })}</div>
      <div class="app-card-section"><div class="app-list">
        ${comparisonRow('Food', d.food, d.foodForecast)}
        ${comparisonRow('Beverage', d.beverage, d.beverageForecast)}
        ${comparisonRow('Other', d.other, d.otherForecast)}
        <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Discounts: ${esc(money(-Math.abs(num(d.otherDiscount) || 0), { compact: true }))}</span><span class="app-list-row-meta">Covers ${esc(integer(d.covers))}</span></span><span class="app-list-row-end">${esc(integer(d.coverForecast))} fcst</span></div>
      </div></div>
    </div>
    <h3 class="app-section-subhead">Outlet Performance</h3>
    <div class="app-stack">${outlets.map(renderOutlet).join('')}</div>
  </section>`;
}
function renderRooms(data) {
  const room = currentRooms(data); if (!room) return '';
  const o = room.otb || {}, f = room.forecast || {}, b = room.budget || {}, s = room.stly || {}, ly = room.lastYear || {}, p = room.pickup || {};
  return `<section class="app-section" id="today-rooms"><p class="app-section-kicker">04 · Rooms / Revenue</p><h2 class="app-section-title">Current Month</h2><p class="app-section-lede">${esc(dateLabel(room.stayMonth, { monthOnly: true }))} on-the-books position and 24-hour pickup.</p>
    <div class="app-stack">
      <div class="app-card app-surface">
        <div class="app-card-section"><p class="app-surface-label">Room Revenue OTB</p>${metric({ value: money(o.revenue, { compact: true }), comparison: variance(o.revenue, f.revenue), direction: directionOf(num(o.revenue) - num(f.revenue)), track: track(o.revenue, f.revenue) })}</div>
        <div class="app-card-section"><div class="app-list">
          ${comparisonRow('Occupancy', o.occupancy, f.occupancy, { kind: 'percent' })}
          ${comparisonRow('ADR', o.adr, f.adr)}
          ${comparisonRow('RevPAR', o.revpar, f.revpar)}
          ${comparisonRow('Room Nights', o.rns, f.rns, { kind: 'integer' })}
        </div></div>
      </div>
      <div class="app-card app-surface">
        <div class="app-card-section"><p class="app-surface-label">Benchmarks</p></div>
        <div class="app-card-section"><div class="app-metric-grid">
          ${metric({ label: 'Budget revenue', value: money(b.revenue, { compact: true }) })}
          ${metric({ label: 'STLY revenue', value: money(s.revenue, { compact: true }) })}
        </div></div>
        <div class="app-card-section"><div class="app-metric-grid">
          ${metric({ label: 'Last year revenue', value: money(ly.revenue, { compact: true }) })}
          ${metric({ label: '24h pickup', value: `${integer(p.rns, { signed: true })} RN`, comparison: money(p.revenue, { compact: true, signed: true }) })}
        </div></div>
      </div>
    </div>
  </section>`;
}
function renderOutlook(data) {
  const current = String(data.businessDate).slice(0, 7);
  const months = (data.rooms?.months || []).filter(item => String(item.stayMonth).slice(0, 7) > current);
  if (!months.length) return '';
  // The same anatomy as the Rooms card in At a Glance: a month is a metric
  // with its OTB occupancy as the figure, forecast as the comparison and
  // track, and revenue with pickup as the one-line note. Two months share a
  // ruled section so the card reads as a calendar, not a list of numbers.
  const monthMetric = (m, i) => {
    const occ = num(m.otb?.occupancy), forecast = num(m.forecast?.occupancy);
    const forecastLoaded = (num(m.forecast?.rns) || 0) > 0 || (num(m.forecast?.revenue) || 0) > 0;
    const delta = forecastLoaded && occ !== null && forecast !== null ? occ - forecast : null;
    return metric({
      label: dateLabel(m.stayMonth, { monthOnly: true }),
      value: percent(occ),
      comparison: delta === null ? 'Forecast not loaded' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)} pp vs forecast`,
      direction: delta === null ? 'flat' : directionOf(delta),
      meta: [`OTB ${money(m.otb?.revenue, { compact: true })}`, `24h ${integer(m.pickup?.rns, { signed: true })} RN`],
      track: forecastLoaded ? track(occ, forecast, i) : ''
    });
  };
  const pairs = [];
  for (let i = 0; i < months.length; i += 2) pairs.push(months.slice(i, i + 2).map((m, j) => monthMetric(m, i + j)));
  return `<section class="app-section" id="today-outlook"><p class="app-section-kicker">05 · Forward outlook</p><h2 class="app-section-title">Next Months</h2><p class="app-section-lede">OTB position against forecast; detailed market segments stay collapsed below.</p>
    <div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">Rooms · occupancy on the books</p></div>
      ${pairs.map(pair => `<div class="app-card-section"><div class="app-metric-grid">${pair.join('')}</div></div>`).join('')}
    </div>
  </section>`;
}
function renderSegments(data) {
  const current = String(data.businessDate).slice(0, 7);
  const keys = new Set(['transient', 'corporate', 'wholesale', 'package', 'pnp_disc', 'group', 'airline_crew']);
  const segments = (data.rooms?.segments || []).filter(s => String(s.stayMonth).slice(0, 7) === current && keys.has(s.key));
  if (!segments.length) return '';
  const body = `<div class="app-list">${segments.map(s => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(s.label)}: ${esc(integer(s.otb?.rns))} RN</span><span class="app-list-row-meta">Forecast ${esc(money(s.forecast?.revenue, { compact: true }))} · 24h ${esc(integer(s.pickup?.rns, { signed: true }))} RN</span></span><span class="app-list-row-end">${esc(money(s.otb?.revenue, { compact: true }))}</span></div>`).join('')}</div>`;
  return `<section class="app-section" id="today-segments"><p class="app-section-kicker">06 · Market mix</p><h2 class="app-section-title">Market Segment Detail</h2><p class="app-section-lede">Source hierarchy retained; headline segment detail is collapsed by default.</p>
    ${disclosure({ kicker: 'Current month', title: 'Open segment mix', copy: `${segments.length} headline segments`, body })}
  </section>`;
}
function renderNotes(data) {
  const notes = data.fnb?.notes || [], groups = new Map();
  for (const note of notes) { if (!groups.has(note.outletKey)) groups.set(note.outletKey, { key: note.outletKey, label: note.outlet, items: [] }); groups.get(note.outletKey).items.push(note); }
  if (!groups.size) return '';
  return `<section class="app-section" id="today-notes"><p class="app-section-kicker">07 · Daily operations</p><h2 class="app-section-title">Operations Notes</h2><p class="app-section-lede">Original hotel comments, grouped by outlet and daypart.</p>
    <div class="app-stack">${[...groups.values()].map(group => disclosure({ kicker: 'Outlet', title: group.label, copy: `${group.items.length} note${group.items.length === 1 ? '' : 's'}`, body: `<div class="app-prose">${group.items.map(note => `<p><strong>${esc(note.daypart)}</strong> — ${esc(note.displayText)}</p>`).join('')}</div>` })).join('')}</div>
  </section>`;
}
function renderSources(data) {
  return `<section class="app-section"><p class="app-note">Updated ${esc(dateTimeLabel(data.publishedAt || data.importedAt))} · revision ${esc(data.revision)} · ${(data.sources || []).map(source => esc(source.filename)).join(' · ')}</p>
    <div class="app-utility-row">
      <button class="app-utility-action" type="button" data-today-retry><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.3-4.2M16 10a6 6 0 0 1-10.3 4.2M14.5 3v3h-3M5.5 17v-3h3"/></svg>Refresh</button>
      <button class="app-utility-action" type="button" data-today-top><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5 9l5-5 5 5"/></svg>Back to top</button>
    </div></section>`;
}
function render(data) {
  return `${renderHero(data)}${renderGlance(data)}${renderFlags(data)}${renderFnb(data)}${renderRooms(data)}${renderOutlook(data)}${renderSegments(data)}${renderNotes(data)}${renderSources(data)}`;
}

function skeletonMarkup() {
  const card = () => `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;
  return `<header class="app-hero"><p class="app-hero-eyebrow">Today</p><h1 class="app-hero-title">Hotel Business</h1><p class="app-hero-copy">Loading the latest approved daily business report…</p></header>
  <section class="app-section"><div class="app-stack">
    <div class="app-metric-grid">${Array.from({ length: 4 }, card).join('')}</div>
    <div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-block"></div></div></div>
    <div class="app-state app-card" data-tone="loading"><p class="app-state-label">Loading</p><p class="app-state-title">Loading today's approved business data…</p></div>
  </div></section>`;
}
function errorMarkup(error) {
  const unauthorized = error?.status === 401 || error?.status === 403;
  const message = unauthorized
    ? 'Sign in again to see today\'s report.'
    : (error?.message || 'Check the connection and try again.');
  return `<header class="app-hero"><p class="app-hero-eyebrow">Today</p><h1 class="app-hero-title">Hotel Business</h1><p class="app-hero-copy">Today\'s numbers aren\'t available right now.</p></header>
  <section class="app-section"><div class="app-stack">
    <div class="app-state app-card" data-tone="error"><p class="app-state-label">Error</p><p class="app-state-title">Couldn\'t load today\'s report</p><p class="app-state-copy">${esc(message)}</p></div>
    <div class="app-row"><button class="app-primary app-control" type="button" data-today-retry>Try again</button></div>
  </div></section>`;
}

async function refresh(host, { force = false, alive = () => true } = {}) {
  host.innerHTML = skeletonMarkup();
  try {
    const data = await loadBusinessDashboard({ force });
    if (!alive()) return;
    host.innerHTML = render(data);
    // Tracks draw themselves in after first paint; reduced motion arrives drawn.
    delete host.dataset.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (alive()) host.dataset.ready = 'true'; }));
  } catch (error) {
    if (alive()) host.innerHTML = errorMarkup(error);
  }
}

export async function mountToday(host) {
  host.innerHTML = skeletonMarkup();
  // The shell has no sign-in UI of its own yet - this only recognizes a
  // session that already exists in localStorage (e.g. from signing into the
  // live app in this same browser), the same way every other authenticated
  // route already does. It never lowers what the RPC itself requires.
  await initAuth();
  let disposed = false;
  const alive = () => !disposed;
  refresh(host, { force: false, alive });
  const onClick = event => {
    if (event.target.closest('[data-today-retry]')) { refresh(host, { force: true, alive }); return; }
    if (event.target.closest('[data-today-top]')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    const button = event.target.closest('.app-disclosure-button');
    if (!button) return;
    const root = button.closest('[data-disclosure]');
    if (!root) return;
    const open = root.dataset.open === 'true';
    root.dataset.open = String(!open);
    button.setAttribute('aria-expanded', String(!open));
  };
  host.addEventListener('click', onClick);
  // The shell calls this when it routes away, so a report that answers late
  // never paints over the next view.
  return () => { disposed = true; host.removeEventListener('click', onClick); delete host.dataset.ready; };
}
