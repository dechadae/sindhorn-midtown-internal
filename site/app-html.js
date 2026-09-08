/* The markup helpers every page module had written for itself (r40, r70).

   A page brings markup and behavior; these are the parts of writing markup
   that were provably not the page's own. Each was identical - byte for byte,
   thirteen times for esc - across the modules that had it, which is the
   evidence that it belongs here rather than in each of them. r40 moved the
   first three; r70 moved the metric, the disclosure, the card skeleton and the
   retry row on the same evidence, and the release brief's pixel diff read
   clean, which is the proof that nothing moved but the code.

   What stayed behind is as deliberate as what moved. A page's field() builders
   differ in signature and validation, and its loading composition differs in
   shape, because both describe that page's own content; the library's rule is
   that a composition adopted by a second page is questioned, not promoted, and
   those were not the same composition twice. Today's metric with its delta and
   track is one of those: a different composition that shares a name, so it
   stays in today.js. The helpers here were the same fragment twice or more. */

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

/* The card a page shows while its content loads: three lines, the middle one
   full. Messages and Settings wrote the same one; the business card keeps its
   own because its middle line is the square the QR will fill. */
export const skeletonCard = () =>
  `<div class="app-card app-surface"><div class="app-skeleton">${skeletonLine('short')}${skeletonLine('')}${skeletonLine('medium')}</div></div>`;

/* A label over a value in a metric grid, with an optional note under it. Brand
   had the note, F&B and Settings did not; a note defaults away, so one helper
   serves all four. The value is rendered as given - a page that shows a dash
   for a missing value decides that at its own call site, because a zero is a
   value on F&B and a blank on Me. */
export const metric = (label, value, note = '') =>
  `<div class="app-metric"><span class="app-metric-label">${esc(label)}</span><span class="app-metric-value">${esc(value)}</span>${note ? `<span class="app-metric-note">${esc(note)}</span>` : ''}</div>`;

/* A disclosure: the head as its one button, the chevron, the panel. Today and
   Brand wrote it; Brand's carries an item id for deep links and can open on
   arrival, and both default away. The panel's inner wrapper is the one child
   the library pads and rules, and what it is depends on the body: a stack when
   the body is loose blocks that need the row gap (Brand), a plain box when the
   body rules itself with card sections (Today). The caller says which. */
const DISCLOSURE_CHEVRON = '<svg class="app-disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg>';
export const disclosure = ({ id = '', kicker = '', title, copy = '', body, open = false, stack = false }) =>
  `<article class="app-disclosure" data-disclosure${id ? ` data-item="${esc(id)}"` : ''}${open ? ' data-open="true"' : ''}><button class="app-disclosure-button" type="button" aria-expanded="${open}"><span class="app-disclosure-head">${kicker ? `<span class="app-disclosure-kicker">${esc(kicker)}</span>` : ''}<span class="app-disclosure-title">${esc(title)}</span>${copy ? `<span class="app-disclosure-copy">${esc(copy)}</span>` : ''}</span>${DISCLOSURE_CHEVRON}</button><div class="app-disclosure-panel"><div class="app-disclosure-panel-inner">${stack ? '<div class="app-stack">' : '<div>'}${body}</div></div></div></article>`;

/* The row under a failed view that offers one more try. The hook is the
   attribute the page's own handler listens for. Three Settings modules wrote
   it four times; F&B's carries an icon and Today's is a primary control, so
   those two stay where they are. */
export const retryRow = hook =>
  `<div class="app-utility-row"><button class="app-utility-action" type="button" ${hook}>Try again</button></div>`;
