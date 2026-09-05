/* Artwork copy: the words that go on a promotion's artwork, drawn from the
   promotion record so the designer can lift them straight onto a menu, a
   standee or a screen. The title is F&B's, verbatim. Everything else is the
   record read back in the app's voice (/voice, 17 Promotion Copy):

     subtitle     the press release's headline with its venue clause taken
                  off ("Where crispy meets fluffy in every bite at Sip & Co."
                  becomes "Where crispy meets fluffy in every bite"), or the
                  brief's opening line when the headline is only the title
     body         one paragraph, the way it sits on the artwork: the
                  promotion's summary, then the dates, outlets and hours,
                  the prices, the terms, IHG One Rewards, the reservation
                  line and the enrollment link, sentence after sentence,
                  each written the way app-format.js writes it. Never a
                  table: the designer sets it as running copy
     channel      the distribution note ("In-hotel collaterals and screens
                  only") when the press copy carries one; it is not copy

   Nothing here is stored. Change the record and the artwork copy follows;
   the English and Thai press copy beside it stays the reference. */
import { formatDateRange, formatClock } from './app-format.js';
/* The hotel's own order of its outlets, for every list that names them. */
export const OUTLET_ORDER = ['ANJU', "Bangkok'78", 'Sip & Co.', 'Horizon Pool Bar', 'The Lobby Lounge', 'In-room Dining'];

const VENUES = ['ANJU', "Bangkok['’]78", 'Sip & Co\\.', 'Horizon Pool', 'The Lobby Lounge', 'In-room Dining', 'Sindhorn Midtown'];
const VENUE_TAIL = new RegExp(`[\\s,]+(?:at|from|with)\\s+(?:${VENUES.join('|')})[^.!?]*[.!?]*$`, 'i');
const PHONE = /(?:\+66\s*2|0?2)[\s-]?796[\s-]?8888/;
const EMAIL = /[a-z0-9._-]+@ihg\.com/i;
const ENROLL = /https?:\/\/\S+/i;
const PRICE = /(?:THB\s*)?(\d{1,3}(?:,\d{3})+|\d+)\s*(\+\+|net\b)(?:\s+per\s+((?:[a-z]+)(?:\s+for\s+two\s+persons)?))?/gi;
const TERMS = /advance|pre-order|required|limited prizes|dine free|free of charge|complimentary|per booking|minimum/i;

const lines = text => String(text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
const bare = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9ก-๙]+/g, ' ').trim();
const words = text => new Set(bare(text).split(' ').filter(w => w.length > 2));
const firstSentence = text => String(text).split(/(?<=[.!?])\s+/)[0];
const unshout = text => String(text).replace(/[.!]+$/, '').trim();
const sentence = text => { const t = String(text ?? '').trim(); return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : ''; };

/* A sentence that is a fact, not a line: a price, a date, hours, a phone
   number, a link, the availability sentence. Those belong to the body's
   fact sentences, never to the subtitle or the description. */
const FACTY = /THB|\d\s*(?:\+\+|net\b)|\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b20\d\d\b|https?:|@|796[\s-]?8888|^available\b|^save the date/i;
const STOP = new Set(['the', 'and', 'with', 'for', 'our', 'your', 'from', 'this', 'that', 'special']);
const titleWords = title => [...words(title)].filter(w => !STOP.has(w));
const sameWord = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
/* How much of a line is the title over again: 1 when every title word is
   there and they run together in order (“Celebrate Father's Day with a
   Thai Feast” for “Father's Day”); a fraction when the line only borrows
   from it (“Where Festive Flavors Meet Afternoon Elegance” for “Festive
   Afternoon Tea”). */
function titleShare(line, title) {
  const tw = titleWords(title), lw = bare(line).split(' ').filter(Boolean);
  if (!tw.length || !lw.length) return 0;
  const present = tw.filter(t => lw.some(l => sameWord(l, t)));
  if (present.length < tw.length) return present.length / tw.length * 0.5;
  const run = tw.every((t, i) => i === 0 || lw.findIndex(l => sameWord(l, t)) > lw.findIndex(l => sameWord(l, tw[i - 1])));
  return run || tw.length / lw.length >= 0.5 ? 1 : tw.length / lw.length;
}
const pieces = line => [line, ...line.split(/(?<=[.!?])\s+|\s+—\s+|(?<!\d)\s+–\s+(?!\d)/)].map(p => p.trim()).filter(Boolean);

/* The line the artwork leads with, after the title. The press headline
   with its venue clause taken off, unless it is the title said again — then
   the next line, or sentence, that is neither the title nor a fact. */
function subtitleOf(campaign) {
  const title = bare(campaign.title);
  const candidates = [...lines(campaign.copyEn).filter(l => !l.startsWith('*')), ...lines(campaign.brief), String(campaign.summary ?? '').trim()];
  const seen = [];
  for (let line of candidates) {
    line = line.replace(VENUE_TAIL, '').trim();
    if (line.includes(': ')) { const [head, ...rest] = line.split(': '); const shared = [...words(head)].filter(w => words(campaign.title).has(w)); if (shared.length) line = rest.join(': '); }
    if (!line || bare(line) === title || /^menu\b|^[•\-\d]/i.test(line)) continue;
    for (const piece of pieces(line)) {
      const clean = unshout(piece.replace(VENUE_TAIL, ''));
      if (clean.length < 12 || clean.length > 100 || FACTY.test(clean) || bare(clean) === title) continue;
      seen.push({ clean, share: titleShare(clean, campaign.title) });
    }
  }
  return (seen.find(s => s.share < 1 && s.clean.length <= 90) || seen.find(s => s.share < 0.5))?.clean || '';
}

/* The summary, then the press release's own sentences until the paragraph
   has some weight — no facts, nothing already said. */
function descriptionOf(campaign, subtitle) {
  const summary = String(campaign.summary ?? '').trim(), said = new Set([bare(summary), bare(subtitle), bare(campaign.title)]);
  const out = summary && bare(summary) !== bare(subtitle) ? [sentence(summary)] : [];
  const body = lines(campaign.copyEn).filter(l => !l.startsWith('*') && !/^menu\b|^[•\-\d]/i.test(l)).slice(1);
  for (const line of body) for (const raw of line.split(/(?<=[.!?])\s+/)) {
    const s = raw.trim(); if (!s) continue;
    if (FACTY.test(s) || s.length > 220 || said.has(bare(s))) continue;
    if (bare(subtitle) && (bare(s).includes(bare(subtitle)) || bare(subtitle).includes(bare(s)))) continue;
    if (out.length > 1 && out.join(' ').length + s.length > 360) return out.join(' ');
    out.push(sentence(s)); said.add(bare(s));
    if (out.join(' ').length >= 200 || out.length >= 4) return out.join(' ');
  }
  return out.join(' ');
}

/* "5 pm – 2 am" as the record keeps it, read through the clock formatter:
   "5 pm–2 am", "1–5 pm", "11:30 am–midnight". Text that is not a span of
   hours passes through unchanged. */
function hoursOf(text) {
  const t = String(text ?? '').trim();
  if (!t || /^tbc$/i.test(t)) return '';
  const part = piece => { const m = piece.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i); if (m) { let h = Number(m[1]) % 12; if (m[3].toLowerCase() === 'pm') h += 12; return `${String(h).padStart(2, '0')}:${m[2] || '00'}`; } if (/^midnight$/i.test(piece)) return '00:00'; if (/^noon$/i.test(piece)) return '12:00'; return null; };
  const m = t.match(/^(.+?)\s*[–-]\s*(.+)$/);
  if (!m) return t;
  const a = part(m[1].trim()), b = part(m[2].trim());
  return a && b ? formatClock(`${a}–${b}`) : t.replace(/\s*[–-]\s*/, '–');
}

const list = items => items.length <= 1 ? items.join('') : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

function pricesOf(campaign) {
  const found = [];
  for (const text of [campaign.copyEn, campaign.brief]) {
    for (const m of String(text ?? '').matchAll(PRICE)) {
      const amount = m[1].includes(',') ? m[1] : Number(m[1]).toLocaleString('en-US'), unit = m[2] === '++' ? '++' : ' net';
      if (!found.some(f => f.amount === amount && f.unit === unit)) found.push({ amount, unit, per: m[3] ? m[3].toLowerCase() : '' });
    }
  }
  if (!found.length) return '';
  if (found.length === 1) return `THB ${found[0].amount}${found[0].unit}${found[0].per ? ` per ${found[0].per}` : ''}`;
  if (found.length <= 3 || new Set(found.map(f => f.unit)).size > 1) return found.slice(0, 4).map(f => `THB ${f.amount}${f.unit}`).join(' · ');
  const values = found.map(f => Number(f.amount.replace(/,/g, '')));
  return `THB ${Math.min(...values).toLocaleString('en-US')}–${Math.max(...values).toLocaleString('en-US')}${found[0].unit}`;
}

/* Up to two sentences of conditions, skipping any the description already
   carries. */
function termsOf(campaign, already = '') {
  const out = [], said = bare(already);
  for (const line of lines(campaign.copyEn).slice(1)) for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    if (TERMS.test(sentence) && sentence.length <= 110 && !PHONE.test(sentence) && !ENROLL.test(sentence) && !said.includes(bare(sentence))) out.push(`${unshout(sentence)}.`);
    if (out.length === 2) return out.join(' ');
  }
  return out.join(' ');
}

/* "Available 21–27 September 2026 at ANJU (5 pm–2 am) and The Lobby Lounge
   (6:30 am–midnight)." Outlets that share their hours share the clause;
   hours the record has not confirmed are left out rather than promised. */
function availabilityOf(campaign, live, outlets) {
  const when = formatDateRange(campaign.start, campaign.end) || campaign.dateLabel || '';
  const hours = outlets.map(outlet => ({ outlet, hours: hoursOf(live.find(a => a.outlet === outlet)?.time) }));
  const unique = [...new Set(hours.map(h => h.hours).filter(Boolean))];
  let where = '';
  const at = outlets.length === 1 && outlets[0] === 'In-room Dining' ? 'through' : 'at';
  if (outlets.length) where = unique.length === 1 && hours.every(h => h.hours) ? `${at} ${list(outlets)}, ${unique[0]}` : `${at} ${list(hours.map(h => h.hours ? `${h.outlet} (${h.hours})` : h.outlet))}`;
  if (!when && !where) return '';
  return sentence(['Available', when, where].filter(Boolean).join(' '));
}

function priceSentence(campaign) {
  const price = pricesOf(campaign);
  if (!price) return '';
  if (price.includes(' · ')) return sentence(list(price.split(' · ')));
  if (/–/.test(price)) { const [lo, hi] = price.replace(/^THB /, '').split('–'); const unit = hi.match(/\+\+| net$/)[0]; return `From THB ${lo}${unit} to THB ${hi}.`; }
  return sentence(price);
}

function rewardsSentence(live) {
  const rewarded = live.filter(a => a.discount && !/^n\/a$/i.test(a.discount));
  const discounts = [...new Set(rewarded.map(a => a.discount))];
  if (!discounts.length) return '';
  return discounts.length === 1 ? `IHG One Rewards members save an extra ${discounts[0]}.` : `IHG One Rewards members save an extra ${list(rewarded.map(a => `${a.discount} at ${a.outlet}`))}.`;
}

export function artworkCopy(campaign) {
  const live = (campaign.activations || []).filter(a => !a.display);
  const seen = new Set(live.map(a => a.outlet)), outlets = [...OUTLET_ORDER.filter(o => seen.has(o)), ...[...seen].filter(o => !OUTLET_ORDER.includes(o))];
  const subtitle = subtitleOf(campaign), description = descriptionOf(campaign, subtitle), copyEn = String(campaign.copyEn ?? '');
  const contact = []; if (PHONE.test(copyEn)) contact.push('+66 2 796 8888'); const email = copyEn.match(EMAIL); if (email) contact.push(email[0].toLowerCase());
  const enroll = copyEn.match(ENROLL);
  const body = [
    description,
    availabilityOf(campaign, live, outlets),
    priceSentence(campaign),
    termsOf(campaign, description),
    rewardsSentence(live),
    contact.length ? `Reserve at ${contact.join(' or ')}.` : '',
    enroll ? `Join IHG One Rewards at ${enroll[0].replace(/[.,)]+$/, '')}.` : ''
  ].filter(Boolean).join(' ');
  const channel = lines(campaign.copyEn).find(l => l.startsWith('*'));
  return { title: String(campaign.title ?? ''), subtitle, body, channel: channel ? channel.replace(/^\*\s*/, '').replace(/^only\s+(.*)$/i, '$1 only').replace(/^./, c => c.toUpperCase()) : '' };
}
