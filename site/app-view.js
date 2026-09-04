/* One way a view gives way to the next.

   The shell swaps whole pages inside one host. Without this, a tab change is
   a cut: the old markup vanishes and the new markup appears. This module
   hands the swap to the browser's view transition: it captures the old page
   and the new page as pictures - blur, fill and edge already in the pixels -
   and app-components.css moves the pictures in the direction the shell
   chooses:

     push     out left, in from the right    (a tab to the right)
     pop      out right, in from the left    (a tab to the left)
     cover    out upward, in from below      (Settings, sign-in)
     dismiss  out downward, in from above    (closing them)
     none     a plain swap (first paint, reduced motion, an empty host)

   Moving pictures is what keeps it smooth on a phone and keeps the glass
   real: nothing re-samples the atmosphere mid-move, and the frosted material
   is in the capture. Earlier versions moved or faded the live page; moving
   it stuttered (every card re-sampling each frame) and fading it switched
   the blur off (an ancestor below full opacity ends the backdrop).

   The pictures, the beats and the curve live in app-components.css under
   "View transitions"; app-tokens.css holds the distances and durations.
   This file names the direction and the moving host on the root, measures
   how far the old page was scrolled (the old picture is the whole page, so
   it is shifted to stay where the reader was looking), runs the swap inside
   the transition, and cleans up. A browser without startViewTransition gets the plain swap. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const native = () => typeof document.startViewTransition === 'function';

let run = 0, active = null;

/* transitionView(host, kind, swap, { within })

   swap() disposes the old view and mounts the new one into host; it may be
   async (a route module still loading), and runs while the browser holds
   the old picture, so neither page is ever seen off its place. `within`
   names a bounded frame whose scroll resets instead of the document's; the
   library's specimen uses it, the shell does not. */
export async function transitionView(host, kind, swap, { within = null } = {}) {
  const mine = ++run;
  const root = document.documentElement;
  if (kind === 'none' || reduced() || !native() || !host.childElementCount) {
    await swap();
    return;
  }
  active?.skipTransition();
  root.dataset.viewKind = kind;
  root.dataset.viewScope = within ? 'demo' : 'page';
  root.style.setProperty('--app-view-scroll', within ? '0px' : `${Math.max(0, Math.round(scrollY))}px`);
  const transition = document.startViewTransition(async () => {
    if (within) within.scrollTop = 0; else scrollTo(0, 0);
    await swap();
  });
  active = transition;
  try { await transition.finished; } catch (_) { /* skipped or superseded: the swap still ran */ }
  if (mine !== run) return;
  active = null;
  delete root.dataset.viewKind;
  delete root.dataset.viewScope;
  root.style.removeProperty('--app-view-scroll');
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
