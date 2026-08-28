# Sindhorn Midtown Internal PWA — Agent Handoff

This repository is the canonical executable shell for the Sindhorn Midtown internal environmental PWA. Treat GitHub, live Cloudflare Pages/Workers, and live Supabase as runtime truth; verify them before consequential changes.

## Canonical production endpoints

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages: `https://sindhorn-midtown-internal.pages.dev/`
- Supabase project: `sjpvhgxacsiorrtijqua`
- Environmental Alerts Worker: `https://sindhorn-midtown-alerts.decha-dae.workers.dev`
- Preserved sky research Worker: `https://sindhorn-midtown-sky.decha-dae.workers.dev`

Do not infer that a commit is live merely because it is on `main`. A production claim requires the relevant `main` workflow to pass and the production endpoint verification to succeed.

## Read authority in this order

1. `AGENTS.md`
2. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`
3. `docs/SINGLE-SHELL-ROUTER-INVARIANT-20260828.md`
4. `docs/BANGKOK-SEASONAL-SKY-AND-CLOUD-ARCHITECTURE-OVERRIDE-20260827.md`
5. `docs/PHASE8.2-BANGKOK-SEASONAL-CLOUD-MORPHOLOGY-PLAN-20260827.md`
6. `docs/PHASE8.2-IMPLEMENTATION-20260827.md`
7. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
8. `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md` only as historical/future-camera research
9. earlier phase implementation notes as needed

The single-shell router invariant is mandatory for all authenticated app features. The two Phase 8.2 atmosphere documents supersede older live-camera production architecture wherever they conflict.

## Product state that must be preserved

- **The interface is English-only (decided 2026-08-28).** Every label, heading, button, status line, alert and push notification is English. Do not reintroduce inline Thai in interface chrome, and do not rebuild the old English/Thai pairing markup — a proper language-switch feature is planned instead, and it will select a language rather than render both at once. This supersedes the earlier "English first, Thai immediately supports it" rule in `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`.
- **Thai content is not the same as Thai interface.** F&B promotion copy stays bilingual in `site/fnb-data.js`: the Copy section exists to hand the designer both the English and Thai marketing text for artwork, so `copyTh` is work product, not chrome. Noto Sans Thai and the `:lang(th)` font rule must therefore stay shipped.
- **Typography invariant: every font and text treatment in Sindhorn Midtown Internal uses zero character tracking (`letter-spacing: 0`). Do not introduce positive or negative tracking anywhere in the PWA, auth, admin, messages, or future modules.**
- **Single-shell navigation invariant: every authenticated current or future screen is an SPA route mounted inside the persistent `#route-view`. Header, footer, atmosphere, auth session and app document must never unload between authenticated screens. `/login.html` is the only intentional standalone document boundary. Never add another standalone authenticated HTML page or a full-document navigation to one.**
- **Transition invariant: authenticated navigation animates only `#route-view` with the shared opacity crossfade. Never animate the document root, header, footer or atmosphere, and never use browser-dependent cross-document View Transitions as the primary app navigation mechanism.**
- **Footer navigation invariant: the authenticated footer is `Today / F&B / Messages`. Guidance and Details are not standalone footer routes; their existing presentation fragments are composed below Today in the same continuous page. F&B is currently an intentionally empty in-shell route reserved for the F&B module.**
- Messages remains a footer destination and its device-local inbox works offline.
- Environmental Alerts / Web Push is user-gesture initiated only; never auto-prompt notification permission.
- Current device location drives Open-Meteo weather and sun/moon astronomy after permission; fallback is Sindhorn Midtown Bangkok.
- AirBKK is authoritative for PM2.5 and Thai AQI.
- Open-Meteo is authoritative for current local weather.
- PWA identity stays `id=/`, `start_url=/`, `scope=/`, `display=standalone`.
- Normal releases require no reinstall and must preserve existing push subscriptions.
- The visible **Save full page** action was explicitly removed on 2026-08-27 from live Pack 38 and the offline fallback. Do not restore that button/action bar without a new explicit product decision. Internal capture/export code may remain as non-visible infrastructure unless separately removed.
- Tilt, rain/window pane, storm effects, offline shell, navigation and current-location behavior are release invariants.
- Mobile atmosphere quality must remain desktop-equivalent. Do not lower DPR, cloud depth, or celestial quality as a performance shortcut.
- No static atmosphere background images.

## Presentation / Supabase split

Supabase owns versioned presentation resources. GitHub/Cloudflare owns the stable executable renderer and shell.

At the Phase 8.2 implementation start on 2026-08-27, live verification showed:

- Pack 38 is the only enabled pack.
- Pack 38 has nine enabled rows: `manifest.json`, `header.html`, `today.html`, `guidance.html`, `details.html`, `messages.html`, `footer.html`, `ui.css`, `environment-config.json`.
- Manifest: `appPack=38`, `minimumShell=17`, `environmentConfig=3`.

**Current live pack — 28 August 2026: Pack 44** (`appPack=44`, `minimumShell=17`, `environmentConfig=3`, same nine rows). Lineage, newest first:

- **44** — Pack 41 minus the Google Fonts `@import`. Every face it pulled is self-hosted by `shell.css`, so this removed 7 cross-origin requests and an offline-breaking dependency.
- **41** — English-only interface markup. Kept as the rollback target.
- **38** — the last bilingual pack. Retained as history.

Packs 42 and 43 were created and discarded during that work; the numbers are burnt and must not be reused.

**Trap, learned the hard way.** Do not strip that `@import` with `@import[^;]+;`. The Google Fonts URL contains semicolons (`wght@300;400`), so the match ends *inside* the URL and leaves `400&family=…swap");` at the top of the stylesheet. That is a parse error, the browser discards the rules after it, and the whole app renders unstyled while still reporting a valid pack and passing every hash check. Match the full statement instead: `@import[[:space:]]*url\([^)]*\)[^;]*;`.

More generally: a pack can pass manifest validation, SHA-256 integrity and brace-balance checks and still be broken CSS. Verify a pack change by loading the app and reading a computed style that only `ui.css` provides — `.masthead` background is a good probe — not by structural checks alone.

The current shell may compose multiple validated presentation fragments into one SPA route. Today composes `today.html`, `guidance.html` and `details.html`; this does not require mutating Pack 38 or its manifest.

Always re-query live Supabase before relying on those values in a later session.

## Phase 8.2 production atmosphere

Approved production model:

`Bangkok Seasonal Sky Profile`
`+ current Open-Meteo weather`
`+ actual local sun/moon astronomy`
`+ AirBKK PM2.5 optics`
`→ rendered atmosphere`

Weather always wins. The seasonal profile is a continuous annual prior, not a weather generator.

Implementation components:

- `site/seasonal-sky.js` — continuous 12-month Bangkok profile, weather family classification, cloud morphology controls, seasonal sky state.
- `site/atmosphere-shader.js` — shared GLSL for seasonal sky plus three cloud depth families.
- `site/environment.js` — production environment state, Open-Meteo integration, current-location astronomy, AirBKK optics, renderer, precipitation overlays, export parity.
- `site/phase8-2-fixtures.js` — deterministic seasonal/date/weather acceptance fixtures.
- `site/phase8-2-seasonal-clouds.test.mjs` — deterministic architecture/fixture assertions.
- `site/phase8-2-browser-smoke.mjs` — Chromium render/DPR/context/frame-pacing regression smoke with desktop/mobile evidence, run against the live `/` route only.

**2026-08-28 — tester/example pages removed.** `site/cloud-tester.html`, `site/cloud-tester-shared.js`, `site/atmosphere-tester.html`, `site/atmosphere-tester.js`, `site/tester-celestials.js` and `site/january-sunset-example.html` were deleted at the product owner's explicit request: the app is pre-launch (no employees onboarded yet, single-person testing), and standalone tester/demo pages are no longer wanted — all verification now happens against the live route. `phase8-2-browser-smoke.mjs` was rewritten accordingly to verify `/` directly (renderer identity, DPR, live AirBKK delivery, frame pacing) instead of forcing a sun angle on the retired cloud tester. The dedicated `Phase 8.2 Atmosphere Lab` workflow (`.github/workflows/phase8-2-january-example.yml`) was deleted along with it. Do not recreate a standalone tester page without a new explicit product decision; if a manual cloud/sky tuning tool is needed again, it should be discussed with the product owner first.

Cloud families are conceptual layers in one GPU pass:

1. High veil / cirrus — thin and soft; catches low-sun colour first.
2. Mid broken cloud — principal partly-cloudy geometry with genuine gaps.
3. Low convective / monsoon — broad connected mass, dark bases, stronger depth and selective low-sun light leaks.

Cloud illumination uses actual solar altitude and projected actual solar azimuth. The sun is a real rendered disc above the horizon, attenuated by cloud optical depth; after it drops below the horizon the disc disappears while twilight colour continues. PM2.5 remains downstream optical extinction/desaturation; it never changes weather geometry.

Performance work must preserve fixed DPR 2 and the three cloud families. The Phase 8.2 renderer uses one shared full-screen shader with texture-backed deterministic noise, live MSAA disabled, live `preserveDrawingBuffer` disabled, lazy snow/hail overlay allocation, and no duplicate production `storm-effects.js` compositor.

## Camera / Workers AI status

The former live-camera calibration system is preserved for future rooftop/360-camera adaptation, not production atmosphere.

- `site/sky-calibration.js` and `site/sky-color-renderer.js` remain in repository history/source for research but are not loaded by `site/index.html` and are not cached by `site/sw.js`.
- `sky-worker/src/**` remains research code.
- Production `sky-worker/wrangler.jsonc` explicitly has an empty cron list. Therefore normal operation consumes no scheduled Workers AI allocation after that configuration is deployed to main.
- Historical Phase 8 camera workflows are manual-only research archives.
- Do not restore public bridge/river cameras as a production dependency without a new approved architecture override.

## Deterministic Phase 8.2 fixtures

The acceptance set includes:

- Jan 15 clear sunrise
- Jan 15 partly-cloudy sunset
- Jan 15 partly-cloudy civil twilight
- Jan 15 overcast sunset
- Apr 15 clear/hazy sunset
- Apr 15 partly-cloudy sunset
- Aug 27 overcast daytime
- Aug 27 partly-cloudy sunset
- Aug 27 sunset thunderstorm
- Sep 15 heavy cloud with localized warm horizon
- Oct 15 post-shower clearing sunset

The exact local timestamps and state values live in `site/phase8-2-fixtures.js` and should not be silently weakened when a rendering change fails one.

## Release discipline

Executable renderer/shell work uses:

`dedicated branch → deterministic/syntax validation → Cloudflare Pages branch preview → smoke/visual testing → PR → merge → main production verification`

For Phase 8.2 use the dedicated workflow `Phase 8.2 Bangkok Seasonal Clouds`. The general deploy and launch-hardening workflows remain regression gates.

Do not merge a visual atmosphere change that has unresolved genuine human visual judgment. When automated validation is green but realism/art direction needs native review, stop at the branch preview and provide exact fixture URLs.

## Security

- Never print, commit, or expose Cloudflare tokens, Supabase secrets, VAPID private keys, or other credentials.
- The publishable Supabase key present in the client is intentional and must remain constrained by database policy; do not replace it with privileged credentials.
- Do not weaken RLS or push-worker authorization to simplify testing.