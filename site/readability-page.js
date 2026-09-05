/* Readability Test, under Settings › System, for the developer account only.
   The Betta changes eight times a day (betta-day-periods.js) and every card
   in the app is glass over it, so each period is a readability question:
   does the app's ink still clear 4.5:1 on what the glass shows? This page
   answers it live - the atmosphere is sampled as it is drawn and measured
   the way app-glass.css composites a card (betta-readability.js) - and lets
   the developer draw a new fish for a period the way the macOS Betta Metal
   Lab does (betta-random.js): a seed, never a hand-picked hex. Camera and
   composition are never touched.

   The page is a rail of transport chips (Previous, Play day, Next, Live, Sky)
   that stays put while the eight period cards scroll, a sample shaped like
   Today's hero and first card so the eye judges what the numbers judge, and
   one card per period: its hours, seven swatches, three readings, the seed,
   and Show · Random · Save · Original. Showing a period pins it on the
   atmosphere with the runtime's own 900ms fade; Play day runs the whole day
   in half a minute so the transitions are seen as they happen; Live hands
   the clock back; Sky shows the period's sky mode (r30), the fish's colors
   as plumes with no fish, so it can be read the same way, and while it is
   shown nothing saves. Save writes the style to the server (sindhorn_betta_periods,
   r29b) for every phone's next launch, and the server refuses a reading
   under 4.5:1 on its own; Original returns the period to the bundled fish.
   Both need system.manage. Nothing here is a live input to the atmosphere:
   a style is configuration, like a preset.

   Everything is library: the rail, the hero shape, .app-card sections with
   surface text roles, .app-swatches, .app-metric-grid readings with the
   danger tone, .app-field, utility actions in a row, the toast. */
import { supabaseRpc } from './auth-client.js';
import { showToast } from './app-toast.js';
import { formatClock, formatDate } from './app-format.js';
import { BETTA_DAY_PERIODS, periodByKey, nextPeriod } from './betta-day-periods.js';
import { generateBettaStyle, originalBettaStyle, randomSeed, parseSeed, seedLabel } from './betta-random.js';
import { measureFrame, lowerReading, periodColors, ratioLabel, READABILITY_ROLES, READABILITY_MINIMUM } from './betta-readability.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* The fade the runtime runs between periods; a reading starts after it. */
const SETTLE_MS = 1100;
const SAMPLE_MS = 500;
const PLAY_SECONDS = 30;

const env = () => window.SindhornEnvironment || null;
const hoursLabel = period => formatClock(`${period.startHour}:00–${period.endHour}:00`);

const hero = () => `<header class="app-hero"><p class="app-hero-eyebrow">Settings · System</p><h1 class="app-hero-title">Readability Test</h1><p class="app-hero-copy">The Betta for each period of the day, and whether the app's ink stays readable on it.</p></header>`;

const rail = () => `<div class="app-rail" role="toolbar" aria-label="Atmosphere">
  <button class="app-chip app-control" type="button" data-transport="previous">Previous</button>
  <button class="app-chip app-control" type="button" data-transport="play" aria-pressed="false">Play day</button>
  <button class="app-chip app-control" type="button" data-transport="next">Next</button>
  <button class="app-chip app-control" type="button" data-transport="live" aria-pressed="false">Live</button>
  <button class="app-chip app-control" type="button" data-transport="sky" aria-pressed="false">Sky</button>
</div>`;

/* Today's hero and first card, as a sample: the shapes the ink takes. */
const sample = () => `<section class="app-section" id="readability-sample">
  <h2 class="app-section-title">Today, as a Sample</h2>
  <p class="app-section-lede">The hero sits on the open sky; the card is glass. The readings below measure the glass.</p>
  <div class="app-hero" role="presentation"><p class="app-hero-eyebrow">Today</p><p class="app-hero-title">Hotel Business</p><p class="app-hero-copy">${esc(formatDate(new Date(), { style: 'weekday' }))} · Daily operating pulse from approved F&amp;B and Rooms reports.</p></div>
  <div class="app-stack">
    <div class="app-card app-surface">
      <div class="app-card-section"><p class="app-surface-label">Rooms · ${esc(formatDate(new Date(), { style: 'short' }))}</p></div>
      <div class="app-card-section"><div class="app-metric-grid">
        <div class="app-metric"><p class="app-metric-label">Occupancy OTB</p><p class="app-metric-value">86.4%</p><p class="app-metric-delta" data-direction="up">+2.1 pp vs forecast</p></div>
        <div class="app-metric"><p class="app-metric-label">ADR</p><p class="app-metric-value">฿4,820</p><p class="app-metric-delta" data-direction="down">−฿120 vs forecast</p></div>
      </div></div>
      <div class="app-card-section"><p class="app-surface-label">Note</p><p class="app-surface-copy">Muted copy at this size is the hardest ink to keep readable, so it is the reading that usually decides a period.</p></div>
    </div>
  </div>
</section>`;

const swatch = color => `<svg class="app-swatch" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><rect width="1" height="1" fill="${esc(color.hex)}"/></svg>`;
const swatches = style => { const colors = periodColors(style); return `<div class="app-swatches" role="img" aria-label="${esc(colors.map(color => `${color.label} ${color.hex}`).join(', '))}">${colors.map(swatch).join('')}</div>`; };

/* What the server said, in the app's words. 42501 is the capability gate,
   23514 the contract re-checked server-side; anything else is the network. */
function saveFailure(error) {
  const code = error?.payload?.code;
  if (code === '42501' || error?.status === 401 || error?.status === 403) return 'Saving a fish needs the system capability.';
  if (code === '23514') return 'This reading doesn\'t clear 4.5:1. Random again.';
  return 'The style didn\'t save. Check the connection and try again.';
}

/* A reading is three metrics; before a period has been shown they read "—". */
function readingMarkup(reading) {
  return READABILITY_ROLES.map(role => {
    const value = reading?.roles.find(item => item.key === role.key);
    return `<div class="app-metric"${value && !value.pass ? ' data-tone="danger"' : ''}><span class="app-metric-label">${esc(role.label)}</span><span class="app-metric-value" data-reading="${esc(role.key)}">${value ? esc(ratioLabel(value.ratio)) : '—'}</span></div>`;
  }).join('');
}

function cardMarkup(period, entry) {
  const style = entry.style || originalBettaStyle(period.baseline);
  const original = !entry.style;
  return `<article class="app-card app-surface" data-period="${esc(period.key)}">
    <div class="app-card-section">
      <div class="app-row" data-split="true"><p class="app-surface-label">${esc(hoursLabel(period))}</p><span class="app-badge" data-on-screen hidden>On screen</span></div>
      <h3 class="app-surface-title">${esc(period.name)}</h3>
      <div data-swatches>${swatches(style)}</div>
    </div>
    <div class="app-metric-grid app-card-section" data-columns="3" data-mode="text" data-reading-grid>${readingMarkup(entry.reading)}</div>
    <div class="app-stack app-card-section">
      <div class="app-field"><label for="readability-seed-${esc(period.key)}">Seed <span>${original ? 'original fish' : 'six hex digits draw the same fish'}</span></label><input id="readability-seed-${esc(period.key)}" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="16" placeholder="Original" value="${original ? '' : esc(seedLabel(entry.style.seed))}" data-seed="${esc(period.key)}"></div>
      <div class="app-row">
        <button class="app-utility-action" type="button" data-show="${esc(period.key)}">Show</button>
        <button class="app-utility-action" type="button" data-random="${esc(period.key)}">Random</button>
        <button class="app-utility-action" type="button" data-save="${esc(period.key)}" disabled>Save</button>
        <button class="app-utility-action" type="button" data-original="${esc(period.key)}"${original ? ' disabled' : ''}>Original</button>
      </div>
    </div>
  </article>`;
}

const gate = () => `<div class="app-state app-card" data-tone="empty"><p class="app-state-label">Not running</p><p class="app-state-title">The atmosphere isn't running</p><p class="app-state-copy">Readings need the Betta on screen. Open the app in a browser with WebGL and try again.</p></div>`;

export async function mountReadability(host) {
  let alive = true, timer = 0, settleAt = 0, playing = false;
  /* Per period: the working style (null = original), whether it differs
     from what is saved, and the lowest reading seen since it was shown. */
  const entries = new Map(BETTA_DAY_PERIODS.map(period => [period.key, { style: null, saved: null, reading: null, dirty: false }]));
  const api = env();
  const savedStyles = api?.getState?.().betta?.styles || {};
  for (const [key, style] of Object.entries(savedStyles)) { const entry = entries.get(key); if (entry && style) { entry.style = style; entry.saved = style; } }
  const ready = typeof api?.sampleBettaFrame === 'function' && typeof api?.setBettaPeriod === 'function';

  host.innerHTML = `${hero()}${rail()}${sample()}<section class="app-section" id="readability-periods"><h2 class="app-section-title">Eight Periods</h2><p class="app-section-lede">Each reading is the lowest contrast the glass has shown since the period came on screen. Save opens when all three clear ${esc(ratioLabel(READABILITY_MINIMUM))}.</p>${ready ? `<div class="app-stack">${BETTA_DAY_PERIODS.map(period => cardMarkup(period, entries.get(period.key))).join('')}</div>` : gate()}</section>`;

  const card = key => host.querySelector(`[data-period="${key}"]`);
  const cycle = () => api?.getState?.().betta?.dayCycle || {};
  const shownKey = () => cycle().targetPeriodKey || cycle().periodKey || null;

  function paintShown() {
    const key = shownKey();
    for (const period of BETTA_DAY_PERIODS) {
      const node = card(period.key); if (!node) continue;
      const on = period.key === key;
      node.querySelector('[data-on-screen]').hidden = !on;
      node.querySelector('[data-show]').disabled = on;
    }
    const live = cycle().mode === 'live';
    host.querySelector('[data-transport="live"]')?.setAttribute('aria-pressed', String(Boolean(live)));
    host.querySelector('[data-transport="play"]')?.setAttribute('aria-pressed', String(playing));
    host.querySelector('[data-transport="sky"]')?.setAttribute('aria-pressed', String(skyShown()));
  }
  /* Sky shows the period's sky mode (r30) in place of its fish, so the same
     readings can be taken of it; a reading of the sky is never saved. */
  const skyShown = () => api?.getState?.().betta?.mode === 'sky';

  function paintReading(key) {
    const entry = entries.get(key), node = card(key); if (!node) return;
    node.querySelector('[data-reading-grid]').innerHTML = readingMarkup(entry.reading);
    node.querySelector('[data-save]').disabled = !(entry.reading?.pass && entry.dirty) || skyShown();
  }

  function paintStyle(key) {
    const entry = entries.get(key), node = card(key), period = periodByKey(key); if (!node) return;
    const style = entry.style || originalBettaStyle(period.baseline);
    node.querySelector('[data-swatches]').innerHTML = swatches(style);
    const input = node.querySelector('[data-seed]');
    input.value = entry.style ? seedLabel(entry.style.seed) : '';
    node.querySelector('label span').textContent = entry.style ? 'six hex digits draw the same fish' : 'original fish';
    node.querySelector('[data-original]').disabled = !entry.style && !entry.saved;
    paintReading(key);
  }

  /* A style change resets the reading and, if the period is on screen,
     restarts the watermark after the fade. */
  function setStyle(key, style) {
    const entry = entries.get(key);
    entry.style = style; entry.reading = null;
    entry.dirty = JSON.stringify(style || null) !== JSON.stringify(entry.saved || null);
    api.setBettaStyle(key, style);
    settleAt = performance.now() + SETTLE_MS;
    paintStyle(key);
  }

  function show(key) {
    playing = false;
    api.setBettaPeriod(key);
    entries.get(key).reading = null;
    settleAt = performance.now() + SETTLE_MS;
    paintShown(); paintReading(key);
    card(key)?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function measure() {
    if (!alive || document.hidden) return;
    const key = shownKey(); if (!key) return;
    /* While the day plays or a fade runs, the frame is between periods. */
    if (playing || performance.now() < settleAt) return;
    const frame = api.sampleBettaFrame(64); if (!frame) return;
    const reading = measureFrame(frame); if (!reading) return;
    const entry = entries.get(key);
    entry.reading = lowerReading(entry.reading, reading);
    paintReading(key);
  }

  host.addEventListener('click', event => {
    const transport = event.target.closest('[data-transport]');
    if (transport) {
      const key = shownKey();
      if (transport.dataset.transport === 'previous') { const index = BETTA_DAY_PERIODS.findIndex(period => period.key === key); show(BETTA_DAY_PERIODS[(index - 1 + BETTA_DAY_PERIODS.length) % BETTA_DAY_PERIODS.length].key); }
      else if (transport.dataset.transport === 'next') show(nextPeriod(periodByKey(key) || BETTA_DAY_PERIODS[0]).key);
      else if (transport.dataset.transport === 'play') { playing = !playing; if (playing) api.previewBettaDayCycle(PLAY_SECONDS); else api.setBettaPeriod(shownKey()); settleAt = performance.now() + SETTLE_MS; paintShown(); }
      else if (transport.dataset.transport === 'live') { playing = false; api.useLiveBettaDayCycle(); settleAt = performance.now() + SETTLE_MS; paintShown(); }
      else if (transport.dataset.transport === 'sky') { api.setBettaMode(skyShown() ? 'betta' : 'sky'); for (const entry of entries.values()) entry.reading = null; settleAt = performance.now() + SETTLE_MS; paintShown(); for (const period of BETTA_DAY_PERIODS) paintReading(period.key); }
      return;
    }
    const showButton = event.target.closest('[data-show]');
    if (showButton) { show(showButton.dataset.show); return; }
    const random = event.target.closest('[data-random]');
    if (random) { const key = random.dataset.random; setStyle(key, generateBettaStyle(periodByKey(key).baseline, randomSeed())); if (shownKey() !== key) show(key); return; }
    const original = event.target.closest('[data-original]');
    if (original) { restore(original.dataset.original, original); return; }
    const save = event.target.closest('[data-save]');
    if (save) persist(save.dataset.save, save);
  });

  /* Save and Original are one request each; the button waits while it runs.
     The server answers with the whole saved map, which becomes this
     device's copy, so the copy never holds a fish that was only tried. */
  async function persist(key, button) {
    const entry = entries.get(key);
    if (!entry.reading?.pass || !entry.style) return;
    button.disabled = true;
    try {
      const result = await supabaseRpc('sindhorn_betta_period_save_v1', { p_key: key, p_seed: String(entry.style.seed), p_style: entry.style, p_reading: entry.reading });
      if (!alive) return;
      entry.saved = entry.style; entry.dirty = false;
      api.saveBettaStyles(result?.styles);
      showToast(`${periodByKey(key).name} saved.`);
    } catch (error) {
      if (!alive) return;
      showToast(saveFailure(error));
    }
    paintStyle(key);
  }

  async function restore(key, button) {
    const entry = entries.get(key);
    button.disabled = true;
    try {
      if (entry.saved) {
        const result = await supabaseRpc('sindhorn_betta_period_reset_v1', { p_key: key });
        if (!alive) return;
        api.saveBettaStyles(result?.styles);
      }
      entry.style = null; entry.saved = null; entry.reading = null; entry.dirty = false;
      api.setBettaStyle(key, null);
      settleAt = performance.now() + SETTLE_MS;
      if (shownKey() !== key) show(key);
      showToast(`${periodByKey(key).name} is back to the original fish.`);
    } catch (error) {
      if (!alive) return;
      showToast(saveFailure(error));
    }
    paintStyle(key);
  }

  /* A typed seed draws that fish; anything else leaves the card as it was. */
  host.addEventListener('change', event => {
    const input = event.target.closest('[data-seed]'); if (!input) return;
    const key = input.dataset.seed, seed = parseSeed(input.value);
    if (input.value.trim() === '') { setStyle(key, null); if (shownKey() !== key) show(key); return; }
    if (seed === null) { paintStyle(key); showToast('A seed is one to sixteen hex digits.'); return; }
    setStyle(key, generateBettaStyle(periodByKey(key).baseline, seed)); if (shownKey() !== key) show(key);
  });

  if (ready) {
    paintShown();
    settleAt = performance.now() + SETTLE_MS;
    timer = setInterval(() => { paintShown(); measure(); }, SAMPLE_MS);
  }

  return () => {
    alive = false; clearInterval(timer);
    /* Leaving hands the clock back, returns the atmosphere to what is saved
       - a fish tried and not saved goes - and drops the sampling context. */
    if (ready) api.setBettaStyles(Object.fromEntries([...entries].map(([key, entry]) => [key, entry.saved]).filter(([, style]) => style)));
    api?.useLiveBettaDayCycle?.(); api?.setBettaMode?.('auto'); api?.disposeBettaSampler?.();
  };
}
