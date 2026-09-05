/* Dates, times, money and counts, written once the way the Voice library
   (/voice, 07 Dates & Numbers) says. Every page reads through here so a
   timestamp never gets its own spelling in a route.

   Hotel time always (Asia/Bangkok), never a zone suffix. The language of the
   sentence picks the calendar and the clock:
     en  "5 Sep 2026 · 6 pm"        day month year, 12-hour, no leading zero,
                                    no :00 on the hour, noon and midnight
     th  "5 ก.ย. 2569 · 18:00 น."    day month year (Buddhist), 24-hour
   English chrome passes nothing; Thai text (a Thai broadcast body, the Thai
   half of a guest page) passes lang: 'th'. */

const ZONE = 'Asia/Bangkok';
const LOCALE = { en: 'en-US', th: 'th-TH-u-ca-buddhist' };

/* A Date from anything a page holds: a Date, epoch milliseconds, an ISO
   timestamp, or a bare day "2026-09-05" (read as hotel midnight). */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  const text = String(value).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00+07:00`) : new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parts(date, lang, options) {
  const out = {};
  for (const part of new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, { timeZone: ZONE, ...options }).formatToParts(date)) out[part.type] = part.value;
  return out;
}

/* "5 Sep 2026" (short), "5 September 2026" (long), "Fri 5 Sep 2026" (day),
   "Friday 5 September 2026" (weekday), "Sep 2026" (month). A weekday never
   takes a comma. Thai: "5 ก.ย. 2569", "5 กันยายน 2569", "ศ. 5 ก.ย. 2569" as the locale spells it,
   "ศุกร์ 5 กันยายน 2569", "ก.ย. 2569". */
export function formatDate(value, { style = 'short', lang = 'en' } = {}) {
  const date = toDate(value); if (!date) return '';
  const th = lang === 'th';
  const short = style === 'short' || style === 'month' || style === 'day';
  const p = parts(date, lang, { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric', weekday: style === 'weekday' ? 'long' : style === 'day' ? 'short' : undefined });
  const year = th ? p.year.replace(/^พ\.ศ\.\s*/, '') : p.year;
  if (style === 'month') return `${p.month} ${year}`;
  const day = `${p.day} ${p.month} ${year}`;
  if (!p.weekday) return day;
  return `${th ? p.weekday.replace(/^วัน/, '') : p.weekday} ${day}`;
}

/* "6 pm", "6:30 pm", "11:30 am", "noon", "midnight". Thai: "18:00 น." */
export function formatTime(value, { lang = 'en' } = {}) {
  const date = toDate(value); if (!date) return '';
  const p = parts(date, 'en', { hour: 'numeric', minute: '2-digit', hour12: false });
  const hour = Number(p.hour) % 24, minute = Number(p.minute);
  if (lang === 'th') return `${String(hour).padStart(2, '0')}:${p.minute} น.`;
  if (minute === 0 && hour === 12) return 'noon';
  if (minute === 0 && hour === 0) return 'midnight';
  const twelve = hour % 12 || 12, meridiem = hour < 12 ? 'am' : 'pm';
  return minute === 0 ? `${twelve} ${meridiem}` : `${twelve}:${p.minute} ${meridiem}`;
}

/* "5 Sep 2026 · 6 pm" - the date style is the page's choice. */
export function formatDateTime(value, { style = 'short', lang = 'en' } = {}) {
  const date = toDate(value); if (!date) return '';
  return `${formatDate(date, { style, lang })} · ${formatTime(date, { lang })}`;
}

/* A clock written as "17:00" or "17:00–02:00", the way the factsheet keeps
   hours, read in the voice: "5 pm", "5 pm–2 am", "6:30–11 am" (one meridiem
   when both ends share it), "noon–midnight". Thai keeps the 24-hour clock:
   "17:00–02:00 น." Text that is not a clock passes through unchanged. */
export function formatClock(text, { lang = 'en' } = {}) {
  return String(text ?? '').replace(/\b(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?\b/g, (match, h1, m1, h2, m2) => {
    if (Number(h1) > 24 || Number(m1) > 59 || (h2 && (Number(h2) > 24 || Number(m2) > 59))) return match;
    if (lang === 'th') return h2 ? `${h1}:${m1}–${h2}:${m2} น.` : `${h1}:${m1} น.`;
    const one = clock(h1, m1);
    if (!h2) return one.text;
    const two = clock(h2, m2);
    if (one.meridiem && one.meridiem === two.meridiem) return `${one.text.slice(0, -3)}–${two.text}`;
    return `${one.text}–${two.text}`;
  });
}
function clock(h, m) {
  const hour = Number(h) % 24, minute = Number(m);
  if (hour === 12 && minute === 0) return { text: 'noon', meridiem: '' };
  if (hour === 0 && minute === 0) return { text: 'midnight', meridiem: '' };
  const meridiem = hour < 12 ? 'am' : 'pm', twelve = hour % 12 || 12;
  return { text: minute === 0 ? `${twelve} ${meridiem}` : `${twelve}:${m} ${meridiem}`, meridiem };
}

const num = value => Number.isFinite(Number(value)) ? Number(value) : null;

/* Money is baht. Inside the hotel "฿1,300"; on a guest page "THB 1,300"
   (code: true), with "++" or "net" left to the copy. Compact for a tile:
   "฿1.2M", "฿480K". A real minus sign, and "+" only when asked. */
export function formatMoney(value, { compact = false, signed = false, code = false } = {}) {
  const n = num(value); if (n === null) return '—';
  const abs = Math.abs(n), sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  let body;
  if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  else if (compact && abs >= 100_000) body = `${Math.round(abs / 1000)}K`;
  else body = Math.round(abs).toLocaleString('en-US');
  return code ? `${sign}THB ${body}` : `${sign}฿${body}`;
}

/* "1,240", "+38", "−12". */
export function formatInteger(value, { signed = false } = {}) {
  const n = num(value); if (n === null) return '—';
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

/* A ratio as "72.4%", "+4.2%", "−1.8%". No space before the sign. */
export function formatPercent(value, { signed = false, digits = 1 } = {}) {
  const n = num(value); if (n === null) return '—';
  const p = n * 100, sign = p < 0 ? '−' : signed && p > 0 ? '+' : '';
  return `${sign}${Math.abs(p).toFixed(digits)}%`;
}

/* "1 job", "3 jobs", "0 sessions" - the number always shows. */
export function formatCount(value, singular, plural = `${singular}s`) {
  const n = Math.max(0, Math.round(num(value) ?? 0));
  return `${n.toLocaleString('en-US')} ${n === 1 ? singular : plural}`;
}

/* Whole days from hotel-today to a day, negative when it has passed. */
export function daysUntil(value) {
  const day = toDate(String(value ?? '').slice(0, 10)); if (!day) return null;
  const now = parts(new Date(), 'en', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = new Date(`${now.year}-${now.month}-${now.day}T00:00:00+07:00`);
  return Math.round((day - today) / 86400000);
}
