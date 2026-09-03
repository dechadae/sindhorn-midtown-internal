/* Today, rebuilt on the UI Library. Mirrors the live business dashboard's
   content 1:1 (hero, At a Glance, exceptions, F&B, Rooms, outlook, market
   segments, operations notes) - only the markup changed, from bd-* classes
   and business-dashboard.css to library primitives and nothing else.

   business-dashboard-data.js is reused unmodified: it already fetches
   sindhorn_business_dashboard_read_model correctly and is not route markup.
   The formatting helpers below are deliberately a fresh, small copy rather
   than an import from business-dashboard.js - that file is the still-live
   legacy route, and this rebuild does not patch or depend on route code it
   is replacing.

   That RPC requires an authenticated session. This shell has none yet (auth
   returns in a later phase), so today a fresh visitor sees the real error
   state below, not a fake success - which is the correct behaviour, not a
   bug to route around. */
import { loadBusinessDashboard } from './business-dashboard-data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const directionOf = delta => delta === null || delta === undefined || Number.isNaN(delta) ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

function money(value, { compact = false, signed = false } = {}) {
  const n = num(value);
  if (n === null) return '—';
  const abs = Math.abs(n), sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  let body;
  if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace(/\.0+$/, '')}M`;
  else if (compact && abs >= 100_000) body = `${Math.round(abs / 1000)}K`;
  else body = Math.round(abs).toLocaleString('en-US');
  return `${sign}฿${body}`;
}
function integer(value, { signed = false } = {}) {
  const n = num(value); if (n === null) return '—';
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
function percent(value, { signed = false, digits = 1 } = {}) {
  const n = num(value); if (n === null) return '—';
  const p = n * 100, sign = p < 0 ? '−' : signed && p > 0 ? '+' : '';
  return `${sign}${Math.abs(p).toFixed(digits)}%`;
}
function dateLabel(value, { monthOnly = false } = {}) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(d.valueOf())) return String(value || '');
  return new Intl.DateTimeFormat('en-GB', monthOnly ? { month: 'short', year: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(d);
}
function shortDateLabel(value) {
  const raw = String(value || '').slice(0, 10);
  const d = new Date(`${raw}T00:00:00+07:00`);
  if (Number.isNaN(d.valueOf())) return String(value || '');
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(d);
}
function dateTimeLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return String(value || '');
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }).format(d);
  return `${date} · ${time} ICT`;
}
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

function metric({ label, value, comparison = '', meta = '', direction = null }) {
  return `<div class="app-metric"><p class="app-metric-label">${esc(label)}</p><p class="app-metric-value">${esc(value)}</p>${comparison ? `<p class="app-metric-delta"${direction ? ` data-direction="${esc(direction)}"` : ''}>${esc(comparison)}</p>` : ''}${meta ? `<p class="app-metric-note">${esc(meta)}</p>` : ''}</div>`;
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
  <div class="app-card app-surface"><div class="app-list">
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Data updated</span><span class="app-list-row-meta">${esc(data.validationStatus === 'passed_with_warnings' ? 'Validated with source warnings' : 'Validated')}</span></span><span class="app-list-row-end">${esc(dateTimeLabel(data.publishedAt || data.importedAt))}</span></div>
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">F&amp;B report</span><span class="app-list-row-meta">Revision ${esc(data.revision)}</span></span><span class="app-list-row-end">${esc(shortDateLabel(fnbSource?.detectedReportDate || data.businessDate))}</span></div>
    <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Rooms report</span><span class="app-list-row-meta">${esc(`${pickupTo ? `Pickup through ${shortDateLabel(pickupTo)}` : 'Approved source'}${roomsCarried ? ' · carried forward unchanged' : ''}`)}</span></span><span class="app-list-row-end">${esc(shortDateLabel(roomsSource?.detectedReportDate || data.businessDate))}</span></div>
  </div></div>`;
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
      <div class="app-card app-surface"><p class="app-surface-label">Food &amp; Beverage · ${esc(shortDateLabel(fnbSource?.detectedReportDate || data.businessDate))}</p><div class="app-metric-grid">
        ${metric({ label: 'Today Revenue', value: money(daily.revenue, { compact: true }), comparison: variance(daily.revenue, daily.forecast), direction: directionOf(num(daily.revenue) - num(daily.forecast)) })}
        ${metric({ label: 'MTD Revenue', value: money(mtd.revenue, { compact: true }), comparison: variance(mtd.revenue, mtd.forecast), direction: directionOf(num(mtd.revenue) - num(mtd.forecast)) })}
      </div></div>
      <div class="app-card app-surface"><p class="app-surface-label">Rooms · ${esc(shortDateLabel(roomsSource?.detectedReportDate || data.businessDate))}</p><div class="app-metric-grid">
        ${metric({ label: 'Occupancy OTB', value: percent(otb.occupancy), comparison: occDelta === null ? '' : `${occDelta >= 0 ? '+' : '−'}${Math.abs(occDelta * 100).toFixed(1)} pp vs forecast`, direction: directionOf(occDelta) })}
        ${metric({ label: 'ADR', value: money(otb.adr), comparison: rooms ? `${money(adrDelta, { compact: true, signed: true })} vs forecast` : '', direction: directionOf(adrDelta) })}
        ${metric({ label: 'RevPAR', value: money(otb.revpar), comparison: rooms ? `${money(revparDelta, { compact: true, signed: true })} vs forecast` : '', direction: directionOf(revparDelta) })}
        ${metric({ label: '24h Pickup', value: `${integer(pickup.rns, { signed: true })} RN`, comparison: money(pickup.revenue, { compact: true, signed: true }), meta: pickup.adr ? `Pickup ADR ${money(pickup.adr)}` : '', direction: directionOf(num(pickup.rns)) })}
      </div></div>
    </div></section>`;
}
function renderFlags(data) {
  const flags = Array.isArray(data.flags) ? data.flags : [];
  if (!flags.length) return '';
  const groups = new Map();
  for (const flag of flags) { const key = String(flag.domain || 'other').toLowerCase(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(flag); }
  const domainLabel = d => d === 'fnb' ? 'Food & Beverage' : d === 'rooms' ? 'Rooms' : d;
  return `<section class="app-section" id="today-flags"><p class="app-section-kicker">02 · Exceptions</p><h2 class="app-section-title">Needs Attention</h2><p class="app-section-lede">Rule-based exceptions from the approved daily dataset.</p>
    <div class="app-stack">${[...groups.entries()].map(([domain, items]) => `<div class="app-card app-surface"><p class="app-surface-label">${esc(domainLabel(domain))} · ${items.length} exception${items.length === 1 ? '' : 's'}</p><div class="app-list">${items.map(flag => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(flag.title)}</span><span class="app-list-row-meta">${esc(flag.detail)}</span></span><span class="app-list-row-end">${flag.payload?.variancePct !== undefined ? esc(percent(flag.payload.variancePct, { signed: true })) : ''}</span></div>`).join('')}</div></div>`).join('')}</div>
  </section>`;
}
function renderOutlet(outlet) {
  const dayparts = Array.isArray(outlet.dayparts) ? outlet.dayparts : [];
  const body = `<div class="app-metric-grid">
      ${metric({ label: 'Forecast', value: num(outlet.forecast) > 0 ? money(outlet.forecast, { compact: true }) : '—' })}
      ${metric({ label: 'Covers', value: integer(outlet.covers) })}
      ${metric({ label: 'Food', value: money(outlet.foodNet, { compact: true }) })}
      ${metric({ label: 'Beverage', value: money(outlet.beverageNet, { compact: true }) })}
    </div>${dayparts.length ? `<div class="app-list">${dayparts.map(day => `<div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">${esc(day.label)}</span><span class="app-list-row-meta">${esc(integer(day.covers))} covers · Food ${esc(money(day.foodNet, { compact: true }))} · Beverage ${esc(money(day.beverageNet, { compact: true }))}</span></span><span class="app-list-row-end">${esc(money(day.revenue, { compact: true }))}</span></div>`).join('')}</div>` : ''}`;
  return disclosure({ kicker: outlet.label, title: money(outlet.revenue, { compact: true }), copy: num(outlet.forecast) > 0 ? variance(outlet.revenue, outlet.forecast) : 'Forecast not loaded', body });
}
function renderFnb(data) {
  const s = data.fnb?.summary || {}, d = s.daily || {}, outlets = data.fnb?.outlets || [];
  return `<section class="app-section" id="today-fnb"><p class="app-section-kicker">03 · Food &amp; Beverage</p><h2 class="app-section-title">F&amp;B Today</h2><p class="app-section-lede">Daily actual against source forecast, then outlet detail on demand.</p>
    <div class="app-card app-surface"><p class="app-surface-label">Total F&amp;B</p><p class="app-metric-value">${esc(money(d.revenue))}</p><p class="app-metric-delta" data-direction="${esc(directionOf(num(d.revenue) - num(d.forecast)))}">${esc(variance(d.revenue, d.forecast))}</p>
      <div class="app-list">
        ${comparisonRow('Food', d.food, d.foodForecast)}
        ${comparisonRow('Beverage', d.beverage, d.beverageForecast)}
        ${comparisonRow('Other', d.other, d.otherForecast)}
        <div class="app-list-row"><span class="app-list-row-main"><span class="app-list-row-title">Discounts: ${esc(money(-Math.abs(num(d.otherDiscount) || 0), { compact: true }))}</span><span class="app-list-row-meta">Covers ${esc(integer(d.covers))}</span></span><span class="app-list-row-end">${esc(integer(d.coverForecast))} fcst</span></div>
      </div></div>
    <p class="app-note">Outlet Performance</p>
    <div class="app-stack">${outlets.map(renderOutlet).join('')}</div>
  </section>`;
}
function renderRooms(data) {
  const room = currentRooms(data); if (!room) return '';
  const o = room.otb || {}, f = room.forecast || {}, b = room.budget || {}, s = room.stly || {}, ly = room.lastYear || {}, p = room.pickup || {};
  return `<section class="app-section" id="today-rooms"><p class="app-section-kicker">04 · Rooms / Revenue</p><h2 class="app-section-title">Current Month</h2><p class="app-section-lede">${esc(dateLabel(room.stayMonth, { monthOnly: true }))} on-the-books position and 24-hour pickup.</p>
    <div class="app-card app-surface"><p class="app-surface-label">Room Revenue OTB</p><p class="app-metric-value">${esc(money(o.revenue, { compact: true }))}</p><p class="app-metric-delta" data-direction="${esc(directionOf(num(o.revenue) - num(f.revenue)))}">${esc(variance(o.revenue, f.revenue))}</p>
      <div class="app-list">
        ${comparisonRow('Occupancy', o.occupancy, f.occupancy, { kind: 'percent' })}
        ${comparisonRow('ADR', o.adr, f.adr)}
        ${comparisonRow('RevPAR', o.revpar, f.revpar)}
        ${comparisonRow('Room Nights', o.rns, f.rns, { kind: 'integer' })}
      </div></div>
    <div class="app-card app-surface"><div class="app-metric-grid">
      ${metric({ label: 'Budget revenue', value: money(b.revenue, { compact: true }) })}
      ${metric({ label: 'STLY revenue', value: money(s.revenue, { compact: true }) })}
      ${metric({ label: 'Last year revenue', value: money(ly.revenue, { compact: true }) })}
      ${metric({ label: '24h pickup', value: `${integer(p.rns, { signed: true })} RN`, comparison: money(p.revenue, { compact: true, signed: true }) })}
    </div></div>
  </section>`;
}
function renderOutlook(data) {
  const current = String(data.businessDate).slice(0, 7);
  const months = (data.rooms?.months || []).filter(item => String(item.stayMonth).slice(0, 7) > current);
  if (!months.length) return '';
  return `<section class="app-section" id="today-outlook"><p class="app-section-kicker">05 · Forward outlook</p><h2 class="app-section-title">Next Months</h2><p class="app-section-lede">OTB position against forecast; detailed market segments stay collapsed below.</p>
    <div class="app-metric-grid">${months.map(m => {
      const forecastLoaded = (num(m.forecast?.rns) || 0) > 0 || (num(m.forecast?.revenue) || 0) > 0;
      return `<div class="app-card app-surface"><p class="app-surface-label">${esc(dateLabel(m.stayMonth, { monthOnly: true }))}</p><p class="app-metric-value">${esc(percent(m.otb?.occupancy))}</p><p class="app-metric-note">${forecastLoaded ? `${esc(percent(m.forecast?.occupancy))} forecast occupancy` : 'Forecast not loaded'}</p><p class="app-metric-note">OTB ${esc(money(m.otb?.revenue, { compact: true }))} · 24h ${esc(integer(m.pickup?.rns, { signed: true }))} RN</p></div>`;
    }).join('')}</div>
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
  return `<p class="app-note">Updated ${esc(dateTimeLabel(data.publishedAt || data.importedAt))} · revision ${esc(data.revision)} · ${(data.sources || []).map(source => esc(source.filename)).join(' · ')}</p>`;
}
function render(data) {
  return `${renderHero(data)}${renderGlance(data)}${renderFlags(data)}${renderFnb(data)}${renderRooms(data)}${renderOutlook(data)}${renderSegments(data)}${renderNotes(data)}${renderSources(data)}`;
}

function skeletonMarkup() {
  const card = () => `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;
  return `<header class="app-hero"><p class="app-hero-eyebrow">Today</p><h1 class="app-hero-title">Hotel Business</h1><p class="app-hero-copy">Loading the latest approved daily business report…</p></header>
  <div class="app-metric-grid">${Array.from({ length: 4 }, card).join('')}</div>
  <div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-block"></div></div></div>
  <div class="app-state app-card" data-tone="loading"><p class="app-state-label">Loading</p><p class="app-state-title">Loading today's approved business data…</p></div>`;
}
function errorMarkup(error) {
  const unauthorized = error?.status === 401 || error?.status === 403;
  const message = unauthorized
    ? 'Sign-in has not returned to this shell yet, so the approved report cannot be verified as yours to see.'
    : (error?.message || 'Try again when the connection is available.');
  return `<header class="app-hero"><p class="app-hero-eyebrow">Today</p><h1 class="app-hero-title">Hotel Business</h1><p class="app-hero-copy">Daily business data is temporarily unavailable.</p></header>
  <div class="app-state app-card" data-tone="error"><p class="app-state-label">Error</p><p class="app-state-title">Unable to load the approved report</p><p class="app-state-copy">${esc(message)}</p></div>
  <div class="app-row"><button class="app-primary app-control" type="button" data-today-retry>Try again</button></div>`;
}

async function refresh(host, { force = false } = {}) {
  host.innerHTML = skeletonMarkup();
  try {
    const data = await loadBusinessDashboard({ force });
    host.innerHTML = render(data);
  } catch (error) {
    host.innerHTML = errorMarkup(error);
  }
}

export function mountToday(host) {
  refresh(host, { force: false });
  host.addEventListener('click', event => {
    if (event.target.closest('[data-today-retry]')) { refresh(host, { force: true }); return; }
    const button = event.target.closest('.app-disclosure-button');
    if (!button) return;
    const root = button.closest('[data-disclosure]');
    if (!root) return;
    const open = root.dataset.open === 'true';
    root.dataset.open = String(!open);
    button.setAttribute('aria-expanded', String(!open));
  });
}
