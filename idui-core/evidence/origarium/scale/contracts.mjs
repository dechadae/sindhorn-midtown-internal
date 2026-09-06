/* The contracts, shared by every run at scale so a second fixture cannot be
   judged by a friendlier standard than the first. Each is a property of the
   rendered result, not an opinion, and none of them repairs anything. */
export /* Every contract is a property of the rendered result, not an opinion. */
const CONTRACTS = `([cardSel, thumbSel]) => {
  const out = [];
  const cards = [...document.querySelectorAll(cardSel)];
  const docWidth = document.documentElement.clientWidth;
  for (const [i, card] of cards.entries()) {
    const box = card.getBoundingClientRect();
    const fail = reason => out.push({index: i, reason});
    if (box.width < 8 || box.height < 8) fail('collapsed');
    if (box.right > docWidth + 1 || box.left < -1) fail('overflows the viewport');
    const thumb = card.querySelector(thumbSel);
    if (!thumb) fail('no document preview');
    else {
      const t = thumb.getBoundingClientRect();
      if (t.width < 8 || t.height < 8) fail('preview collapsed');
      if (t.width > box.width + 1) fail('preview wider than its card');
      const ratio = t.width / t.height;
      if (Math.abs(ratio - 0.7071) > 0.02) fail('preview is not a page (' + ratio.toFixed(3) + ')');
    }
    /* text that leaves its own box, which is what long titles do */
    for (const el of card.querySelectorAll('h3,h2,p,span')) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible') { fail('text overflows: ' + el.tagName.toLowerCase()); break; }
    }
  }
  /* rows must stay equal: peers laid side by side are the same width */
  const widths = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().width)))];
  return {failures: out, cards: cards.length, distinctCardWidths: widths.length,
    distinctPreviewSizes: [...new Set(cards.map(c => { const t = c.querySelector(thumbSel); if (!t) return 'none';
      const b = t.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); }))].length};
}`;
