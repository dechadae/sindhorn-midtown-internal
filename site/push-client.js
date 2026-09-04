/* Web Push on this device, as a module the shell's pages call.

   The service worker is registered by shell.js; this module only asks for
   its registration, reads the device's subscription, and turns it on or off
   against the alerts Worker (push-config.js names it). Subscriptions are
   anonymous - a device, not an employee - which is why the Worker holds no
   identity and why Settings › Me calls this "on this phone".

   status() never touches the network: it reports what the browser already
   knows so a page can paint at once. enable() fetches the VAPID public key,
   subscribes, then records the endpoint; disable() removes the endpoint
   then unsubscribes. Both resolve to the same status shape. */
import { PUSH_API_BASE } from './push-config.js';

const API = String(PUSH_API_BASE || '').replace(/\/+$/, '');
const TIMEOUT_MS = 12000;
let busy = false;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function base64urlBytes(value) { const padding = '='.repeat((4 - value.length % 4) % 4), base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(base64), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); return bytes; }
function timeout(promise, ms, label) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(label)), ms); Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }); }); }
async function request(path, options = {}) {
  const response = await timeout(fetch(API + path, { credentials: 'omit', cache: 'no-store', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } }), TIMEOUT_MS, 'Push API timed out');
  let body = {}; try { body = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(body?.error || ('Push API ' + response.status));
  return body;
}
async function registration() {
  const current = await navigator.serviceWorker.getRegistration('/');
  if (current?.active) return current;
  return timeout(navigator.serviceWorker.ready, TIMEOUT_MS, 'Service worker did not become ready');
}
async function subscription() { try { return await (await registration()).pushManager.getSubscription(); } catch (_) { return null; } }

/* support: 'unconfigured' (no Worker named), 'unsupported' (browser cannot),
   'blocked' (permission denied at browser or system level), 'ready'. */
export async function pushStatus() {
  const support = !API ? 'unconfigured' : !supported() ? 'unsupported' : Notification.permission === 'denied' ? 'blocked' : 'ready';
  const enabled = support === 'ready' ? Boolean(await subscription()) : false;
  return { support, enabled, busy };
}

export async function enablePush() {
  if (busy) return pushStatus();
  busy = true; let created = null;
  try {
    if ((await pushStatus()).support !== 'ready') return pushStatus();
    const reg = await registration();
    if (!(await reg.pushManager.getSubscription())) {
      const { publicKey } = await request('/vapid-public-key', { method: 'GET', headers: {} });
      if (!publicKey) throw new Error('Missing VAPID public key');
      created = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64urlBytes(String(publicKey)).buffer });
      const payload = created.toJSON();
      await request('/subscribe', { method: 'POST', body: JSON.stringify({ endpoint: payload.endpoint, expirationTime: payload.expirationTime ?? null, keys: payload.keys }) });
    }
  } catch (error) {
    if (created) { try { await created.unsubscribe(); } catch (_) {} }
    throw error;
  } finally { busy = false; }
  return pushStatus();
}

export async function disablePush() {
  if (busy) return pushStatus();
  busy = true;
  try {
    const current = await subscription();
    if (current) {
      try { await request('/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: current.endpoint }) }); } catch (error) { console.warn('Push backend removal failed', error); }
      await current.unsubscribe();
    }
  } finally { busy = false; }
  return pushStatus();
}
