# Handoff — Sindhorn Midtown Internal

Written 6 September 2026 after r34a (SW v116), revised 8 September after r68
(SW v147), for whichever session continues
this work. `AGENTS.md` is the law; this file is the map. When they disagree,
`AGENTS.md` wins and this file is stale — fix it.

## 1. Where things are

| Thing | Where |
|---|---|
| Working tree | `~/Documents/sindhorn-midtown-internal-claude` (branch `land-baseline`) |
| Push | `git push origin land-baseline:main` — production deploys from `main` |
| Production | https://sindhorn-midtown-internal.pages.dev |
| Master UI library | `/ci` (`site/ci.html`) — every primitive and composition, with the rule beside each specimen |
| Master copy library | `/voice` (`site/voice.html`) |
| The method | `/idui` (built from `docs/idui/idui-body.html`) |
| The evidence | `/evidence` (built from `docs/idui/evidence-body.html` + `idui-core/evidence/rebuild/comparison.json`) |
| Core | `idui-core/` (four sheets + `constitutions/<name>/{app-tokens.css,fonts.css}`) — edit here first, `cp` to `site/`, parity gate checks both |
| Supabase | project `sjpvhgxacsiorrtijqua`, shared with Flipgazine |
| Owner's memory | `~/.claude/projects/-Users-Graphic/memory/MEMORY.md` (index) — read it at session start |

The user is Decha, Senior Graphic Designer, Marcom, Sindhorn Midtown Hotel.
They own the product and make every visual call. They read screenshots
closely; show phone width (390) first.

## 2. The rules you will actually trip on

All of these are in `AGENTS.md` with their history. The short form:

1. **Centralized only.** No inline CSS, no per-page CSS, no `style=`, no `<style>` in a page. If something genuinely cannot be done centrally, *say so before doing it*, and if the owner declines, leave it be.
2. **Library first.** Look in `/ci` before writing a new class. A composition adopted by a second page is questioned, not promoted. "Rules over inventories."
3. **Glass.** A card is anything that draws an edge → glass. Glass never nests. `nested-glass-smoke.mjs` enforces it.
4. **Report first** for anything that changes what the owner currently sees. Plan + mockup, wait for a go. "If it changes the current visual, keep it" means: don't alter a visual as a side effect.
5. **Never retry page transitions** (r13–r14d). Don't touch `app-view.js` transition logic.
6. **Every release bumps `VERSION` in `site/sw.js`** (`v<N>-<slug>-r<NN>`), rebuilds the IDUI docs, and you tell the owner when it is live — verified on production with Playwright, not curl.
7. **The IDUI doc is part of every release.** `node scripts/build-idui.mjs && node scripts/build-evidence.mjs` in the same commit as the SW bump; `--check` for both runs in the deploy guard. When a release changes a rule the document states, edit the body in the same commit.
8. **The eight Betta periods are locked.** Don't touch saved period styles.
9. **Hero titles Title Case; everything else sentence case.** Voice rules in `/voice`: American English, am/pm without leading zero, Thai 24-hour, promotion copy verbatim.
10. **"Rounded, never circular."**
11. **IDUI is a method, not a tracker.** Zero-tracking is Sindhorn's constitution, not the core's. New core capability test: *is this a reusable semantic degree of freedom required by multiple legitimate constitutions, or one application's exception?* Since r33 the core declares no value a constitution could want to change — `idui-constitution-completeness.mjs` (68 tokens) enforces it.

## 3. Security constraints (verbatim, in force)

- Never print, commit, or expose Cloudflare tokens, Supabase secrets, VAPID private keys, or other credentials. The publishable Supabase key in the client is intentional and must remain constrained by database policy; do not replace it with privileged credentials. Do not weaken RLS or push-worker authorization to simplify testing.
- The CI test PIN lives only in the `CI_SMOKE_PIN` secret (with `CI_SMOKE_EMPLOYEE_NUMBER`); never print it.
- Admin writes are exercised only against the local mock, never the live project (rolled-back transactions accepted). Any live write — a migration, a column, a policy — is owner-approved explicitly, each time.
- Never handle the push bridge token/URL values. Broadcast push provisioning is the owner's task.
- **Never touch tables belonging to the other projects sharing this database.** `fg_*`, `site_files`, `flipgazine_periods`, `job_tracking_*` are Flipgazine's — read only. (The business card reserves one slug row in `fg_shortlinks` by design.)
- Never treat `/private/job-tracking-data.html` as a data source.
- **The daily business reports never enter the tree.** `today-update/` is where the owner drops the F&B workbook and the Rooms pickup PDF for the ingest; it is ignored since 8 Sep 2026 because r60 (7 Sep) had committed the two 7 Sep files to the public repo and the 23 commits since had to be rewritten to purge them (see §6). Never `git add -A` around that folder, never un-ignore it; the runbook's security boundary (raw XLSX/PDF bytes, real figures, notes) applies to the repo, Pages, fixtures and artifacts alike.
- Do not modify or deploy the Flipgazine repo or its `site_files`. Flipgazine's anon JWT may be used only to read `site_files` the way the shell does; any Flipgazine source committed here has the key redacted (`FG_ANON_KEY_REDACTED`, four sites under `idui-core/evidence/rebuild/`).

## 4. How to ship a release

```sh
# 1. edit core first, then mirror
cp idui-core/app-components.css site/app-components.css   # etc.

# 2. bump site/sw.js VERSION, then rebuild the docs (they stamp the VERSION - rebuild AFTER the bump)
node scripts/build-idui.mjs && node scripts/build-evidence.mjs && node scripts/build-origarium.mjs && node scripts/build-betta.mjs

# 3. the release brief runs every gate below, the four --check builders and a pixel diff
#    of 15 routes (HEAD vs working tree, 390 + 1280; the nine signed-in routes render from the
#    synthetic fixtures in scripts/release-brief-fixtures.mjs). ~6 min. Exit 0 clear, 10 ask
#    the owner with the question popup (registry, workflows, moved pixels), 1 broken. It never
#    pushes. If a recorded gate script changed, `node scripts/contract-integrity.mjs --seed`
#    (owner's act) before it can pass.
node scripts/release-brief.mjs

# 3b. the gates one by one (what the brief runs)
node scripts/ui-centralization-budget.mjs          # ratchet: 11 metrics may only fall
node scripts/page-centralization-audit.mjs         # 0 findings on 5 pages
node scripts/ci-page-render-smoke.mjs              # Playwright; includes /idui, /evidence
node scripts/idui-invariants-smoke.mjs
node scripts/idui-core-parity-smoke.mjs            # core == site, 10 pairs
node scripts/idui-constitution-completeness.mjs
node scripts/nested-glass-smoke.mjs
node scripts/shell-precache-parity-smoke.mjs
node scripts/ui-shape-source-audit.mjs
node scripts/build-idui.mjs --check && node scripts/build-evidence.mjs --check
node .github/tests/font-architecture.test.mjs
# next-signin-smoke.mjs needs BASE_URL — it is the post-deploy smoke, CI only

# 4. commit, push, then watch ALL workflows for the SHA — never `gh run list --limit 1`
git push origin land-baseline:main    # or <your-branch>:main - two worktrees ship to main now
#   (sindhorn-midtown-internal-claude on land-baseline, sindhorn-midtown-internal-r67 on
#   r67-audit-fixes); the loser of a push race rebases onto origin/main, resolves sw.js
#   VERSION to the next number, rebuilds the four docs, re-runs the brief, and pushes again
gh run list --limit 10 --json headSha,name,status,conclusion \
  --jq '.[]|select(.headSha[0:7]=="<sha>")|"\(.status) \(.conclusion) \(.name)"'

# 5. verify on production with Playwright (sky mode, canvas, fonts, no console errors), then report "rNN live (SW vNNN)"
```

Five workflows can fire on `main`, each on its own path filter — a UI
release usually fires four of them:

| Workflow | Fires when you touch |
|---|---|
| Deploy Sindhorn Midtown Internal | `site/**`, `scripts/*-smoke.mjs`, `.github/tests/**`, `docs/**`, `AGENTS.md`, `supabase/migrations/**` |
| Launch Hardening | `site/**`, `docs/**`, `AGENTS.md`, `supabase/migrations/**` |
| LINE Seed Sans TH Typography Gate | `site/**`, `docs/**`, `AGENTS.md`, `.github/tests/**` |
| Phase 6 Web Push Release | `site/sw.js`, `shell.js`, `index.html`, push files, `worker/**` — so **every SW bump** |
| Phase 9 Supabase Employee Auth | `auth-client.js`, `shell.js`, `signin-page.js`, `settings-admin.js`, `qr-v6.js`, `fonts.css` |

This bit me on r34 and r34a: the Typography Gate failed on both pushes
while I watched only the Deploy run and reported the release green.

Harness notes: cwd resets after each Bash call → absolute paths. `grep` is
ugrep here; use `/usr/bin/grep`. Playwright: `chromium.launch()` with a
fallback to `{channel:'chrome'}`. Cloudflare's branch alias can lag the
deployment by minutes — poll `/sw.js` for the new VERSION before verifying.

## 5. The queue, in order

### 5.1 Jobs tracker — done in r35 (SW v117, 6 Sep 2026)
Compact cards shipped: the card keeps the received label, title, Sent by /
Deadline, the status selector and Update on its face and folds **only the
description** behind a `.app-disclosure-toggle` at the top right (the owner's
correction to a first version that had moved more off the face). No
description means no arrow. `site/app-disclosure.js` is now the single
disclosure toggle. Swipe gestures were deliberately **not** ported. The press-
and-hold reorder (`app-drag-sort.js`) shipped in r35 and was **removed in r61**
(7 Sep) when the list went two-up above 700px: it computed the drop from the
vertical midpoint alone, meaningless in two columns. Jobs is ordered by received
date; `sindhorn_jobs.sort_order` and `sindhorn_jobs_reorder_v1` are untouched
so a different gesture could take the job later without a migration.

### 5.2 `app-html.js` helper refactor — done as r70
Shipped 8 Sep 2026 (SW v149), no visual change. `site/app-html.js` now also
holds `metric` (F&B, Brand, Me, System — Brand's optional note defaults away;
the two Settings pages keep their `'—'` for a blank at their own call sites,
because a zero is a value on F&B), `disclosure` (Today and Brand — `id`,
`open` and a `stack` flag for the panel's inner wrapper: Brand's bodies are
loose blocks, Today's rule themselves with card sections), `skeletonCard`
(Messages and System; the business card keeps its own with the square QR
line) and `retryRow` (the four Settings retry rows; F&B's has an icon and
Today's is a primary control, so those stay). `field()`, the page loading
compositions, the heroes and Today's delta metric stay page-local — not the
same composition twice. Residue, not work: `app-select.js` and
`public-page.js` still carry their own `esc` — `public-page.js` legitimately,
because wrangler bundles it into `_worker.js` away from the browser module
graph. Proof: a scratchpad DOM diff rendered twelve routes
from HEAD and the tree on one origin and found identical markup once the
whitespace between tags is folded (Brand's disclosure lost indentation that
no box drew); each helper was also checked against the literal it replaced;
the release brief's pixel diff read clean apart from the version stamps.

### 5.3 Inbox-run scope — answered
Owner, 8 Sep 2026: an inbox run updates **only the Sindhorn app**. The spec
stays Flipgazine's `.claude/jobscan.md`, not `AGENTS.md`.

### 5.4 Broadcast push provisioning
On the owner. Runbook: `docs/BROADCAST-PUSH-RUNBOOK.md`. Never handle the bridge values.

### 5.5 Parked by the owner (8 Sep 2026)
- **Language switch (Thai/English UI):** held indefinitely "until everything
  is stable" — do not start it; when the queue above is empty, remind the
  owner it is parked rather than starting it (reminded 8 Sep 2026, after r72:
  still parked). Scope when it restarts: the interface stays English-only
  until then (`AGENTS.md`, 28 Aug 2026); a switch will *select* a language,
  not render both at once, and the old English/Thai pairing markup is not to
  be rebuilt. Thai promotion copy in the F&B data is content, not chrome.
- **The IDUI starter-kit randomizer** (below) comes after every open
  question above is closed, not before.

### Not in this queue: the IDUI starter-kit randomizer
The owner's "randomizer" is a **starter-kit** tool for IDUI — not a Sindhorn
feature — and is deliberately deferred until the Sindhorn app is finished
(owner, 6 Sep 2026). Do not start it, and do not fold it into a Sindhorn
release. It belongs to `idui-core/`, after this app ships.

Do not confuse it with `site/betta-random.js` — the Betta Metal Lab
randomizer, shipped in r29a and reachable at Settings › System ›
Readability Test. **That one is done and working: leave it be** (owner,
6 Sep 2026). Do not refactor it, re-tune it, or fold it into other work.
"The randomizer" in conversation means the starter kit.

## 6. Recent history you should know (newest first)

- **r73** (SW v152, 8 Sep): Today's Rooms section gains the pickup report's pace figures, which the read model has carried since the dashboard shipped and the page had dropped (owner's popup, "Add the pace group"). Between the Room Revenue OTB card and the Benchmarks disclosure sits one more `.app-card.app-surface` - "Pace to Forecast" - with a ruled metric grid: *Left to forecast* (`forecastRemaining.revenue`, note `forecastRemaining.rns` room nights) and *Needed per day* (`forecastRemaining.revenuePerDay`, comparison `historicalRemainingToActualLy.revenuePerDay` "a day last year", the delta coloured by whether last year's pace reaches the need, and a `.app-track` whose bar is last year's pace against the need at the mark - the same reading as every track on the page). The Benchmarks body opens with three `comparisonRow`s against STLY (Revenue, Room Nights, ADR, `referenceLabel: 'STLY'`); the two reference grids below it are unchanged (the STLY revenue tile now repeats the row's reference - shown to the owner as such). Nothing is derived: the per-day figures are the report's own (`otbVsStly` stays unused - its deltas are the same subtraction rounded to the baht). The card renders nothing when the month's forecast is not loaded (the outlook's own test), shows "Forecast already on the books" with no track when the remaining need is at or below zero, and "No last-year pace" with no track when the report has none - `num()` reads a null as 0, so the null is tested on the raw value. No primitive, token or rule changed; the flags' `weight()` still reads `flag.severity` as a number although the read model sends text (`warning`/`watch`), so every flag sorts by its variance - recorded here, not changed. Proof: the brief's fixture at 390 and 1280 (invented numbers) plus the three edge cases; verified live after deploy.
- **History rewrite, 8 Sep 2026 (owner's popup: "Remove and purge history now")**: r60 (`f3c7c63`, 7 Sep) had committed `today-update/(09) September 2026 _FB Daily Report (9).xlsx` and `today-update/BKKSN PickupReport_2026.09.07.pdf` - the hotel's own daily reports - to the public repository, against the ingest runbook's security boundary. Pages never served them (it deploys `site/` only; the paths answer with the shell) and the repo had no forks, stars or watchers. The 23 commits from r60 to r72 were rewritten with `git filter-branch --index-filter` to drop the two paths and nothing else (old tip `38fc4e6` and new tip `1c69f0c` differ by exactly those two files; messages, authors and dates unchanged), main was force-pushed, and `today-update/` is ignored. Every SHA from r60 to r72 changed; the map is `idui-core/evidence/HISTORY-REWRITE-20260908.md` (r72 `38fc4e6`→`1c69f0c`, `fe4b9fb`→`2913d89`, r71 `f5ef676`→`2ad9246`, r70 `e15ddee`→`51111a7`, r69 `d5f211f`→`fe6eeea`, r68 `9cd41f6`→`e0d040f`, r67 `be49332`→`4e6de89`, r66 `897a42e`→`87c3602`, r60 `f3c7c63`→`f0503e0`). The evidence records that cite `897a42e` and `c6a1f14` are left as written - `owner-ratings.json` is hash-pinned by `build-betta.mjs` - and resolve through the map; the claim commit `93971ec` predates the rewrite and is untouched. The old objects stay reachable on GitHub by SHA until GitHub Support is asked to purge them - that request is the owner's (github.com/dechadae/sindhorn-midtown-internal → the "Removing sensitive data" support form), and the 8 Sep pair was never committed.
- **r72** (SW v151, 8 Sep): the owner's three screenshot questions, answered then built. (1) The F&B promotion card had its two hairlines the wrong way round: the progress line that closes its head (status, title, outlets, when) stopped at the content while the actions row's edge spanned the card. `.app-action-card-meta` now reaches under the button's 17px padding and pads its content back (one rule in `app-compositions.css`, the F&B composition, not the library); the actions row's edge stays card-wide by the owner's popup ("Head line card-wide, foot bar stays") - it is the foot bar's edge beneath the press surface, not a divider. Stated in the /ci section note, the CSS comments and IDUI invariant 2. (2) The `/ci` `.app-track` specimen sat in a bare grid since `bfca677`, while every grid on Today that carries a track has been `data-rule="true"` since r63 - not a decision, stale; the specimen is now ruled and its note says so. (3) The `/ci` close specimen (`.app-masthead-account[data-mode="close"]` in an `.app-row`) was the only account chip in the codebase without `.app-control`, so nothing supplied its material and Android painted the UA button face - a grey square since r52; it is now the shell's markup (`app-control`, the shell's 20-viewBox glyph, initials hidden). Recorded, not changed (owner's popup, "leave the duplicate"): the actionable card's head is a second copy of the surface head - `-status` is `.app-surface-label` byte for byte, `-title` is `.app-surface-title` minus `text-wrap:balance`, `-copy` is `.app-surface-copy` at 5px - kept because the card's face is one `<button>` (spans only, no section vocabulary) and collapsing it would move the outlets line 3px. Proof: fixture render HEAD against the tree at 390 and 1280 - on `#fnb` the three progress lines widened by 17px a side and no other box moved, the Artwork label stayed at the content inset, the actions rows unchanged; on `/ci` the track cells close 1px/14px with the last row open, the close specimen has the glass fill, 1px border and the accent glyph at 36x36.
- **r71** (SW v150, 8 Sep): the hairline that closes a card's head runs the card's width. The owner saw two hairlines under a card head - At a Glance stopped its section divider at the padding, the outlet disclosure ran its head hairline to the edge - and chose the whole width for the head alone (popup: "Only under the head", not every divider). One declaration in `app-components.css`: `.app-card-section:first-child+.app-card-section` reaches under the surface padding (`margin-inline:-16px`) and pads its content back (`padding-inline:16px`); the section rule and the r66 seam are untouched. The vocabulary: the first section is the head and its hairline spans the card; every hairline after it - later sections, list rows, ruled metrics - spans the content - stated in the /ci section note and IDUI invariant 2. Proof: every element's box on 19 routes at 390 and 1280, HEAD against the tree, moved nothing on the app routes but the second section of each card. **The brief is hairline-blind:** its pixelmatch threshold of 0.1 does not register a 9%-alpha hairline over the dark ground (the same crops show exactly the widened lines at 0.05), so it flagged only the two doc pages whose note text grew. Decided the same day: the threshold is 0.05 (owner's popup, 8 Sep) - measured on the brief's own shot path, the same tree shot twice differs by zero pixels at every threshold down to 0, and r70 against r71 at 0.05 shows exactly the widened lines (Today 150 px, Jobs 60) and nothing else.
- **r70** (SW v149, 8 Sep): the `app-html.js` helper refactor (§5.2). Four more fragments moved on the r40 evidence — the same markup in two or more modules — `metric`, `disclosure`, `skeletonCard`, `retryRow`; Brand's `DISCLOSURE_CHEVRON` went with the disclosure. Nothing else changed: no CSS, no gate, no document body; twelve routes rendered identical markup from HEAD and the tree, and the brief's pixel diff moved nothing but the version stamps.
- **r69** (SW v148, 8 Sep): the owner's "fix these first" batch from four phone screenshots. (1) A captioned figure is one object: `.app-figure:has(figcaption)` takes the inset well (`--app-inset-fill`, caption `10px 12px` inside it) and joins the glass membership like every other fill, nested drops in `app-glass.css`; an uncaptioned figure stays bare — the `/ci` ground specimen lost its caption so the render smoke's `.app-figure` BARE read still holds, and a `.app-card .app-figure:has(figcaption)` WELL expectation was added. (2) The disclosure head hairline is back for every panel — the r65 `:has(.app-metric-grid[data-rule])` exception is deleted; the owner reads the head as its own group (Today's outlet cards were headless). (3) Two ruled grids side by side keep the 18px row gap (`.app-metric-grid[data-rule]+.app-metric-grid[data-rule]`). (4) F&B card head and detail eyebrow say when — `relative()` in the status slot (LIVE NOW / STARTS IN 5 DAYS / ENDED); `.app-action-card-date` and `statusLabel` deleted, the skeleton head is one line, the smoke's small-text list dropped the class. (5) Audit 17: `.app-utility-action{min-width:24px;justify-content:center}` (Call was 22 wide) and the public card's name is an `h1` (`businessCardMarkup(..., { heading })`, Settings keeps `h2`). Invariant 2 in `docs/idui/idui-body.html` carries the r69 sentence. Verified on the tree with the scratchpad `verify-r69.mjs` (fixtures) and on production after Deploy.
- **r68** (SW v147, 8 Sep): the UI audit fixes. `.app-field input:where(:not([type="range"]))` so `.app-search input` wins by sheet order (the glyph sat on the placeholder from r37 to r66); `data-locked="true"` / `data-run="true"` are valued, admitted attributes (registry 20/64); every navbar and masthead specimen on `/ci` sits in a `.ci-shell-frame` (fixed chrome outside one pins itself to the foot of the page - the render smoke now refuses that); Messages and `/voice` mark Thai `lang="th"`; the Messages dialog has only its head close. `build-idui` reads invariant 7 back from the registry and the Enforcement table back from `deploy.yml` and refuses drift. `ci-library-coverage` excepts `data-run=true` like `data-view=push`. The brief's pixel diff covers the nine signed-in routes from synthetic fixtures, both sides on one origin with service workers blocked (the card's QR encodes `location.origin`). Not fixed, by decision: audit items 15-20 (see the r67 fix-plan artifact in the owner's memory).
- **r67** (SW v146, 8 Sep, another session): the Betta generative test published at `/betta` (`scripts/build-betta.mjs`, `docs/idui/betta-body.html`), footer swapping documents in place (`site/public-doc.js`).
- **r35-r66** (6-7 Sep): Jobs compact cards and two-up layout, fixed navbar (r36), Betta composition sliders and the vignette playground (r37-r38), precache navigations and the 308 rebuild (r39), shell-before-auth (r40), sky mode on the documents, the Origarium transfer at `/origarium` (r4x), ruled seams (r64-r66). Details in the owner's memory index and `git log`.
- **r34a** (SW v116, 6 Sep): IDUI doc metric grids as open strips (`data-rule="true"`, no card). Two follow-ups fixed the font gates: the Typography Gate workflow had its own raw-text search that flagged "Poppins" in doc prose; both gates' `font-family` regex skipped quoted values (a real hole, now closed).
- **r34** (SW v115): `/idui` and `/evidence` as public pages — `scripts/public-doc-page.mjs` shell, `site/public-doc.js` boots Betta in sky mode, share masthead, no footer, `body[data-public="doc"]`. Page audit treats text inside `<code>` as quotation.
- **r33** (SW v114): the rebuild test. Flipgazine's "Moving to Claude Code" rebuilt through its own constitution on the core. Nine core assumptions falsified and moved to constitutions. Results (wins *and* losses) published at `/evidence`; raw run in `idui-core/evidence/rebuild/`.
- **r32** (SW v111): IDUI core extracted, zero `!important`, nine invariants each with a gate.
- **r31** (SW v109): business card = the shell in card mode via `site/_worker.js`. **Never add a `functions/` directory** — it killed the card for a week.
- **r30** (SW v108): sky mode; `/share/fnb` public pages; `sindhorn_app_files` dropped.

Everything before that is in `AGENTS.md` and `docs/`.

## 7. Things that look like bugs and are not

- `next-signin-smoke.mjs` throws "BASE_URL required" locally — it is the post-deploy production smoke.
- `/api/betta-satellite` 404s under a static local server — stub it (`route.fulfill({status:200, body:'{}'})`), as `ci-page-render-smoke.mjs` does.
- Evidence figures are `loading="lazy"`; `img.complete` is false until scrolled near.
- The `shots/*-full-dom.png` under `idui-core/evidence/rebuild/` are gitignored on purpose (~17 MB).
- Three-column `.app-table`s overflow at 390 by library design (`thead th` is nowrap); the audit allows overflow ≤ 1 element.
- Launch Hardening fails with "CI service-employee sign-in did not reach the app · Sign-in didn't complete" and a console 403 in the same minute the Deploy run's `next-signin-smoke` passed (r68, 8 Sep): both workflows sign in with the one CI account, the second `sindhorn_pin_login` replaces the first's token hash and the loser's `/auth/v1/verify` is refused. Nothing in the release is wrong. Since 8 Sep the Launch Hardening step waits for the Deploy run of the same SHA to conclude before it signs in (`gh run list --workflow deploy.yml --commit $GITHUB_SHA`, `actions: read`); if it ever shows again, `gh run rerun <id> --failed` once Deploy has finished. It showed again on r71 (8 Sep) in the third consumer: the Typography Gate's browser smoke signed in inside Deploy's sign-in window and its own `/auth/v1/logout` came back 403 - the re-run passed once the other runs had finished. Since 8 Sep (owner's popup) that step waits for the Deploy *and* Launch Hardening runs of its commit before signing in (`actions: read`, 120×10s cap, job timeout 40 min), so the three consumers of the one account sign in one after another.
