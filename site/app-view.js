/* One way a view gives way to the next.

   The shell swaps whole pages inside one host. Without this, a tab change is
   a cut: the old markup vanishes and the new markup appears. This module
   keeps the cut and adds a settle: the new view arrives a short way off its
   place and eases in, in the direction the shell chooses:

     push     the new view arrives from the right (a tab to the right)
     pop      the new view arrives from the left (a tab to the left)
     cover    a deeper layer arrives from the foot (Settings, sign-in)
     dismiss  the page beneath returns from the head (closing them)
     none     a plain swap (first paint, reduced motion, an empty host)

   Only the incoming page moves, and only by a transform. Nothing recedes,
   scales or fades: opacity, filter or mask on the moving page - or on
   anything above it - defeats backdrop-filter and the frosted material
   flashes flat mid-move, so a crossfade is not available to a glass shell.
   Measured in Chrome: an ancestor at opacity .6 leaves the blur at 0; a
   transformed ancestor leaves it intact.

   Travel, duration and the curve live in app-tokens.css; the keyframes in
   app-components.css under "View transitions". This file only sequences
   the swap. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = 0;

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
   async (a route module still loading). The host takes its start pose,
   hidden, before the swap - so neither the old page nor the new one is ever
   seen off its place - and runs as soon as the swap lands. `within` names a
   bounded frame whose scroll resets instead of the document's; the
   library's specimen uses it, the shell does not. */
export async function transitionView(host, kind, swap, { within = null } = {}) {
  const mine = ++run;
  if (kind === 'none' || reduced() || !host.childElementCount) {
    delete host.dataset.view;
    delete host.dataset.run;
    await swap();
    return;
  }
  delete host.dataset.run;
  host.dataset.view = kind;
  if (within) within.scrollTop = 0; else scrollTo(0, 0);

  await swap();
  if (mine !== run) return;

  host.dataset.run = '';
  await finished(host);
  /* A later call owns the host now; leave its pose alone. */
  if (mine !== run) return;
  delete host.dataset.view; delete host.dataset.run;
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
