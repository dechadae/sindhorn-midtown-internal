/* F&B read model for the rebuilt shell. Data only: promotions, shared artwork
   status, and the device-local folder-link overrides. No markup, no style, no
   DOM - a page renders what this returns.

   fnb-data.js is not reused here because it is not a data module: on import
   it injects a <style> element and patches legacy .fnb-* markup, which the
   rebuild forbids on sight. The fetch, validation and shaping below are the
   same as that module's, carried over so both shells read one dataset the
   same way until the legacy route retires.

   Auth comes from auth-client.js, the one session in this shell. Signed in,
   the internal read model answers; otherwise the public one does, exactly as
   the RPC policies allow. Nothing here widens either. */
import { supabaseRpc, getAccessToken, getProfile } from './auth-client.js';

const CACHE_KEY = 'sindhorn-midtown:fnb-dataset:v2';
const LOCAL_STATE_KEY = 'sindhorn-midtown:fnb-local:v1';
const INTERNAL_RPC = 'sindhorn_fnb_read_model';
const PUBLIC_RPC = 'sindhorn_fnb_public_read_model';
const STATUS_READ_RPC = 'sindhorn_fnb_artwork_status_read';
const STATUS_WRITE_RPC = 'sindhorn_fnb_artwork_status_write';
const EDITOR_EMPLOYEE = '10639';

const safeParse = value => { try { return JSON.parse(value); } catch (_) { return null; } };
const validIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function validate(data) {
  if (!Array.isArray(data) || !data.length) return false;
  const pids = new Set(), aids = new Set(), xids = new Set();
  for (const p of data) {
    if (!p || typeof p.id !== 'string' || pids.has(p.id) || !p.title || !validIso(p.start) || !validIso(p.end) || p.start > p.end || !Array.isArray(p.activations)) return false;
    pids.add(p.id);
    for (const a of p.activations) {
      if (!a || typeof a.id !== 'string' || aids.has(a.id) || !a.outlet || !Array.isArray(a.artworks)) return false;
      aids.add(a.id);
      for (const x of a.artworks) { if (!x || typeof x.id !== 'string' || xids.has(x.id) || !x.name) return false; xids.add(x.id); }
    }
  }
  return true;
}
function parseUpdated(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const zoned = /(?:z|[+-]\d\d:?\d\d)$/i.test(text) ? text : `${text}+07:00`;
  const date = new Date(zoned);
  return Number.isNaN(date.valueOf()) ? null : date;
}
function latestUpdated(data) {
  let latest = null;
  for (const item of data || []) { const date = parseUpdated(item?.updatedAt); if (date && (!latest || date > latest)) latest = date; }
  return latest ? latest.toISOString() : null;
}
const displaySlug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outlet';
// A promotion lists the outlets it is shown under; an outlet with no
// activation of its own gets a display-only one so the card and the filter
// agree with the source workbook.
function decorate(data) {
  return data.map(p => {
    const activations = (p.activations || []).map(a => ({ ...a, artworks: Array.isArray(a.artworks) ? a.artworks : [] }));
    const display = Array.isArray(p.displayOutlets) && p.displayOutlets.length ? p.displayOutlets : [...new Set(activations.map(a => a.outlet))];
    const present = new Set(activations.map(a => a.outlet)), reference = activations[0] || {};
    for (const outlet of display) {
      if (!present.has(outlet)) activations.push({ id: `__display__${p.id}__${displaySlug(outlet)}`, outlet, time: reference.time || 'TBC', discount: reference.discount || 'N/A', artworks: [], display: true });
    }
    return Object.freeze({ ...p, activations: Object.freeze(activations), displayOutlets: display });
  });
}
function readCache() { try { const parsed = safeParse(localStorage.getItem(CACHE_KEY) || ''); return validate(parsed?.data) ? parsed : null; } catch (_) { return null; } }
function writeCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {} }

/* { promotions, source: 'supabase' | 'supabase-public' | 'cache', updatedAt }.
   Throws only when there is nothing to show at all - no network and no
   cache - so the page can render its real error state. */
export async function loadFnbPromotions() {
  let raw = null, source;
  try {
    const token = getAccessToken();
    raw = token ? await supabaseRpc(INTERNAL_RPC, {}, { accessToken: token }) : await supabaseRpc(PUBLIC_RPC, {}, { accessToken: null });
    if (!validate(raw)) throw new Error('Invalid F&B dataset');
    source = token ? 'supabase' : 'supabase-public';
    writeCache(raw);
  } catch (error) {
    const cached = readCache();
    if (!cached) throw error;
    raw = cached.data; source = 'cache';
  }
  return { promotions: Object.freeze(decorate(raw)), source, updatedAt: latestUpdated(raw) };
}

/* Shared artwork completion, one set of artwork ids marked done. Public read;
   the write RPC requires the editor's session and enforces that itself. */
export async function readArtworkStatus() {
  const rows = await supabaseRpc(STATUS_READ_RPC, {}, { accessToken: null });
  return new Set((Array.isArray(rows) ? rows : []).filter(row => row?.done === true).map(row => String(row.artwork_id)));
}
export async function writeArtworkStatus(checks) {
  const token = getAccessToken();
  if (!token) throw new Error('F&B artwork status requires a signed-in editor');
  return supabaseRpc(STATUS_WRITE_RPC, { p_checks: checks }, { accessToken: token });
}
export function isArtworkEditor() {
  return String(getProfile()?.employee_number || '') === EDITOR_EMPLOYEE;
}

/* Folder-link overrides live on this device only, under the same key the
   live route uses, so a link saved there is already here. */
export function readLocalLinks() { try { return safeParse(localStorage.getItem(LOCAL_STATE_KEY) || '')?.links || {}; } catch (_) { return {}; } }
export function writeLocalLinks(links) {
  try {
    const saved = safeParse(localStorage.getItem(LOCAL_STATE_KEY) || '') || {};
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ checks: saved.checks || {}, links }));
  } catch (_) {}
}
export function safeFolderUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname.endsWith('sharepoint.com') || url.hostname.endsWith('1drv.ms') || url.hostname.endsWith('onedrive.live.com')) ? url.href : null;
  } catch (_) { return null; }
}
export { parseUpdated };
