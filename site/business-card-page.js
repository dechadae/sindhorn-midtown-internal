/* The digital business card (r31): the card body Settings › Me paints and
   presents, and the public page at /<slug> that a scanned QR opens.

   The public page is the app shell in public mode (site/_worker.js cuts it
   from index.html per request, with the card's own title and Open Graph
   tags and the card's data as a bootstrap script), so the same stylesheets,
   atmosphere and this same markup render for the employee in Settings and
   for the person who scanned. Same RPC too: sindhorn_public_business_card
   is what the worker read; the page only fetches it itself when it arrives
   without a bootstrap (a stale cache, a copied document).

   Everything here is library: the card is .app-card around
   .app-business-card, the QR is an .app-figure, the details are a text
   metric grid, the public actions are one utility row - Add to contacts is
   the /<slug>.vcf the worker serves, Call and Email are the phone's own
   handlers, Share is the share sheet or the clipboard and the toast. */
import { businessCardUrl, businessCardVcfUrl, primaryPhone } from './business-card-core.js';
import { qrStyledSvg } from './qr-v6.js';
import { showToast } from './app-toast.js';

const SUPABASE_URL = 'https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const PUBLIC_RPC = 'sindhorn_public_business_card';
export const HOTEL_NAME = 'Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
export const HOTEL_LOGO = '/assets/brand/sindhorn-midtown-vignette-white.png';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const telHref = value => { const raw = String(value || '').trim(); return raw ? `tel:${raw.startsWith('+') ? '+' : ''}${raw.replace(/\D/g, '')}` : ''; };
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; } };
const brandLogo = path => /^\/assets\/brand\/[a-z0-9._-]+$/i.test(path || '') ? path : HOTEL_LOGO;

/* What the public page prints for a card right now: a hidden field is
   simply absent, exactly as the public RPC leaves it out. From the self
   read model (Settings) the visibility map is applied here; from the
   public read model it already was. */
export function publicView(data) {
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
    hotelLogo: brandLogo(hotel.hotelLogoPath),
    published: card.published === true
  };
}
export function publishedView(card) {
  return {
    slug: card.slug || '',
    displayName: card.displayName || '',
    positionTitle: card.positionTitle || null,
    workEmail: card.workEmail || null,
    businessMobile: card.businessMobile || null,
    directPhone: card.directPhone || null,
    hotelName: card.hotelName || HOTEL_NAME,
    hotelMainPhone: card.hotelMainPhone || null,
    hotelAddress: card.hotelAddress || null,
    hotelWebsite: card.hotelWebsite || null,
    hotelLogo: brandLogo(card.hotelLogoPath),
    published: true
  };
}

function detail(label, value, href = '', text = value) {
  if (!value) return '';
  return `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${href ? `<a href="${esc(href)}">${esc(text)}</a>` : esc(text)}</span></div>`;
}

/* The card body, shared by Settings › Me, its presenting dialog and the
   public page. */
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

export async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch (_) { return false; }
}
/* The share sheet where the phone has one, the clipboard and the toast
   where it does not; a dismissed sheet says nothing. */
export async function shareCard(view, url) {
  const payload = { title: `${view.displayName} | ${view.hotelName}`, text: [view.displayName, view.positionTitle, view.hotelName].filter(Boolean).join(' · '), url };
  if (typeof navigator.share === 'function') { try { await navigator.share(payload); return; } catch (error) { if (error?.name === 'AbortError') return; } }
  showToast(await copyText(payload.url) ? 'Link copied' : 'Couldn\'t copy the link');
}

const state = (label, title, copy, tone = 'empty') => `<div class="app-state app-card" data-tone="${tone}"><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const skeleton = () => `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line" data-size="square"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;

function bootstrapCard() {
  const node = document.getElementById('businessCardBootstrap');
  if (!node) return null;
  try { const data = JSON.parse(node.textContent); return data && typeof data === 'object' ? data : null; } catch (_) { return null; }
}
async function fetchCard(slug) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${PUBLIC_RPC}`, { method: 'POST', cache: 'no-store', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_slug: slug }) });
  if (!response.ok) throw new Error(`public_business_card_http_${response.status}`);
  return response.json();
}

/* The public page. The slug is the path; the card is the bootstrap the
   worker stamped, else one public read. */
export async function mountCard(host) {
  let alive = true;
  const slug = (document.body.dataset.publicId || location.pathname.replace(/^\//, '')).toLowerCase();
  host.innerHTML = `<section class="app-section">${skeleton()}</section>`;
  let card = bootstrapCard();
  if (!card || card.slug !== slug) {
    try { card = await fetchCard(slug); } catch (_) { card = null; }
  }
  if (!alive) return () => {};
  if (!card?.slug || !card.displayName) {
    host.innerHTML = `<section class="app-section">${state('Business card', 'This card isn\'t available', 'The link may be out of date, or the card is no longer published.', 'error')}</section>`;
    return () => { alive = false; };
  }
  const view = publishedView(card);
  const url = businessCardUrl(location.origin, view.slug);
  const phone = primaryPhone(view);
  const actions = `<div class="app-utility-row">
      <a class="app-utility-action" href="${esc(businessCardVcfUrl(location.origin, view.slug))}">Add to contacts</a>
      ${phone ? `<a class="app-utility-action" href="${esc(telHref(phone))}">Call</a>` : ''}
      ${view.workEmail ? `<a class="app-utility-action" href="mailto:${esc(encodeURIComponent(view.workEmail))}">Email</a>` : ''}
      <button class="app-utility-action" type="button" data-card-share>Share</button>
    </div>`;
  host.innerHTML = `<section class="app-section"><div class="app-card app-surface">${businessCardMarkup(view, { url, qr: true, actions })}</div></section>`;
  const clicks = new AbortController();
  host.addEventListener('click', event => { if (event.target.closest('[data-card-share]')) shareCard(view, url); }, { signal: clicks.signal });
  return () => { alive = false; clicks.abort(); };
}
