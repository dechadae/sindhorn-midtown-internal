/* One way a view gives way to the next.

   The shell swaps whole pages inside one host. Without this, a tab change is
   a cut: the old markup vanishes and the new markup appears. This module
   turns the swap into the two-beat movement the F&B index and detail have
   always used - the outgoing page fades as it slips a little, the swap
   happens while nothing shows, the incoming page fades up as it slips into
   place from the other side - in the direction the shell chooses:

     push     out left, in from the right    (a tab to the right)
     pop      out right, in from the left    (a tab to the left)
     cover    out upward, in from below      (Settings, sign-in)
     dismiss  out downward, in from above    (closing them)
     none     a plain swap (first paint, reduced motion, an empty host)

   Only the live host animates; there is no clone of the outgoing page. Fade
   and slip together are what keep it smooth on a phone: while the page's
   opacity is below 1 the backdrop blur beneath its cards is not sampled, so
   the frosted material costs nothing mid-move and lands with the page.

   Distances, durations and the curve live in app-tokens.css; the keyframes
   in app-components.css under "View transitions". This file only sequences
   the beats. */

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
   async (a route module still loading). It runs after the out beat, while
   the host is held invisible, so neither the old page nor the new one is
   ever seen off its place. `within` names a bounded frame whose scroll
   resets instead of the document's; the library's specimen uses it, the
   shell does not. */
export async function transitionView(host, kind, swap, { within = null } = {}) {
  const mine = ++run;
  if (kind === 'none' || reduced() || !host.childElementCount) {
    delete host.dataset.view;
    delete host.dataset.viewPhase;
    await swap();
    return;
  }
  host.dataset.view = kind;
  host.dataset.viewPhase = 'out';
  await finished(host);
  if (mine !== run) return;

  if (within) within.scrollTop = 0; else scrollTo(0, 0);
  await swap();
  if (mine !== run) return;

  host.dataset.viewPhase = 'in';
  await finished(host);
  /* A later call owns the host now; leave its pose alone. */
  if (mine !== run) return;
  delete host.dataset.view; delete host.dataset.viewPhase;
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
