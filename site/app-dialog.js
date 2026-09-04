/* One dialog, asked from code.

   The Dialog Standard in /ci is markup: a native <dialog class="app-dialog
   app-overlay"> with a head, copy and actions. Pages that need a yes-or-no
   moment - sign out, discard, revoke - should not each hand-build that
   markup. confirmDialog() builds it once, shows it, and resolves with the
   employee's answer.

   The dialog is a native element, so Escape, focus trapping and the scrim
   all come from the platform. The form's method="dialog" makes the confirm
   button close it with returnValue "confirm"; anything else - Cancel, Escape,
   a tap on the scrim - resolves false. The element is removed after it
   closes, so nothing lingers in the shell between asks. */

const text = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function confirmDialog({ kicker = '', title, copy = '', confirm = 'Confirm', cancel = 'Cancel', tone = '' } = {}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-dialog app-overlay';
    dialog.dataset.confirm = '';
    dialog.innerHTML = `
      <form method="dialog" class="app-dialog-body">
        <div class="app-dialog-head">
          <div>
            ${kicker ? `<p class="app-dialog-kicker">${text(kicker)}</p>` : ''}
            <h2 class="app-dialog-title">${text(title)}</h2>
          </div>
        </div>
        ${copy ? `<p class="app-dialog-copy">${text(copy)}</p>` : ''}
        <div class="app-dialog-actions">
          <button class="app-utility-action" type="button" data-dialog-cancel>${text(cancel)}</button>
          <button class="app-primary app-control" value="confirm" data-dialog-confirm${tone ? ` data-tone="${text(tone)}"` : ''}>${text(confirm)}</button>
        </div>
      </form>`;
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close(''));
    // The scrim is part of the dialog element; a tap that lands outside the body is a dismissal.
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(''); });
    dialog.addEventListener('close', () => { const answer = dialog.returnValue === 'confirm'; dialog.remove(); resolve(answer); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('[data-dialog-cancel]').focus();
  });
}

/* A dialog with a body of the page's own - a form, a card, a code - still
   opens, dismisses and cleans up the same way. openDialog() takes the body
   markup, wires the scrim, Escape and any [data-dialog-close] control, and
   removes the element after it closes. The page keeps the returned element
   only as long as it is open. */
export function openDialog(markup, { onClose } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog app-overlay';
  dialog.innerHTML = markup;
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close(''); });
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(dialog.returnValue); }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

const CLOSE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';

/* The head every page dialog shares: kicker, title and the close control. */
export function dialogHead(kicker, title) {
  return `<div class="app-dialog-head"><div>${kicker ? `<p class="app-dialog-kicker">${text(kicker)}</p>` : ''}<h2 class="app-dialog-title">${text(title)}</h2></div><button class="app-close-control" type="button" data-dialog-close aria-label="Close">${CLOSE_ICON}</button></div>`;
}
