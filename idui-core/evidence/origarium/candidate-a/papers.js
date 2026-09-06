/* The archive and the reader — behaviour only.

   This module writes markup and reads data. It sets no style, names no colour,
   size, radius or face, and adds no class the library does not define. The
   only attributes it writes are the library's own semantic variants.

   The miniature on each card is a document surface carrying prose at caption
   scale - the same primitive the reader uses, sized down because a thumbnail
   depicts a document rather than being one to read. The card follows the
   original's shape: the framed part holds the paper and its number and date,
   and the title, summary and action sit loose beneath it. */
const papers = await fetch('../source/papers.fixture.json').then(r => r.json());

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dayLabel = iso => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
const number = index => `paper—${String(index + 1).padStart(2, '0')}`;

/* The opening of the body, as running text, for the miniature. The original
   sets the first lines of the paper itself into the thumbnail. */
const opening = (body, chars = 300) => body
  .replace(/^#+\s.*$/gm, '')          // headings
  .replace(/^-{3,}$/gm, '')           // rules
  .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
  .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
  .replace(/\s+/g, ' ').trim().slice(0, chars);

/* A paper's body is markdown-ish: headings, paragraphs, quotes. It becomes the
   library's prose, which is the one place a long-form face is allowed. */
function prose(body, title) {
  const inline = text => esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return body.split(/\n{2,}/).map(block => {
    const text = block.trim();
    if (!text || /^-{3,}$/.test(text)) return '';
    /* The body repeats its own title as the first line; the sheet already
       carries it, so it is not set twice. */
    if (text === title) return '';
    const heading = text.match(/^(#{1,3})\s+(.*)$/);
    if (heading) return `<h3 class="app-surface-title">${inline(heading[2])}</h3>`;
    if (text.startsWith('> ')) return `<p class="app-note">${inline(text.replace(/^>\s?/gm, ''))}</p>`;
    if (/^[-*]\s/m.test(text)) return `<ul>${text.split('\n').filter(l => /^[-*]\s/.test(l)).map(l => `<li>${inline(l.replace(/^[-*]\s/, ''))}</li>`).join('')}</ul>`;
    return `<p>${inline(text)}</p>`;
  }).join('');
}

function cardMarkup(paper, index) {
  return `<div class="app-stack" data-paper="${index}">
    <article class="app-card app-surface">
      <div class="app-card-section">
        <div class="app-card app-surface" data-surface="document">
          <p class="app-surface-title">${esc(paper.title)}</p>
          <div class="app-prose" data-size="caption"><p>${esc(opening(paper.body))}</p></div>
        </div>
      </div>
      <div class="app-row app-card-section" data-split="true">
        <span class="app-list-row-meta" data-size="micro">${number(index)}</span>
        <span class="app-list-row-meta" data-size="micro">${esc(dayLabel(paper.published_at))}</span>
      </div>
    </article>
    <h3 class="app-surface-title">${esc(paper.title)}</h3>
    <p class="app-surface-copy">${esc(paper.summary || '')}</p>
    <div class="app-utility-row">
      <button class="app-utility-action" type="button" data-open="${index}">[+] read_</button>
    </div>
  </div>`;
}

const archive = document.querySelector('[data-papers]');
archive.innerHTML = papers.map(cardMarkup).join('');

const reader = document.querySelector('[data-reader]');
const field = name => reader.querySelector(`[data-reader-${name}]`);

function open(index) {
  const paper = papers[index];
  field('crumb').textContent = `origarium / papers / ${paper.slug}`;
  field('eyebrow').textContent = `Paper · ${dayLabel(paper.published_at)}`;
  field('title').textContent = paper.title;
  field('body').innerHTML = prose(paper.body, paper.title);
  if (!reader.open) reader.showModal();
  reader.scrollTop = 0;
}

document.addEventListener('click', event => {
  const opener = event.target.closest('[data-open]');
  if (opener) { open(Number(opener.dataset.open)); return; }
  if (event.target.closest('[data-reader-close]')) reader.close();
});
/* Escape is the dialog element's own; nothing here has to add it. */

document.documentElement.dataset.ready = 'true';
