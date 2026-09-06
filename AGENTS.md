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
r30 (Phase 7, 5 September 2026) retired the last of it: the Supabase
presentation pack that served `/share/*` (`fnb.js`, `fnb-data.js`,
`fnb-share-ui.js`, `fnb-artwork-sync.js`, `fnb*.css`, `shell.css`,
`environment.css`, `betta-runtime.js`, the legacy `selectField` in
`app-select.js`, their regression test, smoke scripts and hotfix workflow).
Nothing of the old app ships. The public share is the shell itself in public
mode (see the share invariant below). The shell imports
`betta-runtime-full.js`, which `scripts/build-betta-runtime.mjs` rebuilds
byte-for-byte from the Betta sources (`--check` runs in Deploy).

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
- **Voice invariant (r24, 5 Sep 2026): `site/voice.html` at `/voice` (in-shell `#voice` via `voice-page.js`, listed under Settings › System beside the UI Library) is the master copy library - the way `/ci` is the master for components. Every string the app owns follows it: American English; one word per thing (employee, sign in, permanent code / one-time code, People & Culture, guest, promotion, broadcast, job, archive, revoke, turn on/off, phone, tap); Title Case only on hero and section titles; no period on titles, labels, buttons, badges, toasts or state titles; no exclamation marks, no "please", no apologies; errors are "Couldn't <thing>" + what to do; gates are "This tab is for …" + "Ask People & Culture …". Dates, times, money and counts are written only by `site/app-format.js` (hotel time, never a zone suffix; English `5 Sep 2026 · 6 pm`, `11:30 am`, `6:30–11 am`, weekday without a comma; Thai `5 ก.ย. 2569 · 18:00 น.`, Buddhist year) - no route formats its own. F&B promotion copy (`data-mode="verbatim"`) is rendered as provided; only a typo or grammatical slip may be corrected, in the data, with approval. The Voice page's specimens are filled by `app-format.js` at mount (`[data-format]`), so the document cannot drift from the code; `ci-page-render-smoke.mjs` renders `/voice` too.**
- **Artwork copy invariant (r25, 5 Sep 2026): section 03 of an F&B promotion (`#fnb/<id>` → `#artwork-copy`) is derived at render time by `site/fnb-artwork-copy.js` (`artworkCopy(campaign)`), never stored: the title verbatim, the subtitle from the press headline with its venue clause removed and never the title said again (r25c: `titleShare` rejects it, the next non-fact line or sentence stands in), and the body as one paragraph, never a table or a fact list (r25b): `summary` plus the press release's own non-fact sentences until ≥200 characters (r25c), then "Available <formatDateRange> at <outlets in OUTLET_ORDER> (<formatClock hours>)", the prices, the terms, IHG One Rewards, "Reserve at +66 2 796 8888 or eat.sindhornmidtown@ihg.com" and the enrollment link, sentence after sentence through `app-format.js`; the `*` channel line is returned as `channel` and shown in the note under the card, not in the copy. The designer sets the body as running copy on the artwork, so do not split it back into rows. The press-release EN/TH copy in 02 stays the verbatim reference. The specimen in `/voice` §17 is bound from the same module against a fixed Fried Chicken & Waffles record and the render smoke asserts it. A hand-written override would be a data field, proposed and approved first, never a page patch. The rail's chips grow from their labels (`flex:1 1 auto`, v33) so five fit one phone row.**
- **Masthead two-state invariant (r23): the account chip and the Messages icon each have two states driven by `data-mode` - `initials`/`close` on the chip, `messages`/`close` on the icon. While its destination is open the control is the accent close mark and tapping it returns to the page the employee came from (Settings → `returnHash`, Messages → the last non-Messages layer-0 page; Today when none). Never add a third way out of either.**
- **Footer pinning invariant (r36, 6 Sep 2026, SW v118): `.app-navbar` is `position:fixed` at the viewport foot, not `position:sticky`. A sticky footer can only stick inside its containing block, so it depended on `body{min-height:100dvh}` resolving to the visible height; where `dvh` resolves short - which it does on some Android builds - the bar floated above the ground with the page's own background beneath it, and a short page (the frame before content mounts) is where that showed. `.app-page.is-shell` already reserves the bar's height in `padding-bottom`, so nothing moved: `/` and `/voice` render 0 differing pixels. `body{min-height:100dvh}` stays, because it is what paints the ground to the bottom on a short route. The reference page shows `.app-navbar` as a specimen inside `.ci-shell-frame`, which therefore carries `contain:paint` so a fixed navbar is bounded by the specimen instead of escaping to the foot of `/ci` - that frame is the reference page's own chrome, never a library component.**
- **Betta composition invariant (r37, 6 Sep 2026, SW v119): composition is the eight `CAMERA_KEYS` - `offsetX offsetY cameraDepth scale rotationX rotationY rotation tiltStrength` - and `generateBettaStyle` deliberately keeps every one of them from the period's own preset, so a seed can never change framing. Settings › System › Readability Test edits them with `.app-field input[type=range]` sliders for **golden-hour and blue-hour only**; the other six of the eight periods stay locked (owner, 5 Sep 2026) and show no composition section. Dragging reads back live, the release applies the style and restarts the reading, and Save is the existing `sindhorn_betta_period_save_v1` - no schema change, no new RPC, still `system.manage` and still refused below 4.5:1. The ranges are the ones tuned in `site/betta-vignette-test.js`, which edited the same numbers but could only keep them in one browser. A hand-set camera means the style no longer derives wholly from its seed: the seed still describes palette, fins and motion, and the DB only checks that `style.seed` equals `p_seed`. **r37a: the chosen framing rides in `style.camera`, never in `style.params` — `styled()` in `betta-environment.js` ignores a camera in `params` by design ("styles override colors and form and never the camera"), so r37's sliders moved numbers the engine discarded. `style.camera` is the one explicit exception, which leaves every seed-derived style and every already-saved row behaving exactly as before; the runtime bundle must be rebuilt (`scripts/build-betta-runtime.mjs`) whenever the engine changes, and `betta-periods-release-smoke.mjs` excludes `camera` from the seed-reproduction test and validates it separately, or a composed period would report as "the randomizer changed".**
- **Today saved copy invariant (r38, 6 Sep 2026, SW v122): Today keeps the last report it read in `localStorage` (`sindhorn.today.dashboard.v1`, written by `business-dashboard-data.js`) and paints it on the frame it opens, so the page shows numbers rather than a skeleton. A copy is never an authority: whenever one is on screen the hero carries `savedNote()` under the title - "Saved copy, read <when>. Checking for a newer report." - and if the refresh fails, "Couldn't reach the server, so these numbers may have moved." The live report replaces it the moment it lands and the note goes. The skeleton and the error page never carry the note, because neither is showing a copy. Business figures are not styles: the copy is dropped as soon as the employee is not signed in, which `business-dashboard-data.js` hears from auth-client's `sindhorn:auth-changed` on `document`. Nothing else about the fetch changed - no asset caching was added, navigations stay network-first, and Supabase is still never touched by the service worker.**
- **Shell-from-disk invariant (r39, 6 Sep 2026, SW v123): a navigation to an app route is answered from the precache, never from the network first. `documentFor(pathname)` maps the route to its precached document - every shell route to `/index.html`, `/ci` to `/ci.html`, `/voice` to `/voice.html` - and only a miss falls through to `fetch`. Before this the worker fetched the document and fell back to the cache **only when the network failed, with no timeout**, so a cold launch paid a full round trip for a document it already held, and the app could not open faster than the network answered. It is also the more honest pairing: one cache holds a release's shell and its assets together, while fetching the document fresh could pair a newer shell with the assets the installed worker still holds. Freshness stays the worker's job - a release changes `VERSION`, the new worker precaches and claims, and the launch after that opens on it. Routes that are not app routes (`/idui`, `/evidence`, `/share/*`, a business-card slug) still go to the network, and offline still opens. **r39a: a navigation may never be answered with a redirected response — the browser fails it outright — and Cloudflare Pages 308s `/index.html` to `/`, `/ci.html` to `/ci` and `/voice.html` to `/voice`, so the precached copies carry that flag. `document_()` rebuilds the response from its body to drop it. r39 shipped without this and every launch under a controlling worker died with `ERR_FAILED`; no local test could see it, because a static file server answers `/index.html` with a plain 200. `sw-install-resilience-smoke.mjs` now 308s those paths the way the host does and, after installing the worker, opens `/`, `/next`, `/ci` and `/voice` — restore the old line and it fails. A client stuck on such a worker does recover: the failed navigation still triggers the worker update, so the next launch a couple of seconds later opens on the fixed one.**
- **Betta composition editor is put away (r39): `COMPOSITION_PERIODS` in `readability-page.js` is empty, so no period shows composition sliders. The engine still applies a saved `style.camera` and `betta-periods-release-smoke.mjs` still validates one; only the editor is gone. Reopen a period by naming it in that set, or use the standalone playground `/betta-vignette-test?period=<key>&camera=1`, which judges a framing by eye and copies the numbers out.**
- **Open-first invariant (r40, 6 Sep 2026, SW v125): the shell routes before auth resolves when this device already holds a session. `hasStoredSession()` in `auth-client.js` answers from storage with no network call; `opening()` in `shell.js` is true only while auth is uninitialised and a session exists, and `resolve()` then returns the wanted route instead of `signin`. Auth confirms it, or the existing `sindhorn:auth-changed` listener corrects to sign-in - the same correction a session expiring mid-use already makes, and `business-dashboard-data.js` drops the saved report on that event, so a stale session leaves no business figures on screen or on disk. A developer route resolves to `today` during the optimistic window rather than bouncing through `#settings/system` before the profile is known. A device with no stored session still waits, because there is nothing to guess. Measured at a 400ms round trip: first Today paint 468ms → 98ms with a valid token, 847ms → 75ms with an expired one; a stale session paints Today at 78ms and lands on sign-in when auth answers.**
- **Markup helpers are library (r40): `site/app-html.js` holds `esc`, `state` and `skeletonLine`, which thirteen, six and two page modules had each written identically. A page's `field()` builders and its `skeleton()` shapes stayed where they were: they differ in signature and content because they describe that page, and a composition adopted by a second page is questioned, not promoted. The audit's per-file class tally falls when duplication goes (549 → 534 across the shell) - that number is a sum of distinct classes per file, not coverage; no class was lost.**
- **Job card invariant (r23, r23c, r28): a job is not a component - it is an `.app-card.app-surface` whose groups (the ask, the facts, the actions) are `.app-card-section`s, with the surface text roles (`.app-surface-label` / `-title` / `-copy`), a split `.app-row` of actions at the foot (status selector at the start, Update at the end, both at the inline height), `data-tone="quiet"` on a done card and `data-tone="danger"` on a tight deadline metric; the status is the compact selector (`.app-select[data-compact="true"]` from `app-select.js`, the trigger an `.app-badge` in the status's tone) - a real dropdown, and a pick saves through `sindhorn_jobs_set_status_v1` at once. Glass never nests, so `bindAppSelects` lifts a card selector's open menu to `<body>` as `position:fixed` anchored by the three `--app-select-*` custom properties it sets and clears - the library's one runtime geometry, never a page's. A selector inside a `<dialog>` stays in place.** **r35 (6 Sep 2026, SW v117) makes the card compact without moving anything off it: everything the tracker is read for stays on the face - the received label, the title, Sent by / Deadline, the status selector and Update - and only the description folds behind a `.app-disclosure-toggle` at the top right of the head. A job with no description carries no arrow. The card stays an `.app-card.app-surface`; it takes the disclosure's panel through `data-open`, which is what the panel and the chevron now key off instead of `.app-disclosure`, and the panel's own padding and hairline are scoped to `.app-disclosure` so a folding card adds neither. The list is `[data-sortable]` and a press-and-hold reorders it through `site/app-drag-sort.js` (280ms hold, 10px slop, so an earlier movement stays a scroll and pull-to-refresh is untouched); the order saves through `sindhorn_jobs_reorder_v1`, which has existed unused since r21. The four page copies of the disclosure toggle plus the library's are now `site/app-disclosure.js`. Both new modules are in the page audit and the precache.**
- **Developer-only routes invariant (r29a, 5 Sep 2026): `/ci`, `/voice` and `#readability` exist to build the app, not to use it, so they open only for the developer account - `getState().profile.account_type === 'developer'`, the value the profile RPC already returns, never a capability or a role. `shell.js` keeps them in `DEVELOPER_ROUTES`: `resolve()` bounces anyone else to `#settings/system`, `layerOf` and `paintNavbar` treat them as settings; the standalone `/ci` and `/voice` boots run `initAuth()` first and show the "Developer only" gate state from `/voice` instead of binding the library; Settings › System lists the three cards only for the developer. A new developer tool joins the set, it does not grow its own check.**
- **IDUI export invariant (5 Sep 2026): `docs/idui/idui-body.html` is the source of the Invariant-Driven UI methodology document - library classes only, no presentation of its own - and `docs/idui/IDUI-v0.1.html` is its export, built by `node scripts/build-idui.mjs` from the six foundation CSS files as shipped and stamped with the service-worker `VERSION`. Every release that goes live rebuilds and commits the export (the owner's rule); `build-idui.mjs --check` runs in the deploy guard so a stale export fails the release. When a release changes a rule the document states (an invariant's status, a token decision, an enforcement level), the body is updated in the same commit; the stamp alone is not an update.
- **Sky mode invariant (r30, 5 Sep 2026): the Betta engine has two modes and one scene. `betta` draws the fish; `sky` (`uSky` in the background shader, `site/betta-environment.js`) draws no fins and instead blends the period's four saved palette colors into its three saved sky stops as slow plumes, so the sky is the same eight-period cycle, the same saved styles and the same Himawari drivers (motion → drift, energy → breathing and drift speed, cloud/vapor → softness, cold → cooling, the satellite tint as before). Plume intensity is a rule, not a value per period: `SKY_PLUME_ENERGY / Σ luminance(palette)` clamped to `[.12,.6]`, calibrated so every period's Muted reads ≥5.2:1 on the glass. Mode resolves in this order: a request (`SindhornEnvironment.setBettaMode('auto'|'sky'|'betta')`, used only by the Readability Test's Sky transport, which also closes Save while the sky shows) → the employee's own choice (r32b, SW v113: `SindhornEnvironment.setBettaPreference('auto'|'betta'|'sky')`, kept in `sindhorn-midtown:betta-preference:v1`, reason `preference`; the Atmosphere `app-select` in Settings › System › This app is its only UI; choosing Betta also removes the low-end memory, and the governor never judges a phone whose employee has chosen) → `prefers-reduced-motion: reduce` → sky held still (`uTime` frozen; reason `reduced-motion`) → a remembered low-end phone (`sindhorn-midtown:betta-mode:v1`, seven days; reason `low-end`) → sky drifting → otherwise betta. The governor decides low-end once per session from the rendered frames themselves - 600 ms after the first frame, a 3 s window, median frame delta above 28 ms - and never in a WebDriver session, so CI always measures the fish. The body carries `data-betta-mode` and `data-betta-mode-reason`; Settings › This app holds the Atmosphere selector and a note saying which mode is drawn and why; the Readability Test hero carries the library back control to `#settings/system`. The eight saved styles stay locked; the sky reads them, it never edits them. Motion rule: reduced motion means the sky stands still, not a slower fish.**
- **Public share invariant (r30, Phase 7, 5 Sep 2026): `/share/fnb` and `/share/fnb/<id>` are the shell. `scripts/generate-fnb-share.mjs` (Deploy, publishable key, `sindhorn_fnb_public_read_model` only - it reads no `sindhorn_app_files`) cuts each page from `site/index.html` with asserted regexes: crawler meta in, PWA identity, robots, inbox preloads, the masthead tools and the navbar out, the logo an inert `<div>`, `<body data-public="fnb" data-public-id>`. `shell.js` in `PUBLIC` mode registers no service worker, runs no auth and no inbox, forces the `fnb` route and mounts `mountFnb(host, { public: true })`: the same F&B page with the checklist, progress and editor removed, the public RPC, `loadFnbPromotions({ persist: false })` so the public dataset never overwrites a phone's offline copy, the Share button kept (it shares the page itself) and the artwork folder a disabled `.app-primary` when it is not linked. One CSS rule serves public mode (`body[data-public]` in `app-components.css`: navbar height 0, inert logo); no share stylesheet, no share runtime, no per-page CSS. The service worker treats `/share/*` as non-app navigation, so an installed phone may serve a shared page the previous shell modules once until its next app open. `ci-page-render-smoke.mjs` renders the generated index and one promotion against a local fixture and asserts all of this before every deploy; `site/share/` is generated output, never committed.** Since r31 the cut is `site/public-page.js` (`publicPage(index, { mode, title, url, description, id, robots, bootstrap })`), shared with the business card worker; the generator only supplies the F&B meta.
- **Public business card invariant (r31, 5 Sep 2026): `/<slug>` and `/<slug>.vcf` are served by `site/_worker.js` (Cloudflare Pages advanced mode; `site/_routes.json` includes `/*` and excludes `/assets/*`, `/icons/*`, `/share/*`, `/vendor/*`, so every other path passes through `env.ASSETS.fetch(request)` unchanged). A `functions/` directory is never deployed beside `_worker.js` and must not return - that is why the card was dead from 30 Aug to 5 Sep. The worker reads `public.sindhorn_public_business_card(p_slug)` with the publishable key (the function alone decides what a published card shows), cuts `site/index.html` with `publicPage` into `<body data-public="card" data-public-id="<slug>">` plus a `<script type="application/json" id="businessCardBootstrap">` (JSON with `<`, `>`, `&` escaped), keeps the `noindex` meta and sends `cache-control: no-store` and `x-robots-tag`; `.vcf` is `buildVCard` from `site/business-card-core.js` (wrangler bundles the worker's imports) as `text/vcard` attachment. An unknown slug still gets the shell in card mode and the page shows its unavailable state; never the SPA fallback for `.vcf` (404). `shell.js` treats `data-public="card"` (or a bare six-character path answered by a cached shell) as public mode and mounts `mountCard` from `site/business-card-page.js`, which reads the bootstrap first and fetches the public RPC only without one. `business-card-page.js` owns the card body (`businessCardMarkup`, `publicView`, `shareCard`) for Settings › Me, its presenting dialog and the public page alike - one markup, no card stylesheet, no override sheet (`app-shapes.css` is gone; the ratchet FOUNDATION set is six files). Slug allocation (`sindhorn_private.sindhorn_business_card_base_slug`: five letters of the first name plus the surname's first letter, collision ladder, `fg_shortlinks` reservation), the local Version 6 QR (`site/qr-v6.js`) and the vCard builder are verified and unchanged; do not redesign them. `ci-page-render-smoke.mjs` runs the same cut over a fixture card and an unknown slug before every deploy; the deploy smoke proves the worker on a slug no card can own (`/zzzzz0`) so no employee's published state is a CI dependency.**
- **Material authority invariant (r53, 6 Sep 2026): Invariant 1 is split.** The generic law is *material has one authority* - a consumer declares semantic role and context, and only a registered material authority may derive fill, edge, blur, shadow or related material treatment. *Sindhorn admits one material family, glass*, and that sentence is now a Sindhorn constitution law, not an IDUI one: Origarium's paper is its own authority under `idui-core/evidence/origarium/materials/`, and paper is never renamed glass so an older invariant stays literally true. **Core may define the grammar of authority; it may never own the product-specific authorities themselves.** `governance/idui-contract.json` is the governed registry - material authorities, surface roles, admitted primitive identities and variant values, declared exceptions - and it governs Core without being Core. Three gates read it: `material-authority-gate.mjs` (Closed - authoring material outside an authority fails; `background:none` is declining, not authoring; a surface is a registered role, never a name prefix), `vocabulary-admission-gate.mjs` (**Stop-gated** - a new primitive identity, variant attribute or variant value halts the build with NEW VOCABULARY DETECTED and the owner classifies it; a part of an admitted primitive is structure and passes), and `ci-library-coverage.mjs` (Closed - anything a Sindhorn page renders must be specimened in /ci). **Admission is a change to the registry, which CODEOWNERS covers - never a marker the builder writes for itself.** Until the branch ruleset enforces CODEOWNERS, these are *enforced but not agent-closed*, and must be described that way.
- **IDUI core invariant (r32, 6 Sep 2026): the foundation is seven sheets - `app-tokens.css` (values), `app-glass.css` (material, now including the dialog/sheet scrim as `--app-glass-scrim-fill` / `--app-glass-scrim-filter`), `app-components.css` (primitives), `app-compositions.css` (compositions: assemblies of primitives shaped by one page's content - promotion card, directory, swatches, table, business card; a composition adopted by a second page is questioned, not promoted), `app-shell.css`, `fonts.css`, `ci-library.css`. No `!important` anywhere in site CSS (the typeface lock holds by cascade order and `font-architecture.test.mjs`); no radius literal but the tokens (`--radius-tight` for the check box, `--radius-none` for a menu option). Variants are attributes from one vocabulary - `data-tone size width columns mode open compact direction split rule icon stagger`, state `data-view run set locked ready public view-demo` - and never `.app-*--modifier` classes; `data-floating`, `data-values`, `data-track-ready`, `data-verbatim`, `data-scale`, `data-span`, `data-gap` were folded into `data-mode` / `data-ready` / `data-size` / `data-width` / `data-compact`. Both-or-neither: a row holds framed buttons or frameless utilities, never both, except a hero head and a dialog foot. `scripts/idui-invariants-smoke.mjs` (grammar, modifier classes, `min-height` literals, action weight) and `scripts/ui-shape-source-audit.mjs` run in the deploy guard. `idui-core/` is the four core sheets plus the Sindhorn constitution (tokens + fonts) copied verbatim; `scripts/idui-core-parity-smoke.mjs` fails the guard on drift (`--sync` recopies after editing `site/`). `/ci` sections are labelled by tier (01-04 Foundation, 05-20 Primitive, 21-23 Composition; Table moved to 21). The one inline `<style>` in the tree is `site/betta-vignette-test.html`, a developer instrument its preview workflow fetches; it is named in the IDUI doc and stays. The notification inbox's legacy renderer was dead code and was deleted; Messages renders on `app-list-row` as before.**
- **IDUI transfer evidence (r32a, 6 Sep 2026, SW v112):** `idui-core/constitutions/flipgazine/` is a second constitution written from `https://flipgazine.pages.dev/ci.html` (values only; nothing was deployed to Flipgazine and its repository was not touched). `idui-core/evidence/` is the transfer test: `specimens.html` (one fragment of `/ci` markup, no CSS), `build.mjs` (writes `sindhorn.html` and `flipgazine.html`, six links in the README order, tokens last), `transfer-smoke.mjs` (Playwright; refuses page CSS and nested glass; writes `measurements.json` and one viewport screenshot per constitution; `--shots <dir>` for per-section JPEGs, not kept). It is not a deploy gate; run it by hand after a core change. Result and the seven findings are `docs/idui/` §08 Transfer and `idui-core/README.md`: `--tracking` and `--space-*` declared but unconsumed; shell ground `#2E273B` a literal; inputs and icon-only controls fall to UA weight 400; three weights and no pill on a control are law (document, do not change); a constitution's font files must travel with it (Sindhorn's `fonts.css` points at `/assets/fonts/`); `--app-success`/`--app-danger` are slots a brand must fill. T1, T3–T6 were fixed in r33 (below); T2 is half-answered (space tokens consumed on the steps, 18 literal gaps between them remain); T7 stays demanded by design.
- **IDUI rebuild test and core falsifications (r33, 6 Sep 2026, SW v114):** `idui-core/evidence/rebuild/` is IDUI's first external adversarial case - Flipgazine's real page "Moving to Claude Code" (its seven style blocks, shared header, WebGL atmosphere, glyph field, theme engine) rebuilt through `constitutions/flipgazine/` (rewritten from the real page, rule by rule) and the core's primitives with no CSS and no style attribute in the page. `PROTOCOL.md` was frozen before the after-metrics; `convert.mjs` is the deterministic class mapping; `measure.mjs` (Playwright, pinned clock and period, every Supabase read answered from `flipgazine-source/` on disk) writes `comparison.json` and `shots/`; `README.md` publishes wins and losses (356 → 0 appearance decisions in the page, every named change 14–24 edits → 1, 5 → 1 blur recipes, 3 → 0 nested glass; **2.9× the CSS bytes** for a one-page product, 90 glass elements against 38, and a declared deviation list - all published); `FALSIFICATIONS.md` is the log. The engines (`after/engines/`, verbatim but for one fetch removed from `fg-theme.js`) are preserved, never IDUI-ified: IDUI governs the interface's relationship with an engine (engine writes `--bg --text --accent --glass`, constitution aliases, core derives), it does not absorb one. `flipgazine-source/` is the 15-file `site_files` snapshot with the anon key redacted at four sites (`FG_ANON_KEY_REDACTED`); Flipgazine's repository, database and `site_files` were not modified and nothing was deployed there. **Core rule since r33: the core declares no value a constitution could want to change.** Nine assumptions moved out of the core into the constitutions, each with 0 differing pixels for Sindhorn: tracking / label weight / display case (`--tracking --tracking-label --tracking-display --case-display --weight-label --weight-medium`; zero tracking is Sindhorn's constitution, held by the font test, and not the core's), the shell ground (`--app-ground`), the control radius (`--radius-control`; "never circular" is Sindhorn's, checked by the shape audit), the page and prose measures (`--measure-page --measure-prose`), the code face (`--font-code`), the material's seven values (`--app-glass-*`; `app-glass.css` declares the rule and no value), the shell band (`--app-shell-band`), and the font files (`constitutions/sindhorn/assets/fonts/`, parity-checked; `fonts.css` names them relative to itself so the same file serves `/fonts.css` and the constitution folder). `scripts/idui-constitution-completeness.mjs` runs in the deploy guard: every `--*` the core consumes must be declared by every constitution and every declared token must be consumed. The new-capability test for the core, always: *is this a reusable semantic degree of freedom required by multiple legitimate constitutions, or one application's historical exception?* (tracking yes; a catalog thumbnail tilt no). Invariant 4 is now "one face - the constitution declares family, weights, tracking and case; the core declares none", invariant 5 "one shape system - every radius a token, no literal in the core". `--app-success` / `--app-danger` remain slots the core demands (T7), left visible on purpose.**
- **Public document pages /idui and /evidence (r34, 6 Sep 2026, SW v115):** the IDUI methodology and the rebuild-test evidence are pages of the Sindhorn site. Both are built, never hand-edited: `scripts/build-idui.mjs` writes `site/idui.html` from `docs/idui/idui-body.html` (the same source as the offline export, one `--check` for both outputs) and `scripts/build-evidence.mjs` writes `site/evidence.html` from `docs/idui/evidence-body.html` with every number resolved from `idui-core/evidence/rebuild/comparison.json` and the four first-screen captures copied to `site/assets/evidence/`. `scripts/public-doc-page.mjs` is the shared shell: the seven foundation links read from `site/ci.html`, `<body data-public="doc">`, the canvas stage, the share pages' masthead (inert logo, no tools, no navbar - read from `site/index.html`), and `site/public-doc.js`, which boots the full Betta runtime and calls `setBettaMode('sky')` (the requested mode only; the stored preference is untouched). `docPage()` refuses a body with `<style` or `style=`. Cloudflare Pages serves `/idui` from `idui.html`; the service worker passes both navigations to the network (not app routes, not precached); `_worker.js` is unchanged (six-character slugs only). Gates: both pages are in `page-centralization-audit.mjs` (foundation + `ci-library.css`), rendered by `ci-page-render-smoke.mjs` (public doc, no chrome, inert masthead, no manifest, no SW, no page CSS, hero title, section and chip counts, `data-betta-mode="sky"`, a real canvas, every image loaded, no overflow; the worker's `/api/betta-satellite` is stubbed there), and `build-evidence.mjs --check` joins `build-idui.mjs --check` in the deploy guard. Two audits learned that quoted text is not a declaration: the page audit strips `<code>…</code>` before scanning HTML for classes, color functions and `backdrop-filter`, and the font test applies the retired-family rule in HTML only to `font-family` values (prose may name Poppins; a declaration or a Google Fonts link still fails). One core rule added: `.app-note a` takes the accent like `.app-prose a` (a link in a note was the UA's blue; no Sindhorn page had one). Side-by-side figures use `ci-library.css`'s existing `.ci-stack` (two columns from 700px) on an `.app-stack`; no new primitive. Screenshots inside the evidence page are `.app-figure` with intrinsic `width`/`height` and `loading="lazy"`.
- **Readability Test invariant (r29a, 5 Sep 2026): `#readability` (`site/readability-page.js`) is where the Betta of each period is chosen and judged; nothing else edits Betta styles. A style is configuration, not a live visual input: `betta-random.js` is the Mac Betta Metal Lab randomizer ported verbatim (SplitMix64, 24-bit web seeds, colors and fin form per period, camera and composition untouched), and a seed reproduces its fish. The reading is taken from the rendered frame, never from palette hexes: `sampleBettaFrame()` renders the live scene once through a 64px sampler renderer, `betta-readability.js` softens it as the glass would, composites `--app-glass-fill` and reports WCAG contrast for Ink, Muted (flattened) and Accent - the lowest sample per role, kept as a watermark while the period is on screen; every role must clear 4.5:1 before Save opens. Saved styles are the app's configuration (r29b, 5 Sep 2026): `public.sindhorn_betta_periods`, RLS with no policies, reached only through `sindhorn_betta_periods_v1()` (anon-readable, returns the style map and nothing else because the atmosphere renders before sign-in) and `sindhorn_betta_period_save_v1` / `sindhorn_betta_period_reset_v1` (`system.manage`; save re-checks the 4.5:1 contract server-side and refuses with `23514`, so the rule holds without the page). The runtime boots from this device's copy (`localStorage` `sindhorn-midtown:betta-styles:v1`) so the launch stays fast; `shell.js` `refreshBettaStyles()` fetches the server map after the first frame, applies it only when it differs and rewrites the copy; the page writes the copy from the server's returned map, never from the runtime, so a fish only tried is never kept. Release gate (r29c): `scripts/betta-periods-release-smoke.mjs` runs before every deploy and reads the live map the way a phone does; every saved style must be reproduced by `generateBettaStyle(baseline, seed)` under the code about to ship, so a randomizer change cannot silently redraw a measured fish - a failure means re-running the Readability Test for that period, never editing the row. All eight periods have been saved since 5 Sep 2026 (r29d), so deploy.yml runs it with `--require-all`: an unsaved period fails the release. Muted is `--app-muted` at .70 (r29d, 5 Sep 2026): translucent ink has a contrast ceiling (5.9:1 over black at .55), and measured across 40 fish the .55 token passed 6 and every bright period none, while the four fish saved on a phone at .55 re-read 4.1-4.7 - a coin toss, not a contract; .70 is the lowest alpha with a margin (the same fish read 5.6-6.8) and the bar stays 4.5:1 for all three roles, no discount, no region, no palette cap. The alpha is stated once in `app-tokens.css` and mirrored in `betta-readability.js`; route tokens alias it (`--fnb-muted`). Original is the bundled preset (style `null`), never a copy of it. A swatch (`.app-swatch`) is a sample of a color, not a surface: no edge, no glass, its color an SVG `fill` attribute - data, never a style.**
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

They do not require editing business content into JS or deploying Cloudflare. The current exception is a genuinely new promotion ID whose individual crawler-ready `/share/fnb/<id>` physical HTML page has not yet been generated; any deploy regenerates every page from the shell (r30), so the release step is a deploy, nothing more.

Artwork completion state is separate from workbook content and must not be reset by imports. Workbook SharePoint/OneDrive artwork-folder links are canonical activation metadata and are intentionally available in public read-only F&B shares; the destination still enforces IHG authentication.

## Presentation / Supabase split

**Retired as a runtime dependency in r30 (Phase 7, 5 September 2026).** Nothing
in the shipped app, the public share or the deploy reads
`public.sindhorn_app_files` any more; the shell and every page are static
files in this repository, and the F&B data is the operational tables through
the `sindhorn_fnb_*` RPCs. **The table was dropped on 5 September 2026** (owner-approved
decommission; migration `20260905230000_sindhorn_app_files_decommission.sql`,
applied live). A backup of the row manifest (368 rows, packs 1-49) and the last
enabled pack (49) sits in the owner's Downloads
(`sindhorn_app_files-backup-2026-09-05/`). The lineage below is history only;
do not recreate the table or the pack mechanism.

Historical record follows. Supabase owned versioned presentation resources; GitHub/Cloudflare owned the stable executable renderer and shell.

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
- `site/_worker.js` + `site/_routes.json` — the Pages worker: the locked-down same-origin JMA satellite proxy at `/api/betta-satellite`, the business card at `/<slug>` and `/<slug>.vcf` (r31), and `env.ASSETS` passthrough for everything else.
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
