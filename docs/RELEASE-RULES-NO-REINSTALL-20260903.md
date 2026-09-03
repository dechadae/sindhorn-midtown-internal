# Release rules — employees must never reinstall the app

Status: active from 3 September 2026. Applies to every release after launch.

## Why this document exists

A PWA is reinstalled for exactly two reasons: its **identity** changes, or its
**service worker stops being able to install**. Everything else — new routes,
new CSS, new modules, a new Supabase pack — reaches an installed app through a
normal service-worker update and requires nothing from the employee.

## Rule 1 — identity is frozen

`site/manifest.webmanifest` must keep:

    id          "/"
    start_url   "/"
    scope       "/"
    display     "standalone"

Changing any of these orphans every installed copy: the browser treats it as a
different app, and employees keep the old one until they delete it by hand.

Already asserted by `deploy.yml`, `launch-hardening.yml` and
`fnb-share-preview.yml`. Do not weaken those assertions.

## Rule 2 — the service worker registers at one path and scope

`navigator.serviceWorker.register('/sw.js',{scope:'/'})` in all call sites
(`app.js`, `push-client.js`, `pwa-version-guard.js`). A different path or scope
strands the existing registration.

## Rule 3 — an install must not be all-or-nothing

Before v49, `precacheShell()` threw on any bad response across all SHELL
entries, so one flaky fetch failed the install, the new worker never activated,
and the client stayed on the old build permanently — every later update failing
the same way. Verified: blocking a single optional font was enough.

Only `CRITICAL_SHELL` may be fatal. It is capped at 16 entries by
`scripts/shell-precache-parity-smoke.mjs`, and `scripts/sw-install-resilience-smoke.mjs`
proves both halves of the contract on every preview: optional failures still
install, a critical failure still fails.

Adding to `CRITICAL_SHELL` makes updates more fragile. Treat it as a last resort.

## Rule 4 — every shell asset is precached, and every precached path exists

A `SHELL` entry that 404s makes `precacheShell()` throw and the worker fail to
install. `scripts/shell-precache-parity-smoke.mjs` asserts both directions and
runs before the browser suites.

## Rule 5 — bump `VERSION` on any shell change

A new `VERSION` is what triggers the update. The preview workflow pins the exact
string, so bumping it means updating that assertion in the same commit — this
has broken the build twice, both times because the pin was left behind.

## Rule 6 — Supabase carries data, never shell

`site/next.html` is the first page of the from-scratch rebuild (approved
3 September 2026, public/unauthenticated, built only on the UI Library:
`fonts.css`, `app-tokens.css`, `app-glass.css`, `app-components.css`,
`app-shell.css`). It fetches nothing from Supabase, and no future page may
change that boundary:

- **Shell** — markup, CSS, JS. Lives in this repo, deploys to Cloudflare
  Pages, is precached by `sw.js`, and is versioned by bumping `VERSION`
  (Rule 5). This is what "ship freely" below refers to.
- **Data** — whatever a page displays: today's numbers, F&B posts, brand
  metadata. Fetched at runtime as JSON (`fetch`/RPC) into a shell that is
  already fully painted. Never HTML, never CSS.

The current production app violates this: `header.html`, `today.html`,
`footer.html` and `ui.css` are markup and CSS fetched from a Supabase
table (`public.sindhorn_app_files`) at boot. Shell material shipped as
data cannot be precached, so first launch depends on a network round
trip, and the shell and that pack can disagree — the documented cause of
the "solid purple bar" failure. Do not reproduce this in the rebuild.

A Supabase pack of actual *data* (rows, JSON) is exactly what "ship freely"
below means and carries no reinstall risk. A Supabase pack of *markup or
CSS* is the thing Rule 6 exists to rule out — it is not the identity risk
Rules 1-5 guard against, but it reintroduces the fragility this whole
document was written after.

## What is safe

Routes, components, stylesheets, JS modules, Supabase **data** packs, Betta
changes, push payloads. None touch identity or registration. Ship them
freely — provided the data pack stays data (Rule 6).
