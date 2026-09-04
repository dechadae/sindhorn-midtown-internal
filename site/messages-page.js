/* Messages, rebuilt on the UI Library. One list from two sources: broadcasts
   the hotel published to this employee (broadcast-inbox.js, from the server)
   and alerts the service worker stored on push while the app was closed
   (notification-inbox.js, in IndexedDB). Pinned broadcasts lead; everything
   else is newest first. A broadcast opens in the dialog and is receipted
   then; device alerts are marked read when the tab opens, as the legacy
   route did. Offline, the last inbox saved on this phone is shown and the
   utility note says so. The navbar badge follows both counts. */
import { listMessages, markAllRead, clearAll, kindLabel, stamp } from './notification-inbox.js';
import { loadInbox, cachedInbox, markBroadcastsRead, categoryLabel, priorityLabel, preferredText, otherText, whenLabel } from './broadcast-inbox.js';
import { openDialog, dialogHead } from './app-dialog.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const hero = `<header class="app-hero"><p class="app-hero-eyebrow">Messages</p><h1 class="app-hero-title">Inbox</h1><p class="app-hero-copy">Broadcasts from the hotel and alerts delivered to this device.</p></header>`;
const skeleton = `<div class="app-card app-surface"><div class="app-skeleton"><div class="app-skeleton-line" data-width="short"></div><div class="app-skeleton-line"></div><div class="app-skeleton-line" data-width="medium"></div></div></div>`;
const hashFor = route => { const r = String(route || ''); return r.startsWith('/fnb') ? '#fnb' : r.startsWith('/brand') ? '#brand' : ''; };

function broadcastRow(b) {
  const meta = [categoryLabel(b.category), b.priority === 'urgent' || b.priority === 'high' ? priorityLabel(b.priority) : '', whenLabel(b.publishAt)].filter(Boolean).join(' · ');
  const copy = b.sensitive ? '' : preferredText(b, 'body');
  return `<button class="app-list-row" type="button" data-broadcast-open="${esc(b.id)}"${b.readAt ? '' : ' data-unread'}>
    <span class="app-list-row-main"><span class="app-list-row-title">${esc(preferredText(b, 'title'))}</span><span class="app-list-row-meta">${esc(meta)}</span>${copy ? `<span class="app-list-row-copy">${esc(copy)}</span>` : ''}</span>
    <span class="app-list-row-end">${b.pinned ? '<span class="app-badge" data-tone="quiet">Pinned</span>' : ''}${b.readAt ? '' : '<span class="app-badge">New</span>'}</span>
  </button>`;
}

function alertRow(message) {
  const title = message.titleEn || kindLabel(message.kind), body = message.bodyEn || '';
  return `<button class="app-list-row" type="button" data-message-open="${esc(hashFor(message.route))}">
    <span class="app-list-row-main"><span class="app-list-row-title">${esc(title)}</span><span class="app-list-row-meta">${esc(kindLabel(message.kind))} · ${esc(stamp(message.receivedAt, 'en-GB'))}</span>${body ? `<span class="app-list-row-copy">${esc(body)}</span>` : ''}</span>
    <span class="app-list-row-end">${message.read ? '' : '<span class="app-badge">New</span>'}</span>
  </button>`;
}

/* Pinned broadcasts first in the server's order, then both sources by time. */
function merged(broadcasts, alerts) {
  const pinned = broadcasts.filter(b => b.pinned).map(b => ({ at: Infinity, html: broadcastRow(b) }));
  const rest = [
    ...broadcasts.filter(b => !b.pinned).map(b => ({ at: Date.parse(b.publishAt) || 0, html: broadcastRow(b) })),
    ...alerts.map(m => ({ at: Number(m.receivedAt) || 0, html: alertRow(m) }))
  ].sort((a, b) => b.at - a.at);
  return [...pinned, ...rest];
}

function markup(broadcasts, alerts, inbox) {
  const rows = merged(broadcasts, alerts);
  const note = inbox.cached && inbox.at ? `Saved on this phone · ${esc(stamp(inbox.at, 'en-GB'))}` : inbox.cached ? 'Offline · broadcasts will load when the connection returns' : '';
  if (!rows.length) return `${hero}<section class="app-section"><div class="app-stack"><div class="app-state app-card" data-tone="${inbox.cached ? 'error' : 'empty'}"><p class="app-state-label">${inbox.cached ? 'Offline' : 'Empty'}</p><p class="app-state-title">${inbox.cached ? 'Messages could not be loaded' : 'No messages yet'}</p><p class="app-state-copy">${inbox.cached ? 'Check the connection and pull to refresh.' : 'Broadcasts from the hotel and alerts sent to this device will appear here.'}</p></div></div></section>`;
  return `${hero}<section class="app-section"><div class="app-stack">
    <div class="app-card app-surface"><div class="app-list">${rows.map(r => r.html).join('')}</div></div>
    ${note || alerts.length ? `<div class="app-utility-row">${note ? `<span class="app-utility-note">${note}</span>` : ''}${alerts.length ? '<button class="app-utility-action" type="button" data-messages-clear>Clear device alerts</button>' : ''}</div>` : ''}
  </div></section>`;
}

/* The whole broadcast: the employee's language first, the other below. */
function detail(b) {
  const lead = preferredText(b, 'body'), other = otherText(b, 'body'), otherTitle = otherText(b, 'title');
  const meta = [categoryLabel(b.category), b.priority !== 'normal' ? priorityLabel(b.priority) : '', whenLabel(b.publishAt)].filter(Boolean).join(' · ');
  return `<div class="app-dialog-body">
    ${dialogHead(meta, preferredText(b, 'title'))}
    <div class="app-dialog-grid">
      <div class="app-prose" data-span="full" data-verbatim="true"><p>${esc(lead)}</p></div>
      ${other ? `<div class="app-dialog-section"><span>${esc(otherTitle || preferredText(b, 'title'))}</span></div><div class="app-prose" data-span="full" data-verbatim="true"><p>${esc(other)}</p></div>` : ''}
    </div>
    ${b.expiresAt ? `<p class="app-dialog-status">Shown until ${esc(whenLabel(b.expiresAt))}</p>` : ''}
    <div class="app-dialog-actions"><button class="app-primary app-control" type="button" data-dialog-close>Close</button></div>
  </div>`;
}

export async function mountMessages(host) {
  let alive = true, dialog = null, broadcasts = cachedInbox()?.broadcasts || [], alerts = [];
  const controller = new AbortController();
  const { signal } = controller;
  const changed = () => document.dispatchEvent(new CustomEvent('sindhorn:messages-changed'));

  function paint(inbox = { cached: false }) {
    if (!alive) return;
    host.innerHTML = markup(broadcasts, alerts, inbox);
  }

  /* Device alerts are instant; the broadcasts arrive when the server does,
     with the saved inbox standing in until then. */
  async function render({ fresh = true } = {}) {
    try { alerts = await listMessages(); } catch (_) { alerts = []; }
    if (broadcasts.length || alerts.length) paint({ cached: false });
    if (alerts.some(m => !m.read)) { try { await markAllRead(); } catch (_) {} changed(); }
    const inbox = await loadInbox({ force: fresh });
    if (!alive) return;
    broadcasts = inbox.broadcasts;
    paint(inbox);
    changed();
  }

  async function open(id) {
    const b = broadcasts.find(x => x.id === id);
    if (!b) return;
    if (dialog) dialog.close('');
    dialog = openDialog(detail(b), { onClose: () => { dialog = null; } });
    if (b.readAt) return;
    try {
      await markBroadcastsRead([id]);
      if (!alive) return;
      b.readAt = new Date().toISOString();
      const row = host.querySelector(`[data-broadcast-open="${CSS.escape(id)}"]`);
      if (row) { row.removeAttribute('data-unread'); row.querySelector('.app-list-row-end .app-badge:not([data-tone])')?.remove(); }
      changed();
    } catch (_) {}
  }

  host.addEventListener('click', event => {
    const broadcast = event.target.closest('[data-broadcast-open]');
    if (broadcast) { open(broadcast.dataset.broadcastOpen); return; }
    const alert = event.target.closest('[data-message-open]');
    if (alert) { location.hash = alert.dataset.messageOpen; return; }
    if (event.target.closest('[data-messages-clear]')) clearAll().then(() => { changed(); return render({ fresh: false }); }).catch(() => {});
  }, { signal });
  navigator.serviceWorker?.addEventListener?.('message', event => { if (event.data?.type === 'SINDHORN_NOTIFICATION_STORED') render({ fresh: event.data.kind === 'broadcast' }); }, { signal });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); }, { signal });

  host.innerHTML = `${hero}<section class="app-section">${skeleton}</section>`;
  await render();
  return () => { alive = false; controller.abort(); if (dialog) dialog.close(''); };
}
