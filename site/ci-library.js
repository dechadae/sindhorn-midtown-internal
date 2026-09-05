/* The UI Library's behaviour, shared by the standalone page (/ci) and the
   shell route (/#ci). One binding for one markup contract, so the two
   cannot drift apart: components that ship behaviour in the app (the
   selector, disclosure, clamp) are demonstrated with exactly the markup the
   pages use. bindLibrary(root) wires every specimen under root and returns a
   dispose function; nothing here touches the document outside root except
   the two listeners the selector needs to close on an outside tap. */

import { bindCode } from './app-code.js';
import { transitionView, viewKind } from './app-view.js';
import { confirmDialog, openDialog, dialogHead } from './app-dialog.js';
import { appSelect, bindAppSelects } from './app-select.js';
import { qrStyledSvg } from './qr-v6.js';

/* The view-transition specimen's mock pages: the shell's vocabulary, small
   enough to sit inside a bounded frame. */
const DEMO_PAGES = {
  today: ['Today', 'Hotel Business', 'The day\u2019s numbers, drawn in as they arrive.'],
  fnb: ['Food & Beverage', 'Promotions', 'This season\u2019s campaigns, ready to share.'],
  jobs: ['Jobs', 'Job tracker', 'What was asked, who sent it, the deadline and where it stands.'],
  brand: ['Brand', 'Standards', 'The marks, the type and how they are used.'],
  messages: ['Messages', 'Inbox', 'What was sent to you, newest first.'],
  'settings/me': ['Settings', 'Me', 'Your account and how you appear to colleagues.'],
  'settings/admin': ['Settings', 'Admin', 'Employees, access and one-time codes.'],
  'settings/broadcast': ['Settings', 'Broadcast', 'Messages sent to every employee or a department.'],
  'settings/system': ['Settings', 'System', 'The app itself: version, library and diagnostics.']
};
const DEMO_APP = ['today', 'fnb', 'jobs', 'brand', 'messages'];
const DEMO_SETTINGS = ['settings/me', 'settings/admin', 'settings/broadcast', 'settings/system'];
const demoLayer = view => view.startsWith('settings') ? 1 : 0;
const demoOrder = view => demoLayer(view) ? DEMO_SETTINGS.indexOf(view) : DEMO_APP.indexOf(view);
const demoPage = view => { const [eyebrow, title, copy] = DEMO_PAGES[view]; return `<header class="app-hero"><p class="app-hero-eyebrow">${eyebrow}</p><h1 class="app-hero-title">${title}</h1></header><div class="app-surface"><p class="app-surface-label">${title}</p><div class="app-surface-copy">${copy}</div></div>`; };

export function bindLibrary(root, { page = root } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal });

  // Code group - the same behaviour the sign-in page binds.
  bindCode(root, { signal });

  // The library is reached from Settings › System; Back returns there (on
  // the standalone page too, through the shell). Back to top is the same
  // utility every long page ends with.
  const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  on(root, 'click', event => {
    if (event.target.closest('[data-ci-top]')) { window.scrollTo({ top: 0, behavior: smooth() }); return; }
    if (event.target.closest('[data-ci-back]')) { if (location.pathname === '/') location.hash = '#settings/system'; else location.href = '/#settings/system'; }
  });

  // Shell demo - the account chip switches the navbar between its two sets,
  // exactly as the router does on /.
  for (const frame of root.querySelectorAll('[data-shell-demo]')) {
    const account = frame.querySelector('.app-masthead-account'), navbar = frame.querySelector('.app-navbar');
    if (!account || !navbar) continue;
    on(account, 'click', () => {
      const settings = navbar.dataset.mode !== 'settings';
      navbar.dataset.mode = settings ? 'settings' : 'app';
      account.dataset.mode = settings ? 'close' : 'initials';
      account.setAttribute('aria-label', settings ? 'Close settings' : 'Settings');
      for (const set of navbar.querySelectorAll('.app-navbar-set')) set.inert = set.dataset.set !== navbar.dataset.mode;
    });
  }

  // View transitions - the shell's four movements, bounded to a frame. The
  // frame keeps its own tiny router so the specimen and the shell share only
  // transitionView() and viewKind(), which is the point.
  for (const frame of root.querySelectorAll('[data-view-demo]')) {
    const host = frame.querySelector('[data-view-host]'), navbar = frame.querySelector('.app-navbar'), account = frame.querySelector('[data-demo-account]');
    if (!host || !navbar || !account) continue;
    let current = 'today', back = 'today';
    host.innerHTML = demoPage(current);
    const go = view => {
      if (view === current || !DEMO_PAGES[view]) return;
      const kind = viewKind(current, view, { layer: demoLayer, order: demoOrder });
      if (demoLayer(view) === 0) back = view;
      current = view;
      const settings = demoLayer(view) === 1;
      navbar.dataset.mode = settings ? 'settings' : 'app';
      account.dataset.mode = settings ? 'close' : 'initials';
      account.setAttribute('aria-label', settings ? 'Close settings' : 'Settings');
      for (const set of navbar.querySelectorAll('.app-navbar-set')) set.inert = set.dataset.set !== navbar.dataset.mode;
      for (const button of frame.querySelectorAll('[data-demo-route]')) { if (button.dataset.demoRoute === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
      transitionView(host, kind, () => { host.innerHTML = demoPage(view); }, { within: frame });
    };
    on(frame, 'click', event => {
      const button = event.target.closest('[data-demo-route]');
      if (button) { go(button.dataset.demoRoute); return; }
      if (event.target.closest('[data-demo-account]')) go(demoLayer(current) === 1 ? back : 'settings/me');
    });
  }

  // Confirm - the dialog standard asked from code.
  const confirmOpen = root.querySelector('[data-confirm-open]'), confirmResult = root.querySelector('[data-confirm-result]');
  if (confirmOpen) on(confirmOpen, 'click', async () => {
    const yes = await confirmDialog({ kicker: 'Specimen', title: 'Sign out of this device?', copy: 'You will need your Employee ID and permanent code to sign back in.', confirm: 'Sign out', cancel: 'Stay signed in', tone: 'danger' });
    if (confirmResult && !signal.aborted) confirmResult.textContent = yes ? 'Confirmed - the page would sign out now.' : 'Cancelled - nothing happened, which is the point of asking.';
  });

  // Form dialog - openDialog() with a body of the page's own: the grid, a
  // section, the shared selector, the status line. Saving only pretends.
  const formOpen = root.querySelector('[data-form-dialog-open]');
  let formDialog = null;
  if (formOpen) on(formOpen, 'click', () => {
    const check = (name, label, checked) => `<label class="app-check" data-mode="option"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}><span class="app-check-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg></span><span class="app-check-label">${label}</span></label>`;
    formDialog = openDialog(`<form class="app-dialog-body" novalidate>
      ${dialogHead('Specimen', 'Add employee')}
      <div class="app-dialog-grid">
        <div class="app-field"><label for="ci-f-number">Employee ID</label><input id="ci-f-number" type="text" value="SM-0311" autocomplete="off"></div>
        <div class="app-field"><label for="ci-f-name">Display name</label><input id="ci-f-name" type="text" value="Nattaya Prasert" autocomplete="off"></div>
        <div class="app-field" data-span="full"><label for="ci-f-mail">Hotel email</label><input id="ci-f-mail" type="email" value="nattaya.prasert@sindhornmidtown.com" autocomplete="off"></div>
        ${appSelect({ kind: 'department', label: 'Department', options: [{ value: '', label: 'Unassigned' }, { value: 'fo', label: 'Front Office' }, { value: 'mc', label: 'Marketing Communications' }], selected: 'fo' })}
        ${appSelect({ kind: 'role', label: 'Role', options: [{ value: 'employee', label: 'Employee' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'manager', label: 'Manager' }, { value: 'admin', label: 'Admin' }], selected: 'employee' })}
        <div data-span="full">${check('active', 'Access is active', true)}</div>
        <div class="app-dialog-section"><span>Private contact</span><small>Where a first-login or recovery code can reach this employee. Private to admins.</small></div>
        <div class="app-field"><label for="ci-f-personal">Personal email <span>optional</span></label><input id="ci-f-personal" type="email" autocomplete="off"></div>
        <div class="app-field"><label for="ci-f-mobile">Mobile <span>optional · +66…</span></label><input id="ci-f-mobile" type="tel" autocomplete="off"></div>
      </div>
      <div class="app-utility-row"><button class="app-utility-action" type="button">Issue first-login code</button></div>
      <p class="app-dialog-status" data-dialog-status role="status" aria-live="polite"></p>
      <div class="app-dialog-actions app-dialog-actions-split">
        <button class="app-utility-action" type="button" data-tone="danger">Revoke access</button>
        <div class="app-row"><button class="app-utility-action" type="button" data-dialog-close>Cancel</button><button class="app-primary app-control" type="submit">Save</button></div>
      </div>
    </form>`, { onClose: () => { formDialog = null; } });
    const form = formDialog.querySelector('form'), status = form.querySelector('[data-dialog-status]');
    bindAppSelects(form, { signal });
    form.addEventListener('submit', event => {
      event.preventDefault();
      status.dataset.tone = ''; status.textContent = 'Saving…';
      setTimeout(() => { if (formDialog) { status.dataset.tone = 'error'; status.textContent = 'That Employee ID or hotel email is already assigned.'; } }, 700);
    }, { signal });
  });

  // Chip group - a field answered by chips. A one-of group releases the
  // others when a chip is pressed; a many-of group toggles each on its own.
  root.querySelectorAll('[data-chip-group]').forEach(group => on(group, 'click', event => {
    const chip = event.target.closest('.app-chip'); if (!chip) return;
    const pressed = chip.getAttribute('aria-pressed') === 'true';
    if (group.dataset.chipGroup === 'one') { if (pressed) return; group.querySelectorAll('.app-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip))); }
    else chip.setAttribute('aria-pressed', String(!pressed));
  }));

  // Search - the clear control exists only while there is text to clear (CSS);
  // tapping it empties the well and returns focus to it.
  for (const clear of root.querySelectorAll('[data-search-clear]')) on(clear, 'click', () => {
    const input = clear.parentElement?.querySelector('input');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
  });

  // Business card - the QR is drawn by the same qrStyledSvg() Settings › Me uses.
  for (const figure of root.querySelectorAll('[data-card-qr-specimen]')) {
    try { figure.innerHTML = qrStyledSvg('https://sindhorn-midtown-internal.pages.dev/decha-dae'); } catch (_) {}
  }

  // Disclosure
  for (const item of root.querySelectorAll('[data-disclosure]')) {
    const button = item.querySelector('.app-disclosure-button');
    if (button) on(button, 'click', () => {
      const open = item.dataset.open === 'true';
      item.dataset.open = String(!open);
      button.setAttribute('aria-expanded', String(!open));
    });
  }

  // Selector
  for (const item of root.querySelectorAll('[data-select]')) {
    const trigger = item.querySelector('.app-select-trigger');
    const value = item.querySelector('[data-select-value]');
    const close = () => { item.dataset.open = 'false'; trigger?.setAttribute('aria-expanded', 'false'); };
    if (trigger) on(trigger, 'click', event => {
      event.stopPropagation();
      const open = item.dataset.open === 'true';
      item.dataset.open = String(!open);
      trigger.setAttribute('aria-expanded', String(!open));
    });
    for (const option of item.querySelectorAll('.app-select-option')) {
      on(option, 'click', () => {
        for (const other of item.querySelectorAll('.app-select-option')) other.setAttribute('aria-selected', 'false');
        option.setAttribute('aria-selected', 'true');
        if (value) value.textContent = option.textContent;
        close();
      });
    }
    on(document, 'click', event => { if (!item.contains(event.target)) close(); });
    on(document, 'keydown', event => { if (event.key === 'Escape') close(); });
  }

  // Chips - a jump-link chip navigates; only a plain chip toggles.
  for (const chip of root.querySelectorAll('.app-chip:not(a)')) {
    on(chip, 'click', () => chip.classList.toggle('is-active'));
  }

  // Clamp - the toggle owns the state; open removes the limit rather than measuring.
  for (const button of root.querySelectorAll('[data-clamp-toggle]')) {
    on(button, 'click', () => {
      const clamp = button.previousElementSibling;
      const open = clamp?.dataset.open === 'true';
      if (clamp) clamp.dataset.open = String(!open);
      button.setAttribute('aria-expanded', String(!open));
      button.textContent = open ? 'Show full' : 'Show less';
    });
  }

  // Dialog
  const dialog = root.querySelector('[data-dialog]');
  const dialogOpen = root.querySelector('[data-dialog-open]'), dialogClose = root.querySelector('[data-dialog-close]');
  if (dialogOpen) on(dialogOpen, 'click', () => dialog?.showModal());
  if (dialogClose) on(dialogClose, 'click', () => dialog?.close());

  // Sheet - same native <dialog>, bottom-anchored geometry.
  const sheet = root.querySelector('[data-sheet]');
  const sheetOpen = root.querySelector('[data-sheet-open]'), sheetClose = root.querySelector('[data-sheet-close]');
  if (sheetOpen) on(sheetOpen, 'click', () => sheet?.showModal());
  if (sheetClose) on(sheetClose, 'click', () => sheet?.close());

  // Toast - shows, then clears itself; a second tap restarts the timer.
  const toast = root.querySelector('[data-toast]');
  const toastOpen = root.querySelector('[data-toast-open]');
  let toastTimer = 0;
  if (toastOpen) on(toastOpen, 'click', () => {
    if (!toast) return;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  });

  // Tracks draw themselves in after first paint, the same way a page does it.
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!signal.aborted) page.dataset.trackReady = 'true'; }));

  return () => { controller.abort(); clearTimeout(toastTimer); dialog?.open && dialog.close(); sheet?.open && sheet.close(); formDialog?.close(''); };
}
