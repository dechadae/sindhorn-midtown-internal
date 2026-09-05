# Sindhorn Midtown Internal PWA — Agent Handoff

This repository is the canonical executable shell for the Sindhorn Midtown internal environmental PWA. Treat GitHub, live Cloudflare Pages/Workers, and live Supabase as runtime truth; verify them before consequential changes.

## THE REBUILD — read this before touching any UI code

A from-scratch UI rebuild started 2 September 2026 on `land-baseline` →
`main`. `site/ci.html` at `/ci` is the finished, locked master UI library —
the only place a component is designed. `site/index.html` at `/` is the
new app shell (r17, 5 September 2026): `shell.js` routes by hash, every
legacy path redirects to its hash route (`site/_redirects`), and the installed
PWA took it in place without a reinstall. r18 (5 September 2026) deleted the
legacy sources (`login.html`, `bootstrap.js`, `route-registry.js`,
`fallback/*`, the route modules, weather/location clients, capture library,
their smoke scripts and preview workflows) and retuned every file-based gate.
What remains of the old app is only what the public `/share/*` generator
still needs (`fnb.js`, `fnb-data.js`, `fnb-share-ui.js`, `fnb-artwork-sync.js`,
`fnb*.css`, `shell.css`, `environment.css`, `betta-runtime.js`,
`app-select.js`) until Phase 7 rebuilds `/share` on the new shell. The shell
imports `betta-runtime-full.js`, which `scripts/build-betta-runtime.mjs`
rebuilds byte-for-byte from the Betta sources (`--check` runs in Deploy).

Full rules: **`docs/UI-CENTRALIZATION-RULES-20260903.md`** (library workflow,
the ratchet, the glass membership rule, motion tokens) and
**`docs/RELEASE-RULES-NO-REINSTALL-20260903.md`** (PWA identity, the
shell-vs-Supabase-data split). Read both before writing a line of CSS or
markup. The short version:

1. No reinstall after release — PWA identity never changes.
2. Centralized code and modules — one shared library, not per-route CSS.
3. No inline CSS patches.
4. No inline or per-page CSS at all.
5. Consistent, real frosted-glass blur everywhere.
6. The Betta WebGL engine stays intact.
7. Fast launch.
8. Skeleton loading on Today.

Run `node scripts/ui-centralization-budget.mjs` and
`node scripts/ci-page-render-smoke.mjs` before every push that touches
shared UI, and parse every edited module as a module (`node
--input-type=module --check < file`) - a bare `node --check` reads the file
as a script and has let an unescaped apostrophe in a string through. Where this section or the two docs above conflict with "Product
state that must be preserved" below, that section wins; the footer it
describes is the r20 one (Today / F&B / Jobs / Brand, Messages in the masthead).

## Canonical production endpoints

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages: `https://sindhorn-midtown-internal.pages.dev/`
- Supabase project: `sjpvhgxacsiorrtijqua`
- Environmental Alerts Worker: `https://sindhorn-midtown-alerts.decha-dae.workers.dev`
- Preserved sky research Worker: `https://sindhorn-midtown-sky.decha-dae.workers.dev`

Do not infer that a commit is live merely because it is on `main`. A production claim requires the relevant `main` workflow to pass and the production endpoint verification to succeed.

## Read authority in this order

1. `AGENTS.md`
2. `docs/UI-CENTRALIZATION-RULES-20260903.md` for any UI/component/CSS work — the rebuild's library, ratchet and glass/motion rules
3. `docs/RELEASE-RULES-NO-REINSTALL-20260903.md` for PWA identity and the shell-vs-Supabase-data split
4. `docs/BETTA-PRODUCTION-ATMOSPHERE-20260831.md` for the active persistent visual/background architecture
5. `docs/WEATHER-AUTHORITY-OVERRIDE-20260829.md` for weather-source/current-rain data decisions
6. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`
7. `docs/SINGLE-SHELL-ROUTER-INVARIANT-20260828.md`
8. `docs/FNB-SUPABASE-DATA-AUTHORITY-20260829.md` when working on F&B
9. `docs/FNB-EXCEL-TO-SUPABASE-UPDATE-RUNBOOK.md` when the product owner supplies updated F&B Excel files
10. `docs/BANGKOK-SEASONAL-SKY-AND-CLOUD-ARCHITECTURE-OVERRIDE-20260827.md` as legacy weather-background architecture
11. `docs/PHASE8.2-BANGKOK-SEASONAL-CLOUD-MORPHOLOGY-PLAN-20260827.md` as legacy weather-background detail
12. `docs/PHASE8.2-IMPLEMENTATION-20260827.md` as legacy weather-background implementation history
13. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
14. `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md` only as historical/future-camera research
15. earlier phase implementation notes as needed

The single-shell router invariant is mandatory for all authenticated app features. `docs/BETTA-PRODUCTION-ATMOSPHERE-20260831.md` supersedes the Phase 8.2 documents for the active visual background. `docs/WEATHER-AUTHORITY-OVERRIDE-20260829.md` remains authoritative for weather data/current-rain decisions and supersedes all earlier Open-Meteo/current-weather authority statements wherever they conflict.

## Product state that must be preserved

- **The interface is English-only (decided 2026-08-28).** Every label, heading, button, status line, alert and push notification is English. Do not reintroduce inline Thai in interface chrome, and do not rebuild the old English/Thai pairing markup — a proper language-switch feature is planned instead, and it will select a language rather than render both at once. This supersedes the earlier "English first, Thai immediately supports it" rule in `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`.
- **Thai content is not the same as Thai interface.** F&B promotion copy stays bilingual in the canonical Supabase F&B operational rows: the Copy section exists to hand the designer both the English and Thai marketing text for artwork, so Thai copy is work product, not chrome. `site/fnb-data.js` is only the runtime data adapter/emergency fallback structure and must not become the business-content authority again.
- **Typography invariant: `LINE Seed Sans TH` is the sole production font family for both English and Thai. Production ships only real weights 100 / 400 / 700. Every text treatment uses zero character tracking (`letter-spacing: 0`), with no exceptions. Do not reintroduce Poppins, Noto Sans, Noto Sans Thai, Vignette Sans, IBM Plex, split-language font logic, synthetic weights, or external runtime font hosting.**
- **Single-shell navigation invariant: every authenticated current or future screen is an SPA route mounted inside the persistent `#route-view`. Header, footer, atmosphere, auth session and app document must never unload between authenticated screens. Sign-in is the `#signin` route of the same document; there is no standalone authenticated or sign-in HTML page. Never add one, or a full-document navigation to one.**
- **Transition invariant: authenticated navigation animates only `#route-view` with the shared opacity crossfade. Never animate the document root, header, footer or atmosphere, and never use browser-dependent cross-document View Transitions as the primary app navigation mechanism.**
- **Footer navigation invariant (r20, 5 Sep 2026): the authenticated footer is `Today / F&B / Jobs / Brand`; the masthead carries the Messages icon control (with the unread count) beside the account chip, and that icon is the only way into `#messages`, which keeps the app footer beneath it with no tab current. Guidance and Details are not standalone footer routes; their existing presentation fragments are composed below Today in the same continuous page. F&B is a live in-shell route whose operational promotion content is read from Supabase at runtime.**
- **Hero title invariant (r23, 5 Sep 2026): every `.app-hero-title` is Title Case ("Job Tracker", "Know Our Hotel", "UI Library"), never sentence case. Eyebrows and copy keep sentence case.**
- **Voice invariant (r24, 5 Sep 2026): `site/voice.html` at `/voice` (in-shell `#voice` via `voice-page.js`, listed under Settings › System beside the UI Library) is the master copy library - the way `/ci` is the master for components. Every string the app owns follows it: American English; one word per thing (employee, sign in, permanent code / one-time code, People & Culture, guest, promotion, broadcast, job, archive, revoke, turn on/off, phone, tap); Title Case only on hero and section titles; no period on titles, labels, buttons, badges, toasts or state titles; no exclamation marks, no "please", no apologies; errors are "Couldn't <thing>" + what to do; gates are "This tab is for …" + "Ask People & Culture …". Dates, times, money and counts are written only by `site/app-format.js` (hotel time, never a zone suffix; English `5 Sep 2026 · 6 pm`, `11:30 am`, `6:30–11 am`, weekday without a comma; Thai `5 ก.ย. 2569 · 18:00 น.`, Buddhist year) - no route formats its own. F&B promotion copy (`data-verbatim`) is rendered as provided; only a typo or grammatical slip may be corrected, in the data, with approval. The Voice page's specimens are filled by `app-format.js` at mount (`[data-format]`), so the document cannot drift from the code; `ci-page-render-smoke.mjs` renders `/voice` too.**
- **Artwork copy invariant (r25, 5 Sep 2026): section 03 of an F&B promotion (`#fnb/<id>` → `#artwork-copy`) is derived at render time by `site/fnb-artwork-copy.js` (`artworkCopy(campaign)`), never stored: the title verbatim, the subtitle from the press headline with its venue clause removed and never the title said again (r25c: `titleShare` rejects it, the next non-fact line or sentence stands in), and the body as one paragraph, never a table or a fact list (r25b): `summary` plus the press release's own non-fact sentences until ≥200 characters (r25c), then "Available <formatDateRange> at <outlets in OUTLET_ORDER> (<formatClock hours>)", the prices, the terms, IHG One Rewards, "Reserve at +66 2 796 8888 or eat.sindhornmidtown@ihg.com" and the enrollment link, sentence after sentence through `app-format.js`; the `*` channel line is returned as `channel` and shown in the note under the card, not in the copy. The designer sets the body as running copy on the artwork, so do not split it back into rows. The press-release EN/TH copy in 02 stays the verbatim reference. The specimen in `/voice` §17 is bound from the same module against a fixed Fried Chicken & Waffles record and the render smoke asserts it. A hand-written override would be a data field, proposed and approved first, never a page patch. The rail's chips grow from their labels (`flex:1 1 auto`, v33) so five fit one phone row.**
- **Masthead two-state invariant (r23): the account chip and the Messages icon each have two states driven by `data-mode` - `initials`/`close` on the chip, `messages`/`close` on the icon. While its destination is open the control is the accent close mark and tapping it returns to the page the employee came from (Settings → `returnHash`, Messages → the last non-Messages layer-0 page; Today when none). Never add a third way out of either.**
- **Job card invariant (r23, r23c, r28): a job is not a component - it is an `.app-card.app-surface` whose groups (the ask, the facts, the actions) are `.app-card-section`s, with the surface text roles (`.app-surface-label` / `-title` / `-copy`), a split `.app-row` of actions at the foot (status selector at the start, Update at the end, both at the inline height), `data-tone="quiet"` on a done card and `data-tone="danger"` on a tight deadline metric; the status is the compact selector (`.app-select[data-compact="true"]` from `app-select.js`, the trigger an `.app-badge` in the status's tone) - a real dropdown, and a pick saves through `sindhorn_jobs_set_status_v1` at once. Glass never nests, so `bindAppSelects` lifts a card selector's open menu to `<body>` as `position:fixed` anchored by the three `--app-select-*` custom properties it sets and clears - the library's one runtime geometry, never a page's. A selector inside a `<dialog>` stays in place.**
- **Developer-only routes invariant (r29a, 5 Sep 2026): `/ci`, `/voice` and `#readability` exist to build the app, not to use it, so they open only for the developer account - `getState().profile.account_type === 'developer'`, the value the profile RPC already returns, never a capability or a role. `shell.js` keeps them in `DEVELOPER_ROUTES`: `resolve()` bounces anyone else to `#settings/system`, `layerOf` and `paintNavbar` treat them as settings; the standalone `/ci` and `/voice` boots run `initAuth()` first and show the "Developer only" gate state from `/voice` instead of binding the library; Settings › System lists the three cards only for the developer. A new developer tool joins the set, it does not grow its own check.**
- **Readability Test invariant (r29a, 5 Sep 2026): `#readability` (`site/readability-page.js`) is where the Betta of each period is chosen and judged; nothing else edits Betta styles. A style is configuration, not a live visual input: `betta-random.js` is the Mac Betta Metal Lab randomizer ported verbatim (SplitMix64, 24-bit web seeds, colors and fin form per period, camera and composition untouched), and a seed reproduces its fish. The reading is taken from the rendered frame, never from palette hexes: `sampleBettaFrame()` renders the live scene once through a 64px sampler renderer, `betta-readability.js` softens it as the glass would, composites `--app-glass-fill` and reports WCAG contrast for Ink, Muted (flattened) and Accent - the lowest sample per role, kept as a watermark while the period is on screen; every role must clear 4.5:1 before Save opens. Saved styles are the app's configuration (r29b, 5 Sep 2026): `public.sindhorn_betta_periods`, RLS with no policies, reached only through `sindhorn_betta_periods_v1()` (anon-readable, returns the style map and nothing else because the atmosphere renders before sign-in) and `sindhorn_betta_period_save_v1` / `sindhorn_betta_period_reset_v1` (`system.manage`; save re-checks the 4.5:1 contract server-side and refuses with `23514`, so the rule holds without the page). The runtime boots from this device's copy (`localStorage` `sindhorn-midtown:betta-styles:v1`) so the launch stays fast; `shell.js` `refreshBettaStyles()` fetches the server map after the first frame, applies it only when it differs and rewrites the copy; the page writes the copy from the server's returned map, never from the runtime, so a fish only tried is never kept. Original is the bundled preset (style `null`), never a copy of it. A swatch (`.app-swatch`) is a sample of a color, not a surface: no edge, no glass, its color an SVG `fill` attribute - data, never a style.**
- Messages is a masthead destination and its device-local inbox works offline. Jobs is each employee's own job tracker (`site/jobs-page.js`, r21): rows in `public.sindhorn_jobs`, reached only through the `sindhorn_jobs_*_v1` RPCs (capability `jobs.read` / `jobs.manage`, granted to everyone; every call is scoped to the caller's own employee row; archive, never delete).
- Environmental Alerts / Web Push is user-gesture initiated only; never auto-prompt notification permission.
- **The active persistent visual is the Sindhorn Betta WebGL organism. Its only real-time visual/environmental authority is current JMA Himawari-9 High-Resolution Asia 1 satellite imagery over Bangkok.** No TMD station data, MET model data, AirBKK, device geolocation/orientation, local clock, calculated astronomy, microphone/camera or other sensor may be introduced as a Betta form/colour driver without a new explicit product decision.
- The eight canonical Betta baselines are Royal Blue Halfmoon, Super Red Halfmoon, Mustard Gas, Black Orchid, Copper Metallic, Turquoise Metallic, Nemo Galaxy Koi and Red Snow Dragon. Royal Blue Halfmoon is the default baseline.
- The client-side weather/location modules (`location.js`, `live-data.js`, `rain-now.js`, `weather-authority.js`) were retired in r18; the new shell carries no weather panel and never asks for device location. Operational weather and air evaluation lives in the Environmental Alerts Worker (`worker/src/index.js`), whose data authorities are unchanged: TMD AWS for fresh observed current weather, AirBKK for PM2.5 and Thai AQI, MET Norway as model support only. None of it drives the Betta renderer. Open-Meteo is not a production dependency: the Betta runtime still carries the old app's Open-Meteo probe for a weather panel the shell does not render, and `shell.js` answers that request with a network error before it leaves the phone (Launch Hardening asserts the guard precedes the runtime import).
- Current precipitation is observation-only: fresh observed dry releases rain immediately; model/base wet signals must not activate rain. This is a data/current-rain invariant, not a visual-background driver.
- **2026-08-31 product decision: the former weather-driven WebGL background and its visual compatibility/rollback files were removed from the deployed app.** Exact source bytes are preserved privately in Supabase table `private.legacy_weather_webgl_archive` under archive key `legacy-weather-webgl-20260831`, sourced from immutable Git commit `29b0c99941163582b84d376982e459fdf6ead85b`. Do not restore those files to the app without a new explicit product decision.
- PWA identity stays `id=/`, `start_url=/`, `scope=/`, `display=standalone`.
- Normal releases require no reinstall and must preserve existing push subscriptions.
- The visible **Save full page** action was explicitly removed on 2026-08-27 from live Pack 38 and the offline fallback, and r18 removed the capture infrastructure (`screen-capture.js`, `vendor/html2canvas.min.js`). Do not restore either without a new explicit product decision.
- Offline shell and navigation are release invariants. Legacy tilt/rain/storm visual effects are not active Betta invariants.
- Mobile atmosphere quality must remain desktop-equivalent. Do not lower DPR or biological membrane quality as a performance shortcut. The active Betta renderer keeps fixed DPR 2.
- No static atmosphere background images.

## F&B operational-content invariant

Supabase is the canonical F&B business-content authority. GitHub/Cloudflare owns executable UI, routing, rendering, validation, sharing behavior and offline logic.

When the product owner uploads updated F&B Excel workbooks, follow `docs/FNB-EXCEL-TO-SUPABASE-UPDATE-RUNBOOK.md`. Do not ask the product owner to convert the workbook to CSV or manually identify changed rows. Inspect the workbook programmatically, compare it with live Supabase, preserve stable promotion/activation/artwork IDs, and update operational rows in Supabase.

Routine existing-promotion edits are:

`updated Excel → validated Supabase rows → deployed F&B runtime reflects change`

They do not require editing business content into JS or deploying Cloudflare. The current exception is a genuinely new promotion ID whose individual crawler-ready `/share/fnb/<id>` physical HTML page has not yet been generated; the runbook documents that share-route release step.

Artwork completion state is separate from workbook content and must not be reset by imports. Workbook SharePoint/OneDrive artwork-folder links are canonical activation metadata and are intentionally available in public read-only F&B shares; the destination still enforces IHG authentication.

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

## Production Betta atmosphere

Approved production visual model:

`JMA Himawari-9 High-Resolution Asia 1 satellite imagery over Bangkok`
`+ eight real-Betta-inspired biological baselines`
`+ continuous procedural radial-membrane GLSL motion`
`→ persistent Sindhorn Betta atmosphere`

The satellite does not render as an image background and is never uploaded as a WebGL texture. B13 infrared, B08 water-vapour and B03 visible images are temporary CPU analysis inputs. The analyzer derives bounded artistic controls such as cloud-field change/motion, structural texture, water-vapour response, visible spectral bias and an observation fingerprint. Procedural noise provides continuous organism motion between approximately ten-minute observations.

Active implementation components:

- `site/betta-environment.js` — production persistent renderer, existing `window.SindhornEnvironment` compatibility surface, Today weather-card compatibility, export parity and satellite target smoothing.
- `site/betta-fin-presets.js` — the eight canonical biological baselines.
- `site/betta-fin-shader.js` — custom indexed radial-membrane vertex deformation and thin biological membrane material.
- `site/betta-satellite.js` — Bangkok-centered JMA Himawari HA1 pixel analysis and polling.
- `site/_worker.js` + `site/_routes.json` — locked-down same-origin JMA satellite proxy scoped only to `/api/betta-satellite`.
- `site/phase8-2-browser-smoke.mjs` — retained filename, but now verifies the authenticated live route uses `sindhorn-betta-satellite-v1`, satellite-only input, eight baselines, DPR 2, live satellite state, visible motion and existing operational AirBKK delivery.

Performance contract: one persistent WebGL canvas, fixed DPR 2, `antialias:false`, live `preserveDrawingBuffer:false`, visibility pause/resume, 1–2 major membrane draws for current presets, no full-screen post-processing, and zero WebGL image textures for the Betta itself.

## Retired Phase 8.2 weather background

The previous Bangkok seasonal/weather WebGL renderer is no longer shipped in `site/`. On 2026-08-31 the product owner explicitly retired it from the app for performance and architecture simplification.

Recovery source is stored privately in Supabase:

- table: `private.legacy_weather_webgl_archive`
- archive key: `legacy-weather-webgl-20260831`
- source commit: `29b0c99941163582b84d376982e459fdf6ead85b`
- archived files: 13
- archived bytes: 1,169,050

This private archive includes the generated legacy bundle, renderer, seasonal profile, GLSL shader, legacy rain/storm/sun visual helpers, camera/sky visual research helpers, cloud tester source and deterministic legacy fixtures/tests. It is recovery/research material only and is not exposed to app clients.

The older Phase 8.2 architecture documents remain historical documentation; they no longer describe files that ship with the app.

## Camera / Workers AI status

The former live-camera calibration system is preserved for future rooftop/360-camera adaptation, not production atmosphere.

- `site/sky-calibration.js` and `site/sky-color-renderer.js` exist only in repository history (Launch Hardening asserts they are absent from `site/`).
- `sky-worker/src/**` remains research code.
- Production `sky-worker/wrangler.jsonc` explicitly has an empty cron list. Therefore normal operation consumes no scheduled Workers AI allocation after that configuration is deployed to main.
- Historical Phase 8 camera workflows are manual-only research archives.
- Public Bangkok camera-weather analysis remains support-only research unless a later explicit architecture decision promotes it; it must not override fresh exact-point radar/QPE or fresh observed dry evidence.

## Deterministic legacy Phase 8.2 fixtures

The retained legacy acceptance set includes:

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

The exact local timestamps and state values live in `site/phase8-2-fixtures.js`. These fixtures protect the preserved legacy renderer; they are not the acceptance authority for Betta colour or morphology.

## Release discipline

Executable renderer/shell work uses:

`dedicated branch → deterministic/syntax validation → Cloudflare Pages branch preview → smoke/visual testing → PR → merge → main production verification`

For the Betta production promotion use the dedicated `Betta Production Integration` branch workflow plus the general deploy, Phase 8.2 compatibility and launch-hardening workflows as regression gates. Future visual atmosphere changes require equivalent branch preview and authenticated live-route evidence.

Do not merge a visual atmosphere change that has unresolved genuine human visual judgment. When automated validation is green but realism/art direction needs native review, stop at the branch preview and provide the exact preview URL. Human visual approval remains authoritative for art direction.

## Security

- Never print, commit, or expose Cloudflare tokens, Supabase secrets, VAPID private keys, or other credentials.
- The publishable Supabase key present in the client is intentional and must remain constrained by database policy; do not replace it with privileged credentials.
- Do not weaken RLS or push-worker authorization to simplify testing.

## Glass material rule — 3 September 2026

**Glass only where it touches the atmosphere. Nothing inside a glass surface is glass.**

`backdrop-filter` cannot sample past an ancestor that already has one, so a glass
element inside a glass element renders as a flat fill however it is styled. This
was measured, not reasoned: an identical dropdown blurred correctly on `/fnb` and
not at all on `/ci`, purely because the CI specimen container was itself glass —
meaning the specification page was showing every glass component falsely.

Two weights of one material, both in `site/app-glass.css`:

- `--app-glass-fill` `rgba(46,39,59,.30)` — surfaces sitting on the atmosphere:
  masthead, footer, route cards.
- `--app-glass-overlay-fill` `rgba(38,32,49,.72)` — surfaces floating above
  content: dropdown menus, dialogs, sheets, toasts. They need more pigment to
  stay legible. Do not push this past `.92`; at that opacity it reads as solid
  black and stops being glass, which is how `.fnb-select-menu` ended up at `.98`.

Both use the same `--app-glass-filter` `blur(18px) saturate(1.18)`. There is no
third recipe for a surface. The `::backdrop` scrim behind a dialog or sheet is
not a surface: it dims the page and softens it with a light `blur(7px)` so the
dialog reads as floating. r28 considered removing that kernel and kept it,
because removing it visibly changes what shows through the scrim. Keep it.

Anything inside a glass surface takes a plain tint with no `backdrop-filter`.
That is not a downgrade: nested glass was already rendering as its flat fill, so
removing the declaration is visually identical and merely makes the CSS honest.

Enforced in two places. `scripts/page-centralization-audit.mjs` rejects a
`backdrop-filter` in any module template (the material is declared in
`app-glass.css` only), and `scripts/nested-glass-smoke.mjs` fails the build if
a rendered route has a blurred element inside a glass surface — which is
exactly how `.fnb-action-control` once acquired an inert blur.

### Control heights — 5 September 2026 (r28)

Three floors by role, in `app-tokens.css`, and nothing else declares a
`min-height`: `--control-row` 52px (a full-width thing you tap: list row,
disclosure, field, code cell, check row), `--control` 40px (a framed button,
chip or selector trigger), `--control-inline` 32px (a frameless utility, badge
or compact selector). Text areas size by `rows`. A literal `min-height` in
`app-components.css` is a regression.

### Rules over inventories — 5 September 2026

The glass rule above replaced an inventory of ~200 historical card classes with one
membership test. That is the method for every layer of this app, not only material:

- **Governing rules over inventories.** Historical class names are not product
  concepts. Before cataloguing variants, find the smallest rule that makes the
  distinctions irrelevant. A rule handles a component nobody has seen yet; a list
  only handles yesterday's.
- **New-primitive test.** A new component, material or token exists only for a
  genuinely different visual behavior, interaction, accessibility need or state
  model — never because the content, page or department differs.
- **Inventory tripwire.** If centralizing something requires enumerating dozens of
  variants, stop and test whether the abstraction is wrong before continuing the
  inventory. Say so and propose the rule first; the rule can be vetoed, a list
  cannot.
- **The neither outcome.** A rule may not apply. An object outside a rule inherits
  nothing from either side (a utility action is neither card nor structure); do
  not invent a class to hold it.

Keep design rules separate from browser facts. "Glass never nests" is measured
physics (`backdrop-filter` cannot sample through a blurred ancestor); the edge
test is a design decision. Only the second kind is open to revision.
