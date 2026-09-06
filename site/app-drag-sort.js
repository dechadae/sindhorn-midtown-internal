/* Drag to reorder — the shell's first drag gesture (r35).

   The gesture is the one the employee already knows from the Flipgazine job
   board: press and hold, the card lifts, the list parts around it, release
   commits. Held 280ms with a 10px slop, so any earlier movement is a scroll
   and the lift never happens - which is also what keeps this off the shell's
   pull-to-refresh, since that gesture starts moving immediately.

   The module owns no appearance. It sets data-dragging on the item and on the
   list; every rule for those lives in app-components.css.

   sortDrag(root, { item, handleFrom, onCommit, signal })
     root        a stable element to listen on; it survives the page repainting
     item        selector for a draggable child of a [data-sortable] list
     handleFrom  optional: return false to refuse a press (a control, a link)
     onCommit    receives the ids in their new order, in DOM order

   The list itself is read at press time, not bound, so a page may repaint its
   whole list between drags. */

const HOLD = 280, SLOP = 10, EDGE = 110, MAX_STEP = 18;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function sortDrag(root, { item, handleFrom, onCommit, signal } = {}) {
  let drag = null;

  const items = list => Array.from(list.querySelectorAll(`:scope > ${item}`));

  function begin(el, list, y) {
    drag = { el, list, lastY: y, raf: 0 };
    el.dataset.dragging = 'true';
    list.dataset.dragging = 'true';
    // Collapse while it travels: a lifted card is one row, not a tall one.
    if (el.dataset.open === 'true') { el.dataset.open = 'false'; el.querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false'); }
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* no haptics, no matter */ } }
    if (!reduced()) drag.raf = requestAnimationFrame(autoScroll);
  }

  /* Hold near an edge and the page comes to you, so a list taller than the
     screen can be reordered end to end. */
  function autoScroll() {
    if (!drag) return;
    const y = drag.lastY, vh = innerHeight;
    let step = 0;
    if (y < EDGE) step = -Math.ceil((EDGE - y) / EDGE * MAX_STEP);
    else if (y > vh - EDGE) step = Math.ceil((y - (vh - EDGE)) / EDGE * MAX_STEP);
    if (step) scrollBy(0, step);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  /* One place at a time: the card passes its neighbour only once the pointer
     has crossed that neighbour's middle. Testing the whole list instead would
     let a single move cascade through several siblings, so a one-place drag
     could travel two. Boxes are read each move, so this stays honest while the
     page scrolls underneath. */
  function moveTo(y) {
    if (!drag) return;
    const down = y > drag.lastY;
    drag.lastY = y;
    const { el, list } = drag;
    const row = items(list), at = row.indexOf(el);
    if (at < 0) return;
    const neighbour = down ? row[at + 1] : row[at - 1];
    if (!neighbour) return;
    const box = neighbour.getBoundingClientRect(), middle = box.top + box.height / 2;
    if (down ? y > middle : y < middle) list.insertBefore(el, down ? neighbour.nextSibling : neighbour);
  }

  function end(commit) {
    if (!drag) return;
    const { el, list } = drag;
    cancelAnimationFrame(drag.raf);
    delete el.dataset.dragging;
    delete list.dataset.dragging;
    drag = null;
    /* The release that ended a drag must not also read as a tap. The click
       that follows a pointerup arrives later on touch than on mouse, so the
       mark outlives both and clears itself. */
    el.dataset.dragged = 'true';
    setTimeout(() => { delete el.dataset.dragged; }, 300);
    if (commit && onCommit) onCommit(items(list).map(node => node.dataset.id).filter(Boolean));
  }

  function down(event) {
    const el = event.target.closest?.(item);
    const list = el?.parentElement;
    if (!el || !list || list.dataset.sortable !== 'true') return;
    if (event.button && event.button !== 0) return;
    if (handleFrom && handleFrom(event.target) === false) return;

    const sx = event.clientX, sy = event.clientY;
    let held = false, done = false;
    const timer = setTimeout(() => { held = true; begin(el, list, sy); }, HOLD);

    const onMove = ev => {
      if (done) return;
      if (!held) { if (Math.abs(ev.clientY - sy) > SLOP || Math.abs(ev.clientX - sx) > SLOP) finish(false); return; }
      ev.preventDefault();
      moveTo(ev.clientY);
    };
    const onUp = () => finish(true);
    // While a card is lifted the page must not scroll under the finger.
    const block = ev => { if (drag) ev.preventDefault(); };
    function finish(commit) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      removeEventListener('touchmove', block);
      if (held) end(commit);
    }

    addEventListener('pointermove', onMove, { passive: false });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    addEventListener('touchmove', block, { passive: false });
  }

  root.addEventListener('pointerdown', down, signal ? { signal } : undefined);
  return () => root.removeEventListener('pointerdown', down);
}
