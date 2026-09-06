# Handoff — Sindhorn Midtown Internal

Written 6 September 2026 after r34a (SW v116) for whichever session continues
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
- Do not modify or deploy the Flipgazine repo or its `site_files`. Flipgazine's anon JWT may be used only to read `site_files` the way the shell does; any Flipgazine source committed here has the key redacted (`FG_ANON_KEY_REDACTED`, four sites under `idui-core/evidence/rebuild/`).

## 4. How to ship a release

```sh
# 1. edit core first, then mirror
cp idui-core/app-components.css site/app-components.css   # etc.

# 2. bump site/sw.js VERSION, rebuild the docs
node scripts/build-idui.mjs && node scripts/build-evidence.mjs

# 3. local gates (all must pass; run before any push touching shared UI)
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
git push origin land-baseline:main
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

### 5.1 Jobs tracker — compact cards, expand, drag (owner's request; report first)

Asked for: job cards compact by default with the job info hidden; an expand
arrow at the top right of the card; cards drag-rearrangeable "same as in
Flipgazine".

What is already true:
- The card is `cardMarkup()` in `site/jobs-page.js` — `.app-card.app-surface` with three `.app-card-section`s (ask / facts / actions). The job card invariant (`AGENTS.md`, r23/r23c/r28) says a job is *not* a component; keep it an assembly of primitives.
- The library already has a disclosure primitive: `.app-disclosure`, `.app-disclosure-button`, `.app-disclosure-head` (`site/app-components.css:127`), specimen at `site/ci.html:237` ("tap to expand"). The expand arrow should be that, not a new thing. Four modules bind `[data-disclosure]` with their own copy of the toggle (`brand-page.js`, `fnb-page.js`, `today.js`, `signin-page.js`; `ci-library.js` has the fifth) — the IDUI doc counts this as "disclosure toggle ×3", the only behavior duplication left in the shell. Folding them into one module as you add the Jobs use is the right move; recount and correct that number in `docs/idui/idui-body.html` in the same release.
- **The server side of drag is already built and unused.** `supabase/migrations/20260905120000_sindhorn_jobs_v1.sql` gives `sindhorn_jobs` a `sort_order integer not null default 0`, indexes `(owner_employee_id, sort_order, created_at desc)`, orders `sindhorn_jobs_list_v1` by it, exposes it as `sortOrder` in `job_json`, and defines **`sindhorn_jobs_reorder_v1(p_ids uuid[])`** which rewrites the order from an array of ids. `site/jobs-page.js` never calls it. So rearrange needs **no schema change, no new RPC, no live write to approve** — only the client behavior plus one `supabaseRpc('sindhorn_jobs_reorder_v1', { p_ids })` after a drop. (A new job is inserted at `min(sort_order) - 1`, i.e. the top.)
- "Same as in Flipgazine": read Flipgazine's job board drag behavior from its `site_files` (read only, the way the shell reads it — the rebuild test's `snapshot` step shows how) to match the interaction: long-press or handle, what moves, what the drop looks like. Do not copy code with the key in it.
- Before building, show the owner a 390-wide mockup of: collapsed card (what stays visible — title, status badge, deadline?), expanded card, the arrow position, and the drag affordance. Wait for the go.

### 5.2 Today cache / `app-html.js` refactor
Agreed, unscheduled, no visual change. Reads: `site/today.js`, `site/shell.js`. Goal is one HTML-fragment helper instead of per-page string building. Pixel-diff `/` before and after (the scratchpad `visual-diff.mjs` pattern: render HEAD's `site/` and the working tree's on two local servers, compare screenshots per route).

### 5.3 Inbox-run scope
Open question *to* the owner: what should an "inbox run" cover now that every run also inserts into `sindhorn_jobs` (since 5 Sep, source `inbox-run`, Decha's row)? The spec is Flipgazine's `.claude/jobscan.md`, not `AGENTS.md`.

### 5.4 Broadcast push provisioning
On the owner. Runbook: `docs/BROADCAST-PUSH-RUNBOOK.md`. Never handle the bridge values.

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
