/* The disclosure toggle, once. Four pages carried their own copy of these six
   lines (Brand, F&B, Today, sign-in) and the library a fifth; the IDUI document
   counted it as the shell's last behavior duplicate. r35 folds them into this
   module and Jobs becomes the sixth consumer without adding a seventh copy.

   The primitive has two shapes and this serves both: the whole head as one
   .app-disclosure-button, or - when the head carries its own controls, as a
   job card's status selector does - a .app-disclosure-toggle beside them.
   Either way the state lives in data-open on the [data-disclosure] root and
   aria-expanded on whichever control was pressed. */

/* Called from a page's own delegated click handler. Returns the root and its
   new state so a page can remember what is open, or null when the click was
   not on a disclosure control. */
export function toggleDisclosure(target) {
  const control = target?.closest?.('.app-disclosure-button, .app-disclosure-toggle');
  if (!control) return null;
  const root = control.closest('[data-disclosure]');
  if (!root) return null;
  const open = root.dataset.open !== 'true';
  root.dataset.open = String(open);
  control.setAttribute('aria-expanded', String(open));
  return { root, open, control };
}

/* For a host that has no click handler of its own. onToggle receives the same
   record, so a page can persist which items are open. */
export function bindDisclosures(host, { signal, onToggle } = {}) {
  const onClick = event => { const result = toggleDisclosure(event.target); if (result && onToggle) onToggle(result); };
  host.addEventListener('click', onClick, signal ? { signal } : undefined);
  return () => host.removeEventListener('click', onClick);
}
