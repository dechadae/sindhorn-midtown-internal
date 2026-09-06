/* The three markup helpers every page module had written for itself (r40).

   A page brings markup and behavior; these are the parts of writing markup
   that were provably not the page's own. Each was identical - byte for byte,
   thirteen times for esc - across the modules that had it, which is the
   evidence that it belongs here rather than in each of them.

   What stayed behind is as deliberate as what moved. A page's field() builders
   differ in signature and validation, and its skeleton differs in shape,
   because both describe that page's own content; the library's rule is that a
   composition adopted by a second page is questioned, not promoted, and those
   were not the same composition twice. These three were. */

/* Text into markup. Never a substitute for the library: it escapes content,
   it does not decide appearance. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* An empty, loading or failed view. Six modules wrote this, three of them with
   an attrs argument and three without; the argument defaults away, so one
   helper serves both. */
export const state = (label, title, copy, tone = 'empty', attrs = '') =>
  `<div class="app-state app-card" data-tone="${tone}"${attrs}><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;

/* One line of a skeleton. Width and size are the library's own attributes, so
   a page names a proportion rather than a measurement. */
export const skeletonLine = (width = '', size = '') =>
  `<div class="app-skeleton-line"${width ? ` data-width="${width}"` : ''}${size ? ` data-size="${size}"` : ''}></div>`;
