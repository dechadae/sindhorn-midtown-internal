/* Artwork copy: the words that go on a promotion's artwork, drawn from the
   promotion record so the designer can lift them straight onto a menu, a
   standee or a screen. The title is F&B's, verbatim. Everything else is the
   record read back in the app's voice (/voice, 17 Promotion Copy):

     subtitle     the press release's headline with its venue clause taken
                  off ("Where crispy meets fluffy in every bite at Sip & Co."
                  becomes "Where crispy meets fluffy in every bite"), or the
                  brief's opening line when the headline is only the title
     description  the promotion's summary, the one-line version the index
                  already shows
     facts        dates, outlets, hours, prices, IHG One Rewards, the
                  enrollment link, reservations, channels and terms, each
                  written the way app-format.js writes it

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

/* The line the artwork leads with, after the title. */
function subtitleOf(campaign) {
  const title = bare(campaign.title);
  const candidates = [...lines(campaign.copyEn).filter(l => !l.startsWith('*')), ...lines(campaign.brief)];
  for (let line of candidates) {
    line = line.replace(VENUE_TAIL, '').trim();
    if (line.includes(': ')) { const [head, ...rest] = line.split(': '); const shared = [...words(head)].filter(w => words(campaign.title).has(w)); if (shared.length) line = rest.join(': '); }
    if (!line || bare(line) === title || /^menu\b/i.test(line)) continue;
    if (line.length > 90) line = firstSentence(line);
    if (line.length > 90 || line.length < 12) continue;
    return unshout(line);
  }
  return '';
}

function descriptionOf(campaign, subtitle) {
  const summary = String(campaign.summary ?? '').trim();
  if (summary && bare(summary) !== bare(subtitle)) return summary;
  const body = lines(campaign.copyEn).filter(l => !l.startsWith('*')).slice(1).find(l => l.length > 40);
  return body ? firstSentence(body) : summary;
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

function termsOf(campaign) {
  const out = [];
  for (const line of lines(campaign.copyEn).slice(1)) for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    if (TERMS.test(sentence) && sentence.length <= 110 && !PHONE.test(sentence) && !ENROLL.test(sentence)) out.push(`${unshout(sentence)}.`);
    if (out.length === 2) return out.join(' ');
  }
  return out.join(' ');
}

export function artworkCopy(campaign) {
  const live = (campaign.activations || []).filter(a => !a.display);
  const seen = new Set(live.map(a => a.outlet)), outlets = [...OUTLET_ORDER.filter(o => seen.has(o)), ...[...seen].filter(o => !OUTLET_ORDER.includes(o))];
  const subtitle = subtitleOf(campaign), description = descriptionOf(campaign, subtitle);
  const facts = [];
  facts.push({ label: 'When', value: formatDateRange(campaign.start, campaign.end) || campaign.dateLabel || '' });
  if (outlets.length) facts.push({ label: 'Where', value: list(outlets) });
  const hours = outlets.map(outlet => ({ outlet, hours: hoursOf(live.find(a => a.outlet === outlet)?.time) })).filter(h => h.hours);
  if (hours.length) { const unique = [...new Set(hours.map(h => h.hours))]; facts.push({ label: 'Hours', value: unique.length === 1 ? unique[0] : hours.map(h => `${h.outlet} ${h.hours}`).join(' · ') }); }
  else facts.push({ label: 'Hours', value: 'To be confirmed' });
  const price = pricesOf(campaign); if (price) facts.push({ label: 'Price', value: price });
  const discounts = [...new Set(live.map(a => a.discount).filter(d => d && !/^n\/a$/i.test(d)))];
  if (discounts.length) facts.push({ label: 'IHG One Rewards', value: discounts.length === 1 ? `Members save an extra ${discounts[0]}` : live.filter(a => a.discount && !/^n\/a$/i.test(a.discount)).map(a => `${a.outlet} ${a.discount}`).join(' · ') });
  const enroll = String(campaign.copyEn ?? '').match(ENROLL); if (enroll) facts.push({ label: 'Join IHG One Rewards', value: enroll[0].replace(/[.,)]+$/, ''), link: true });
  const contact = []; if (PHONE.test(campaign.copyEn ?? '')) contact.push('+66 2 796 8888'); const email = String(campaign.copyEn ?? '').match(EMAIL); if (email) contact.push(email[0].toLowerCase());
  if (contact.length) facts.push({ label: 'Reservations', value: contact.join(' · ') });
  const channel = lines(campaign.copyEn).find(l => l.startsWith('*')); if (channel) facts.push({ label: 'Channels', value: channel.replace(/^\*\s*/, '').replace(/^only\s+(.*)$/i, '$1 only').replace(/^./, c => c.toUpperCase()) });
  const terms = termsOf(campaign); if (terms) facts.push({ label: 'Terms', value: terms });
  return { title: String(campaign.title ?? ''), subtitle, description, facts };
}
