/* One way a view gives way to the next.

   The shell swaps whole pages inside one host. Without this, a tab change is
   a cut: the old markup vanishes and the new markup appears. This module
   turns the swap into a movement with a spatial meaning the shell chooses:

     push     the new view arrives from the right; the old one recedes left
     pop      the old view leaves to the right; the one beneath settles back
     cover    the new view rises from below and the old one recedes behind it
     dismiss  the old view drops away below, revealing the one beneath
     none     a plain swap (first paint, reduced motion, an empty host)

   Every movement is a transform. Nothing here animates opacity, filter or
   mask, because any of those on an ancestor - or on the glass itself -
   defeats backdrop-filter and the frosted material flashes flat mid-move.
   Measured in Chrome: an ancestor at opacity .6 leaves the blur at 0; a
   transformed ancestor leaves it intact.

   The outgoing view is a clone in a ghost layer that sits over the atmosphere
   at the same place and scroll offset the live page had, so the swap can
   happen underneath while the employee watches the old page move. The clone
   is inert and stripped of ids; it is a picture, not a page.

   Keyframes, durations and the curve live in app-components.css under
   "View transitions"; this file only builds the ghost, sequences the swap
   and cleans up. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

let ghost = null, run = 0;

function retire() {
  ghost?.remove();
  ghost = null;
}

function buildGhost(host, kind, within) {
  const layer = document.createElement('div');
  layer.className = 'app-view-ghost';
  layer.dataset.kind = kind;
  if (within) layer.dataset.scope = 'local';
  const scroll = document.createElement('div');
  scroll.className = 'app-view-ghost-scroll';
  const clone = host.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('data-view');
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  for (const node of clone.querySelectorAll('[id]')) node.removeAttribute('id');
  scroll.append(clone);
  layer.append(scroll);
  return { layer, scroll };
}

/* Resolves when the host's own animation ends, or after its declared
   duration plus a margin if the event never arrives (a hidden tab, a
   display change), so a page is never left mid-transform. */
function finished(host) {
  const duration = parseFloat(getComputedStyle(host).animationDuration) || 0;
  const ms = (duration < 10 ? duration * 1000 : duration) + 120;
  return new Promise(resolve => {
    const done = event => { if (!event || event.target === host) { host.removeEventListener('animationend', done); resolve(); } };
    host.addEventListener('animationend', done);
    setTimeout(() => done(), ms);
  });
}

/* transitionView(host, kind, swap, { within })

   swap() disposes the old view and mounts the new one into host; it may be
   async (a route module still loading). The ghost holds the old picture
   still until swap resolves, then both layers move together. `within` scopes
   the ghost to a bounded frame instead of the viewport - the library's
   specimen uses it; the shell does not. */
export async function transitionView(host, kind, swap, { within = null } = {}) {
  const mine = ++run;
  if (kind === 'none' || reduced() || !host.childElementCount) {
    retire();
    delete host.dataset.view;
    delete host.dataset.run;
    await swap();
    return;
  }
  retire();
  const { layer, scroll } = buildGhost(host, kind, within);
  ghost = layer;
  const scroller = within || document.scrollingElement || document.documentElement;
  const scrolled = within ? within.scrollTop : scrollY;
  host.before(layer);
  scroll.scrollTop = scrolled;

  /* The host takes its start pose, paused, before the swap so the new view
     never flashes in place; the ghost stays put over it. */
  delete host.dataset.run;
  host.dataset.view = kind;
  if (within) host.dataset.viewScope = 'local'; else delete host.dataset.viewScope;
  await settle();
  if (within) within.scrollTop = 0; else scroller.scrollTop = 0;

  await swap();
  if (mine !== run) return;

  await settle();
  if (mine !== run) return;
  layer.dataset.run = '';
  host.dataset.run = '';
  await finished(host);
  /* A later call owns the host now; leave its pose alone. */
  if (mine !== run) return;
  retire();
  delete host.dataset.view; delete host.dataset.run; delete host.dataset.viewScope;
}

/* The movement between two places in the shell's spatial model.
   `layer` ranks depth: 0 the app tabs, 1 Settings and the library it holds,
   2 sign-in, which covers everything. `order` ranks siblings on one layer. */
export function viewKind(from, to, { layer, order }) {
  if (!from || from === to) return 'none';
  const depthFrom = layer(from), depthTo = layer(to);
  if (depthTo > depthFrom) return 'cover';
  if (depthTo < depthFrom) return 'dismiss';
  const indexFrom = order(from), indexTo = order(to);
  if (indexFrom < 0 || indexTo < 0 || indexFrom === indexTo) return 'none';
  return indexTo > indexFrom ? 'push' : 'pop';
}
