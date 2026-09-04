/* Messages, rebuilt on the UI Library. Reads the same IndexedDB inbox the
   service worker fills on push (notification-inbox.js), so a notification
   received while the app was closed is here when it opens. Opening the tab
   marks everything read, the way the legacy route does; the navbar badge
   follows. Broadcasts from the server join this list in a later release. */
import { listMessages, markAllRead, clearAll, kindLabel, stamp } from './notification-inbox.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const hero = `<header class="app-hero"><p class="app-hero-eyebrow">Messages</p><h1 class="app-hero-title">Notifications</h1><p class="app-hero-copy">Alerts and updates delivered to this device.</p></header>`;
const hashFor = route => { const r = String(route || ''); return r.startsWith('/fnb') ? '#fnb' : r.startsWith('/brand') ? '#brand' : ''; };

function row(message) {
  const title = message.titleEn || kindLabel(message.kind), body = message.bodyEn || '';
  return `<button class="app-list-row" type="button" data-message-open="${esc(hashFor(message.route))}">
    <span class="app-list-row-main"><span class="app-list-row-title">${esc(title)}</span><span class="app-list-row-meta">${esc(kindLabel(message.kind))} · ${esc(stamp(message.receivedAt, 'en-GB'))}${body ? ` · ${esc(body)}` : ''}</span></span>
    <span class="app-list-row-end">${message.read ? '' : '<span class="app-badge">New</span>'}</span>
  </button>`;
}

function markup(messages) {
  if (!messages.length) return `${hero}<section class="app-section"><div class="app-state app-card" data-tone="empty"><p class="app-state-label">Empty</p><p class="app-state-title">No messages yet</p><p class="app-state-copy">Alerts and updates sent to this device will appear here.</p></div></section>`;
  return `${hero}<section class="app-section"><div class="app-stack">
    <div class="app-card app-surface"><div class="app-list">${messages.map(row).join('')}</div></div>
    <div class="app-utility-row"><button class="app-utility-action" type="button" data-messages-clear>Clear all</button></div>
  </div></section>`;
}

export async function mountMessages(host) {
  let alive = true;
  const controller = new AbortController();
  const { signal } = controller;

  async function render() {
    let messages = [];
    try { messages = await listMessages(); } catch (_) {}
    if (!alive) return;
    host.innerHTML = markup(messages);
    if (messages.some(m => !m.read)) {
      try { await markAllRead(); } catch (_) {}
      document.dispatchEvent(new CustomEvent('sindhorn:messages-changed'));
    }
  }

  host.addEventListener('click', event => {
    const open = event.target.closest('[data-message-open]');
    if (open) { location.hash = open.dataset.messageOpen; return; }
    if (event.target.closest('[data-messages-clear]')) clearAll().then(() => { document.dispatchEvent(new CustomEvent('sindhorn:messages-changed')); return render(); }).catch(() => {});
  }, { signal });
  navigator.serviceWorker?.addEventListener?.('message', event => { if (event.data?.type === 'SINDHORN_NOTIFICATION_STORED') render(); }, { signal });

  host.innerHTML = `${hero}<section class="app-section"><div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div></section>`;
  await render();
  return () => { alive = false; controller.abort(); };
}
