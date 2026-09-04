/* F&B Promotions, rebuilt on the UI Library. Mirrors the live route's content
   1:1 - the promotion index with its outlet and month filters and artwork
   progress, and the detail with brief, copy and per-outlet artwork checklist,
   folder links, sharing and the shared completion status - in library
   primitives and nothing else. No fnb-* class, no stylesheet of its own.

   fnb-read-model.js is the data; this file is the markup and behaviour. The
   route is addressed by hash so the browser's back button works between the
   index and a detail: #fnb, #fnb/<promotion-id>. */
import { initAuth } from './auth-client.js';
import { loadFnbPromotions, readArtworkStatus, writeArtworkStatus, isArtworkEditor, readLocalLinks, writeLocalLinks, safeFolderUrl, parseUpdated } from './fnb-read-model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const OUTLET_ORDER = ['ANJU', "Bangkok'78", 'Sip & Co.', 'Horizon Pool Bar', 'The Lobby Lounge', 'In-room Dining'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SECTIONS = [['overview', 'Overview'], ['brief', 'Brief'], ['copy', 'Copy'], ['artwork', 'Artwork']];
const SHARE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M7 6l3-3 3 3M5 11v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4"/></svg>';
const FOLDER_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h5l2 2h7v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13l-1.5 1.5a2.5 2.5 0 0 1-3.5-3.5L4.5 8.5a2.5 2.5 0 0 1 3.5 0M13 7l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L15.5 11.5a2.5 2.5 0 0 1-3.5 0"/></svg>';

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()), map = {};
  parts.forEach(part => { map[part.type] = part.value; });
  return new Date(`${map.year}-${map.month}-${map.day}T00:00:00+07:00`);
}
function status(campaign, today) {
  const start = new Date(`${campaign.start}T00:00:00+07:00`), end = new Date(`${campaign.end}T23:59:59+07:00`);
  return today < start ? 'upcoming' : today <= end ? 'live' : 'ended';
}
function relative(campaign, today) {
  const start = new Date(`${campaign.start}T00:00:00+07:00`), days = Math.ceil((start - today) / 86400000);
  if (days > 1) return `Starts in ${days} days`;
  if (days === 1) return 'Starts tomorrow';
  if (days === 0) return 'Starts today';
  return today <= new Date(`${campaign.end}T23:59:59+07:00`) ? 'Live now' : 'Ended';
}
const statusLabel = value => value === 'live' ? 'Live' : value === 'ended' ? 'Ended' : 'Upcoming';
const statusTone = value => value === 'live' ? 'success' : value === 'ended' ? 'quiet' : null;
const toneAttr = value => statusTone(value) ? ` data-tone="${statusTone(value)}"` : '';
const outletsOf = campaign => campaign.activations.map(a => a.outlet).join(' + ');
function uniqueValue(values, fallback = 'Varies by outlet') { const unique = [...new Set(values)]; return unique.length === 1 ? unique[0] : fallback; }
function updatedLabel(value, { withTime = true } = {}) {
  const date = parseUpdated(value); if (!date) return '';
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  if (!withTime) return day;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: 'numeric', minute: '2-digit', hour12: true }).format(date).toLowerCase();
  return `${day} · ${time}`;
}
// The month filter and the hero's period both come from the dataset's span,
// so a new season needs no code change.
function monthsSpanned(promotions) {
  let min = null, max = null;
  for (const p of promotions) { if (!min || p.start < min) min = p.start; if (!max || p.end > max) max = p.end; }
  if (!min) return [];
  const out = []; let [y, m] = [Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1];
  const [ey, em] = [Number(max.slice(0, 4)), Number(max.slice(5, 7)) - 1];
  while (y < ey || (y === ey && m <= em)) { out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: MONTH_NAMES[m].slice(0, 3), year: y, month: m }); if (++m > 11) { m = 0; y++; } }
  return out;
}
function periodLabel(months) {
  if (!months.length) return '';
  const first = months[0], last = months[months.length - 1];
  if (first.year === last.year) return first === last ? `${MONTH_NAMES[first.month]} ${first.year}` : `${MONTH_NAMES[first.month]} – ${MONTH_NAMES[last.month]} ${first.year}`;
  return `${MONTH_NAMES[first.month]} ${first.year} – ${MONTH_NAMES[last.month]} ${last.year}`;
}
function inMonth(campaign, entry) {
  if (!entry) return true;
  const from = `${entry.key}-01`, to = `${entry.key}-31`;
  return campaign.start <= to && campaign.end >= from;
}
function outletsIn(promotions) {
  const seen = new Set(promotions.flatMap(p => p.activations.map(a => a.outlet)));
  return [...OUTLET_ORDER.filter(o => seen.has(o)), ...[...seen].filter(o => !OUTLET_ORDER.includes(o))];
}

/* ---- markup ------------------------------------------------------------- */
function track(done, total) {
  const width = total ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  return `<svg class="app-track" aria-hidden="true"><rect class="app-track-rail" x="0" y="3.5" width="100%" height="3" rx="1.5"/><rect class="app-track-bar" x="0" y="3.5" width="${width}%" height="3" rx="1.5"/></svg>`;
}
function select(kind, label, options, selected) {
  return `<div class="app-select" data-select="${kind}">
    <span class="app-select-label">${esc(label)}</span>
    <button class="app-select-trigger app-control" type="button" aria-haspopup="listbox" aria-expanded="false"><span data-select-value>${esc(options.find(o => o.value === selected)?.label || '')}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg></button>
    <div class="app-select-menu app-overlay" role="listbox">${options.map(o => `<button class="app-select-option" type="button" role="option" aria-selected="${o.value === selected}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div>
  </div>`;
}
function metric(label, value) {
  return `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value)}</span></div>`;
}
const fact = metric;
function shareButton(kind, id = '') {
  return `<button class="app-utility-action" type="button" data-share="${kind}"${id ? ` data-id="${esc(id)}"` : ''} aria-label="${kind === 'page' ? 'Share F&amp;B promotions' : 'Share this promotion'}">${SHARE_ICON}Share</button>`;
}
function copyBlock(label, text, lang = '') {
  const langAttr = lang ? ` lang="${lang}"` : '';
  if (!text) return `<div class="app-card app-surface">${label ? `<p class="app-surface-label">${esc(label)}</p>` : ''}<div class="app-surface-copy"${langAttr}>${lang === 'th' ? 'Thai copy was not supplied in the source workbook.' : 'Not supplied in the source workbook.'}</div></div>`;
  const long = text.length > 380 || text.split('\n').length > 8;
  const prose = `<div class="app-prose" data-verbatim="true"${langAttr}><p>${esc(text)}</p></div>`;
  return `<div class="app-card app-surface">${label ? `<p class="app-surface-label">${esc(label)}</p>` : ''}${long ? `<div class="app-clamp" data-clamp>${prose}</div><button class="app-chip app-control" type="button" data-scale="control" data-clamp-toggle aria-expanded="false">Show full</button>` : prose}</div>`;
}
function heroMarkup(copy, { action = '', note = '' } = {}) {
  return `<header class="app-hero"><div class="app-hero-head"><p class="app-hero-eyebrow">Food &amp; Beverage</p>${action}</div><h1 class="app-hero-title">Promotions</h1><p class="app-hero-copy">${copy}</p>${note}</header>`;
}
/* The skeleton is the page with its text taken out: the same hero, strip,
   filters and card anatomy, so nothing moves when the data lands. */
const line = (width = '', size = '') => `<div class="app-skeleton-line"${width ? ` data-width="${width}"` : ''}${size ? ` data-size="${size}"` : ''}></div>`;
function skeletonCard() {
  return `<article class="app-action-card"><div class="app-skeleton" data-gap="tight">
    <div class="app-action-card-head">${line('tiny')}${line('tiny')}</div>
    ${line('medium', 'lead')}${line('half')}${line('short')}
    <div class="app-action-card-meta">${line('tiny')}${line('tiny')}</div>${line('', 'track')}${line('')}
  </div><div class="app-action-card-actions">${line('short')}${line('tiny')}</div></article>`;
}
function skeletonMarkup() {
  const metric = () => `<div class="app-metric"><div class="app-skeleton" data-gap="tight">${line('medium')}${line('short', 'lead')}</div></div>`;
  return `${heroMarkup('Loading this season’s promotions…', { action: shareButton('page'), note: '<p class="app-note">Checking for the latest update…</p>' })}
  <section class="app-section" aria-busy="true">
    <div class="app-metric-grid" data-columns="3" data-values="text" data-rule="true">${metric()}${metric()}${metric()}</div>
    <div class="app-row"><div class="app-skeleton">${line('short')}${line('', 'control')}</div><div class="app-skeleton">${line('short')}${line('', 'control')}</div></div>
    <h3 class="app-section-subhead">Promotions</h3>
    <div class="app-stack">${skeletonCard()}${skeletonCard()}${skeletonCard()}</div>
  </section>`;
}
function detailSkeletonMarkup() {
  const fact = () => `<div class="app-metric"><div class="app-skeleton" data-gap="tight">${line('medium')}${line('short', 'lead')}</div></div>`;
  const block = () => `<div class="app-card app-surface"><div class="app-skeleton">${line('tiny')}${line('')}${line('')}${line('medium')}</div></div>`;
  return `<header class="app-hero"><div class="app-hero-head"><button class="app-back-control app-control" type="button" data-back aria-label="Back to promotions"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg></button></div>
    <div class="app-skeleton"><div class="app-skeleton-line" data-width="tiny"></div><div class="app-skeleton-line" data-width="medium" data-size="title"></div><div class="app-skeleton-line" data-width="half" data-size="lead"></div></div></header>
  <nav class="app-rail" aria-label="Promotion sections" aria-busy="true">${SECTIONS.map(([id, label], i) => `<span class="app-chip app-control${i === 0 ? ' is-active' : ''}">${label}</span>`).join('')}</nav>
  <section class="app-section" aria-busy="true"><div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${fact()}${fact()}${fact()}${fact()}</div></section>
  <section class="app-section"><p class="app-section-kicker">01 · Promotion brief</p><div class="app-stack">${block()}</div></section>
  <section class="app-section"><p class="app-section-kicker">02 · Copy</p><div class="app-stack">${block()}${block()}</div></section>`;
}
function errorMarkup(error) {
  return `${heroMarkup('Promotions are temporarily unavailable.')}<section class="app-section"><div class="app-stack">
    <div class="app-state app-card" data-tone="error"><p class="app-state-label">Error</p><p class="app-state-title">Could not load promotions</p><p class="app-state-copy">${esc(error?.message || 'The F&B dataset did not answer and nothing is saved on this device yet.')}</p></div>
    <div class="app-utility-row"><button class="app-utility-action" type="button" data-retry><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.3-4.2M16 10a6 6 0 0 1-10.3 4.2M14.5 3v3h-3M5.5 17v-3h3"/></svg>Try again</button></div>
  </div></section>`;
}

export async function mountFnb(host) {
  host.innerHTML = /^#fnb\/./.test(location.hash) ? detailSkeletonMarkup() : skeletonMarkup();
  await initAuth();
  const today = bangkokToday();
  const editor = isArtworkEditor();
  let promotions = [], source = '', updatedAt = null, months = [], outlets = [];
  let done = new Set();
  let filter = 'ALL', month = 'ALL', indexScroll = 0;
  let links = readLocalLinks();
  const openActivations = new Set();
  let disposed = false, spyRaf = 0, toastTimer = 0;

  const q = selector => host.querySelector(selector);
  const qa = selector => [...host.querySelectorAll(selector)];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const currentId = () => decodeURIComponent((location.hash.match(/^#fnb\/(.+)$/) || [])[1] || '');
  const linkFor = activation => Object.prototype.hasOwnProperty.call(links, activation.id) ? links[activation.id] : activation.artworkUrl;
  const folderLinks = campaign => {
    const seen = new Set(), out = [];
    for (const a of campaign.activations) { const url = safeFolderUrl(linkFor(a)); if (url && !seen.has(url)) { seen.add(url); out.push({ outlet: a.outlet, url }); } }
    return out;
  };
  const visible = (campaign, respectFilter) => campaign.activations.filter(a => !respectFilter || filter === 'ALL' || a.outlet === filter);
  const counts = (campaign, respectFilter) => {
    let total = 0, n = 0;
    for (const a of visible(campaign, respectFilter)) for (const x of a.artworks) { total++; if (done.has(String(x.id))) n++; }
    return { done: n, total };
  };
  const filtered = () => promotions.filter(c => (filter === 'ALL' || c.activations.some(a => a.outlet === filter)) && inMonth(c, months.find(m => m.key === month)));

  function toast(message) {
    let el = q('[data-toast]');
    if (!el) { el = document.createElement('div'); el.className = 'app-toast app-overlay'; el.dataset.toast = 'true'; el.setAttribute('role', 'status'); host.append(el); }
    el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function revealTracks() {
    delete host.dataset.trackReady;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!disposed) host.dataset.trackReady = 'true'; }));
  }

  /* ---- index ------------------------------------------------------------ */
  function cardMarkup(campaign) {
    const n = counts(campaign, true), s = status(campaign, today), folders = folderLinks(campaign);
    const folder = folders.length === 1
      ? `<a class="app-utility-action" href="${esc(folders[0].url)}" target="_blank" rel="noopener" aria-label="Open artwork folder for ${esc(campaign.title)}">${FOLDER_ICON}Artwork folder</a>`
      : folders.length ? `<button class="app-utility-action" type="button" data-folders="${esc(campaign.id)}">${FOLDER_ICON}Artwork folders</button>` : '';
    return `<article class="app-action-card"${toneAttr(s)}>
      <button class="app-action-card-button" type="button" data-promotion="${esc(campaign.id)}">
        <span class="app-action-card-head"><span class="app-action-card-status"${toneAttr(s)}>${statusLabel(s)}</span><span class="app-action-card-date">${esc(relative(campaign, today))}</span></span>
        <span class="app-action-card-title">${esc(campaign.title)}</span>
        <span class="app-action-card-copy">${esc(outletsOf(campaign))}</span>
        <span class="app-action-card-when">${esc(campaign.dateLabel)}</span>
        <span class="app-action-card-meta"><span>Artwork</span><b>${n.done} / ${n.total}</b></span>
        ${track(n.done, n.total)}
        <span class="app-action-card-foot"><span>${esc(campaign.summary)}</span>${CHEVRON}</span>
      </button>
      <div class="app-action-card-actions">${folder}${shareButton('promotion', campaign.id)}</div>
    </article>`;
  }
  function indexMarkup() {
    const list = filtered();
    let total = 0, n = 0, live = 0;
    for (const c of list) { const k = counts(c, true); total += k.total; n += k.done; if (status(c, today) === 'live') live++; }
    const note = source === 'cache' ? '<p class="app-note">Offline · showing the last saved promotions</p>' : updatedAt ? `<p class="app-note">Updated ${esc(updatedLabel(updatedAt))}</p>` : '';
    const outletOptions = [{ value: 'ALL', label: 'All outlets' }, ...outlets.map(o => ({ value: o, label: o }))];
    const monthOptions = [{ value: 'ALL', label: 'All months' }, ...months.map(m => ({ value: m.key, label: m.label }))];
    return `${heroMarkup(esc(periodLabel(months)), { action: shareButton('page'), note })}
    <section class="app-section">
      <div class="app-metric-grid" data-columns="3" data-values="text" data-rule="true">${metric('Promotions', list.length)}${metric('Live now', live)}${metric('Artwork done', `${n}/${total}`)}</div>
      <div class="app-row">${select('outlet', 'Outlet', outletOptions, filter)}${select('month', 'Month', monthOptions, month)}</div>
      <h3 class="app-section-subhead">${list.length === 1 ? '1 promotion' : `${list.length} promotions`}</h3>
      <div class="app-stack">${list.length ? list.map(cardMarkup).join('') : '<div class="app-state app-card" data-tone="empty"><p class="app-state-label">Empty</p><p class="app-state-title">No promotions match these filters</p><p class="app-state-copy">Choose another outlet or month.</p></div>'}</div>
    </section>`;
  }

  /* ---- detail ----------------------------------------------------------- */
  function activationMarkup(activation) {
    const total = activation.artworks.length; if (!total) return '';
    const n = activation.artworks.filter(x => done.has(String(x.id))).length, open = openActivations.has(activation.id);
    return `<article class="app-disclosure" data-disclosure data-activation="${esc(activation.id)}"${open ? ' data-open="true"' : ''}${n === total ? ' data-tone="success"' : ''}>
      <button class="app-disclosure-button" type="button" aria-expanded="${open}">
        <span class="app-disclosure-head"><span class="app-disclosure-title">${esc(activation.outlet)}</span></span>
        <span class="app-disclosure-end"><span data-activation-count>${n}/${total}${n === total ? ' ✓' : ''}</span><svg class="app-disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg></span>
      </button>
      <div class="app-disclosure-panel"><div class="app-disclosure-panel-inner"><div>
        <p class="app-note">${esc(activation.time)} · IHG One Rewards ${esc(activation.discount)}</p>
        ${activation.artworks.map(x => `<label class="app-check"><input type="checkbox" data-task="${esc(x.id)}"${done.has(String(x.id)) ? ' checked' : ''}${editor ? '' : ' disabled'}><span class="app-check-box">${CHECK_SVG}</span><span class="app-check-label">${esc(x.name)}</span></label>`).join('')}
      </div></div></div>
    </article>`;
  }
  function briefMarkup(campaign) {
    const specific = campaign.activations.some(a => a.brief);
    return specific ? campaign.activations.filter(a => !a.display).map(a => copyBlock(a.outlet, a.brief || campaign.brief)).join('') : copyBlock('', campaign.brief);
  }
  function copyMarkup(campaign) {
    const specific = campaign.activations.some(a => a.copyEn || a.copyTh);
    let html = specific ? `<h3 class="app-section-subhead">Campaign / Master copy</h3><div class="app-stack">${copyBlock('English', campaign.copyEn)}${copyBlock('Thai', campaign.copyTh, 'th')}</div>` : `<div class="app-stack">${copyBlock('English', campaign.copyEn)}${copyBlock('Thai', campaign.copyTh, 'th')}</div>`;
    if (specific) for (const a of campaign.activations.filter(a => a.copyEn || a.copyTh)) html += `<h3 class="app-section-subhead">${esc(a.outlet)}</h3><div class="app-stack">${copyBlock('English', a.copyEn)}${copyBlock('Thai', a.copyTh, 'th')}</div>`;
    return html;
  }
  function folderMarkup(campaign) {
    const folders = folderLinks(campaign);
    const view = folders.length === 1
      ? `<a class="app-primary app-control" data-width="full" href="${esc(folders[0].url)}" target="_blank" rel="noopener">${LINK_ICON}View artwork folder</a>`
      : folders.length ? `<button class="app-primary app-control" data-width="full" type="button" data-folders="${esc(campaign.id)}">${LINK_ICON}View artwork folders</button>` : '<p class="app-note">Artwork folder · Not linked yet</p>';
    const edit = editor ? `<div class="app-utility-row"><button class="app-utility-action" type="button" data-edit-links><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17h7M13.5 3.5a1.8 1.8 0 0 1 2.5 2.5L7 15l-3.5 1 1-3.5z"/></svg>Add / change artwork link</button></div>` : '';
    return `${view}${edit}`;
  }
  function detailMarkup(campaign) {
    const n = counts(campaign, false), s = status(campaign, today);
    const time = uniqueValue(campaign.activations.map(a => a.time)), discount = uniqueValue(campaign.activations.map(a => a.discount));
    const updated = updatedLabel(campaign.updatedAt, { withTime: false });
    return `<header class="app-hero">
      <div class="app-hero-head"><button class="app-back-control app-control" type="button" data-back aria-label="Back to promotions"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg></button>${shareButton('promotion', campaign.id)}</div>
      <p class="app-hero-eyebrow"${toneAttr(s)}>${statusLabel(s)}</p>
      <h1 class="app-hero-title">${esc(campaign.title)}</h1>
      <p class="app-hero-copy">${esc(campaign.dateLabel)}</p>
    </header>
    <nav class="app-rail" aria-label="Promotion sections">${SECTIONS.map(([id, label], i) => `<button class="app-chip app-control${i === 0 ? ' is-active' : ''}" type="button" data-section="${id}"${i === 0 ? ' aria-current="true"' : ''}>${label}</button>`).join('')}</nav>
    <section class="app-section" id="overview">
      <div class="app-metric-grid" data-columns="2" data-values="text" data-rule="true">${fact('Outlet', outletsOf(campaign))}${fact('Time', time)}${fact('IHG One Rewards', discount)}${updated ? fact('Updated', updated) : ''}</div>
    </section>
    <section class="app-section" id="brief"><p class="app-section-kicker">01 · Promotion brief</p><div class="app-stack">${briefMarkup(campaign)}</div></section>
    <section class="app-section" id="copy"><p class="app-section-kicker">02 · Copy</p>${copyMarkup(campaign)}</section>
    <section class="app-section" id="artwork"><p class="app-section-kicker">03 · Artwork<span class="app-section-kicker-end" data-artwork-count>${n.done} / ${n.total} complete</span></p>
      <div class="app-stack">${campaign.activations.map(activationMarkup).join('')}${folderMarkup(campaign)}</div>
      <div class="app-utility-row"><button class="app-utility-action" type="button" data-fnb-top><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5 9l5-5 5 5"/></svg>Back to top</button></div>
    </section>`;
  }

  /* ---- sheet ------------------------------------------------------------ */
  function sheet() {
    let el = q('[data-sheet]');
    if (!el) { el = document.createElement('dialog'); el.className = 'app-sheet app-overlay'; el.dataset.sheet = 'true'; host.append(el); el.addEventListener('click', event => { if (event.target === el) el.close(); }); }
    return el;
  }
  function openSheet(title, body) {
    const el = sheet();
    el.innerHTML = `<div class="app-sheet-grip"></div><div class="app-sheet-body"><h2 class="app-sheet-title">${esc(title)}</h2>${body}</div>`;
    el.showModal();
  }
  function openFolders(campaign) {
    const folders = folderLinks(campaign); if (!folders.length) return;
    if (folders.length === 1) { window.open(folders[0].url, '_blank', 'noopener'); return; }
    openSheet('Artwork folders', `<div class="app-list">${folders.map(f => `<a class="app-list-row" href="${esc(f.url)}" target="_blank" rel="noopener"><span class="app-list-row-main"><span class="app-list-row-title">${esc(f.outlet)}</span></span><span class="app-list-row-end">Open ↗</span></a>`).join('')}</div>
      <div class="app-dialog-actions"><button class="app-utility-action" type="button" data-sheet-close>Close</button></div>`);
  }
  function openLinkEditor(campaign) {
    if (!editor) return;
    openSheet('Artwork links', `<div class="app-stack">${campaign.activations.filter(a => !a.display).map(a => `<div class="app-field"><label>${esc(a.outlet)}</label><input type="url" inputmode="url" data-link="${esc(a.id)}" value="${esc(linkFor(a) || '')}" placeholder="Paste OneDrive or SharePoint folder URL"></div>`).join('')}</div>
      <p class="app-note">Saved on this device only.</p>
      <div class="app-dialog-actions"><button class="app-utility-action" type="button" data-sheet-close>Cancel</button><button class="app-primary app-control" type="button" data-save-links>Save</button></div>`);
  }
  function saveLinks() {
    const el = sheet(); let bad = null; const next = { ...links };
    for (const input of el.querySelectorAll('[data-link]')) {
      const value = input.value.trim();
      if (value && !safeFolderUrl(value)) { bad = input; break; }
      next[input.dataset.link] = value || null;
    }
    if (bad) { bad.focus(); toast('Use a OneDrive or SharePoint https link'); return; }
    links = next; writeLocalLinks(links); el.close(); render(); toast('Artwork links saved on this device');
  }

  /* ---- sharing ------------------------------------------------------------ */
  async function share(kind, id) {
    const item = id ? promotions.find(p => p.id === id) : null;
    const title = item ? `${item.title} | Sindhorn Midtown` : 'F&B Promotions | Sindhorn Midtown';
    const url = new URL(`/share/fnb${id ? `/${encodeURIComponent(id)}` : ''}`, location.origin).href;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title, url }); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; } catch (_) {}
    toast(copied ? 'Link copied' : 'Share link ready');
  }

  /* ---- artwork status -------------------------------------------------- */
  async function toggleTask(input) {
    const id = String(input.dataset.task), value = input.checked;
    if (value) done.add(id); else done.delete(id);
    refreshCounts();
    try { await writeArtworkStatus({ [id]: value }); }
    catch (_) { if (value) done.delete(id); else done.add(id); input.checked = !value; refreshCounts(); toast('Could not save - check your sign-in'); }
  }
  function refreshCounts() {
    const campaign = promotions.find(p => p.id === currentId()); if (!campaign) return;
    for (const card of qa('[data-activation]')) {
      const a = campaign.activations.find(x => x.id === card.dataset.activation); if (!a) continue;
      const n = a.artworks.filter(x => done.has(String(x.id))).length, total = a.artworks.length;
      const count = card.querySelector('[data-activation-count]'); if (count) count.textContent = `${n}/${total}${n === total ? ' ✓' : ''}`;
      if (n === total) card.dataset.tone = 'success'; else delete card.dataset.tone;
    }
    const k = counts(campaign, false), lede = q('[data-artwork-count]'); if (lede) lede.textContent = `${k.done} / ${k.total} complete`;
  }

  /* ---- rail ------------------------------------------------------------- */
  function setActiveSection(id) {
    for (const chip of qa('[data-section]')) { const active = chip.dataset.section === id; chip.classList.toggle('is-active', active); if (active) chip.setAttribute('aria-current', 'true'); else chip.removeAttribute('aria-current'); }
  }
  function spy() {
    spyRaf = 0; if (!currentId()) return;
    const probe = Math.min(innerHeight * 0.3, 238); let active = 'overview';
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 36) active = 'artwork';
    else for (const [id] of SECTIONS) { const el = q(`#${id}`); if (el && el.getBoundingClientRect().top <= probe) active = id; }
    setActiveSection(active);
  }
  const scheduleSpy = () => { if (!spyRaf) spyRaf = requestAnimationFrame(spy); };

  /* ---- render ----------------------------------------------------------- */
  function render() {
    const id = currentId(), campaign = id ? promotions.find(p => p.id === id) : null;
    for (const el of qa('[data-select][data-open="true"]')) el.dataset.open = 'false';
    if (id && !campaign) { location.replace('#fnb'); return; }
    host.innerHTML = campaign ? detailMarkup(campaign) : indexMarkup();
    if (campaign) { scrollTo({ top: 0, behavior: 'auto' }); scheduleSpy(); }
    else { scrollTo({ top: indexScroll, behavior: 'auto' }); indexScroll = 0; }
    revealTracks();
  }
  async function load() {
    host.innerHTML = currentId() ? detailSkeletonMarkup() : skeletonMarkup();
    try {
      const [model, shared] = await Promise.all([loadFnbPromotions(), readArtworkStatus().catch(() => new Set())]);
      if (disposed) return;
      ({ promotions, source, updatedAt } = model); done = shared;
      months = monthsSpanned(promotions); outlets = outletsIn(promotions);
      if (month !== 'ALL' && !months.some(m => m.key === month)) month = 'ALL';
      render();
    } catch (error) { if (!disposed) host.innerHTML = errorMarkup(error); }
  }

  /* ---- events ----------------------------------------------------------- */
  const onClick = event => {
    const t = event.target;
    if (t.closest('[data-retry]')) { load(); return; }
    const option = t.closest('.app-select-option');
    if (option) {
      const root = option.closest('[data-select]'), value = option.dataset.value;
      if (root.dataset.select === 'outlet') filter = value; else month = value;
      root.dataset.open = 'false'; render(); return;
    }
    const trigger = t.closest('.app-select-trigger');
    if (trigger) {
      const root = trigger.closest('[data-select]'), open = root.dataset.open === 'true';
      for (const el of qa('[data-select]')) { el.dataset.open = 'false'; el.querySelector('.app-select-trigger')?.setAttribute('aria-expanded', 'false'); }
      root.dataset.open = String(!open); trigger.setAttribute('aria-expanded', String(!open)); return;
    }
    for (const el of qa('[data-select][data-open="true"]')) { el.dataset.open = 'false'; el.querySelector('.app-select-trigger')?.setAttribute('aria-expanded', 'false'); }
    const shareEl = t.closest('[data-share]'); if (shareEl) { share(shareEl.dataset.share, shareEl.dataset.id || ''); return; }
    const folders = t.closest('[data-folders]'); if (folders) { const c = promotions.find(p => p.id === folders.dataset.folders); if (c) openFolders(c); return; }
    if (t.closest('[data-edit-links]')) { const c = promotions.find(p => p.id === currentId()); if (c) openLinkEditor(c); return; }
    if (t.closest('[data-save-links]')) { saveLinks(); return; }
    if (t.closest('[data-sheet-close]')) { sheet().close(); return; }
    // data-open is the open/closed state of a disclosure or clamp; a card
    // navigates on data-promotion so a tap inside an open panel never routes.
    const open = t.closest('[data-promotion]'); if (open) { indexScroll = scrollY; location.hash = `#fnb/${encodeURIComponent(open.dataset.promotion)}`; return; }
    if (t.closest('[data-back]')) { location.hash = '#fnb'; return; }
    if (t.closest('[data-fnb-top]')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    const section = t.closest('[data-section]');
    if (section) { const el = q(`#${section.dataset.section}`); setActiveSection(section.dataset.section); el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); return; }
    const clamp = t.closest('[data-clamp-toggle]');
    if (clamp) { const box = clamp.previousElementSibling, isOpen = box?.dataset.open === 'true'; if (box) box.dataset.open = String(!isOpen); clamp.setAttribute('aria-expanded', String(!isOpen)); clamp.textContent = isOpen ? 'Show full' : 'Show less'; return; }
    const disclosure = t.closest('.app-disclosure-button');
    if (disclosure) {
      const root = disclosure.closest('[data-disclosure]'), isOpen = root.dataset.open === 'true';
      root.dataset.open = String(!isOpen); disclosure.setAttribute('aria-expanded', String(!isOpen));
      if (root.dataset.activation) { if (isOpen) openActivations.delete(root.dataset.activation); else openActivations.add(root.dataset.activation); }
    }
  };
  const onChange = event => { const input = event.target.closest('[data-task]'); if (input && editor) toggleTask(input); };
  const onKey = event => { if (event.key === 'Escape') for (const el of qa('[data-select][data-open="true"]')) el.dataset.open = 'false'; };
  const onHash = () => { if (!disposed && /^#fnb(\/|$)/.test(location.hash) && promotions.length) render(); };
  const onVisible = async () => { if (document.visibilityState !== 'visible' || disposed || !promotions.length) return; try { done = await readArtworkStatus(); if (currentId()) refreshCounts(); else render(); } catch (_) {} };
  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
  host.addEventListener('keydown', onKey);
  addEventListener('hashchange', onHash);
  addEventListener('scroll', scheduleSpy, { passive: true });
  addEventListener('resize', scheduleSpy, { passive: true });
  document.addEventListener('visibilitychange', onVisible);

  await load();

  return () => {
    disposed = true;
    host.removeEventListener('click', onClick); host.removeEventListener('change', onChange); host.removeEventListener('keydown', onKey);
    removeEventListener('hashchange', onHash); removeEventListener('scroll', scheduleSpy); removeEventListener('resize', scheduleSpy);
    document.removeEventListener('visibilitychange', onVisible);
    if (spyRaf) cancelAnimationFrame(spyRaf); clearTimeout(toastTimer);
    delete host.dataset.trackReady;
  };
}
