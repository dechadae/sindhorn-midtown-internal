/* One way a view gives way to the next.

   The shell swaps whole pages inside one host. Without this, a tab change is
   a cut: the old markup vanishes and the new markup appears. This module
   keeps the cut and adds a fade: the new view fades up in place, and the
   shell names the movement it stands for so the navbar can push to match:

     push     a tab to the right
     pop      a tab to the left
     cover    a deeper layer arriving (Settings, sign-in)
     dismiss  the page beneath returning (closing them)
     none     a plain swap (first paint, reduced motion, an empty host)

   Only the incoming page animates, and only its opacity. Tried before this:
   a two-surface slide with the outgoing page held as a clone, then a short
   transform-only settle; both stuttered on the phone, where every frosted
   card re-samples the live atmosphere each frame it moves. A fade never
   moves a card. Chrome switches the backdrop blur beneath a fading page off
   until it lands (measured; the flash is the length of the fade), which is
   the trade the shell makes for a smooth arrival.

   Duration and curve live in app-tokens.css; the keyframes in
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
   async (a route module still loading). The host goes hidden before the
   swap - so the new page is never seen before its fade begins - and runs
   as soon as the swap lands. `within` names a
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
