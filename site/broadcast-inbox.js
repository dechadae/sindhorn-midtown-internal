/* The server side of Messages: broadcasts published to the signed-in
   employee, read through sindhorn_broadcast_inbox_v1 and receipted through
   sindhorn_broadcast_mark_read_v1. Both are security-invoker RPCs, so what
   comes back is exactly what row-level security lets this employee see.

   The last inbox is kept in localStorage under the employee's own id, so
   Messages opens offline with what was there and the navbar badge can count
   server unread without a round trip. Signing out drops it - a broadcast
   may be sensitive and the next employee on this phone is not its audience.

   Shared by messages-page.js (the list and the dialog) and shell.js (the
   badge); Settings › Broadcast has its own admin RPCs and never reads this. */
import { supabaseRpc, getState, getProfile } from './auth-client.js';

const KEY = 'sindhorn.broadcast-inbox.v1';
const REFRESH_MS = 60 * 1000;
const CATEGORIES = [['hotel_news', 'Hotel news'], ['operations', 'Operations'], ['safety', 'Safety'], ['hr', 'People & Culture'], ['event', 'Event'], ['environment', 'Environment']];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const PRIORITIES = [['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']];
const PRIORITY_LABEL = Object.fromEntries(PRIORITIES);

let cache;

const employeeId = () => getProfile()?.id || getState().session?.user?.id || '';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (value && Array.isArray(value.broadcasts) && value.employee === employeeId()) return value;
  } catch (_) {}
  return null;
}
function write(value) { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) {} }

/* What is known now: the last inbox saved for this employee, or nothing. */
export function cachedInbox() {
  if (cache === undefined) cache = read();
  return cache;
}

/* Unread broadcasts as last seen. Counted from the rows, not the server's
   number, so a receipt made on this phone counts down at once. */
export function serverUnread() {
  return (cachedInbox()?.broadcasts || []).reduce((count, b) => count + (b.readAt ? 0 : 1), 0);
}

/* Fetch the inbox. Offline or failed, the saved inbox comes back with
   cached:true and the error, so the page can say so; signed out, nothing. */
export async function loadInbox({ force = true } = {}) {
  if (!getState().authenticated) return { broadcasts: [], at: 0, cached: false };
  const known = cachedInbox();
  if (!force && known && Date.now() - known.at < REFRESH_MS) return { ...known, cached: false };
  try {
    const result = await supabaseRpc('sindhorn_broadcast_inbox_v1', {});
    if (!result?.ok) throw new Error(result?.error || 'inbox_unavailable');
    cache = { employee: employeeId(), at: Date.now(), broadcasts: result.broadcasts || [] };
    write(cache);
    return { ...cache, cached: false };
  } catch (error) {
    return { broadcasts: known?.broadcasts || [], at: known?.at || 0, cached: true, error };
  }
}

/* Receipt for the broadcasts the employee opened. The saved rows are marked
   at once so the badge and the row agree; the server keeps the truth. */
export async function markBroadcastsRead(ids) {
  const wanted = (ids || []).filter(Boolean);
  if (!wanted.length || !getState().authenticated) return 0;
  const result = await supabaseRpc('sindhorn_broadcast_mark_read_v1', { p_broadcast_ids: wanted });
  if (!result?.ok) throw new Error(result?.error || 'mark_read_failed');
  const now = new Date().toISOString(), known = cachedInbox();
  if (known) {
    cache = { ...known, broadcasts: known.broadcasts.map(b => wanted.includes(b.id) && !b.readAt ? { ...b, readAt: now } : b) };
    write(cache);
  }
  return result.marked ?? wanted.length;
}

export function clearInbox() { cache = null; try { localStorage.removeItem(KEY); } catch (_) {} }

/* Words for the enums, shared with Settings › Broadcast so the admin and the
   employee read the same names. */
export const categoryLabel = value => CATEGORY_LABEL[value] || 'Notice';
export const priorityLabel = value => PRIORITY_LABEL[value] || 'Normal';
export const categoryOptions = () => CATEGORIES.map(([value, label]) => ({ value, label }));
export const priorityOptions = () => PRIORITIES.map(([value, label]) => ({ value, label }));

/* The employee's language picks which text leads; the other is still shown. */
export function preferredText(broadcast, key) {
  const th = broadcast?.[`${key}Th`], en = broadcast?.[`${key}En`];
  return (getProfile()?.preferred_language === 'th' && th) ? th : (en || th || '');
}
export function otherText(broadcast, key) {
  const th = broadcast?.[`${key}Th`], en = broadcast?.[`${key}En`];
  if (!th || !en) return '';
  return getProfile()?.preferred_language === 'th' ? en : th;
}


document.addEventListener('sindhorn:auth-changed', event => { if (event.detail?.authenticated === false) clearInbox(); });
