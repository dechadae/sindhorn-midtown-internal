/* The UI Library's behaviour, shared by the standalone page (/ci) and the
   shell route (/next#ci). One binding for one markup contract, so the two
   cannot drift apart: components that ship behaviour in the app (the
   selector, disclosure, clamp) are demonstrated with exactly the markup the
   pages use. bindLibrary(root) wires every specimen under root and returns a
   dispose function; nothing here touches the document outside root except
   the two listeners the selector needs to close on an outside tap. */

import { bindCode } from './app-code.js';

export function bindLibrary(root, { page = root } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal });

  // Code group - the same behaviour the sign-in page binds.
  bindCode(root, { signal });

  // Shell demo - the account chip switches the navbar between its two sets,
  // exactly as the router does on /next.
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

  return () => { controller.abort(); clearTimeout(toastTimer); dialog?.open && dialog.close(); sheet?.open && sheet.close(); };
}
