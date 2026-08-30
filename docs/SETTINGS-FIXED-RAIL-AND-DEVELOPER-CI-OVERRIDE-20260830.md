# Sindhorn Midtown Internal — Settings Fixed Rail + Developer UI Library Override

**Status:** Approved product override  
**Date:** 30 August 2026

This document supersedes the earlier rule in `docs/SETTINGS-ADMIN-SUPABASE-CAPABILITY-ARCHITECTURE-20260829.md` that ordinary employees should not see empty privileged Settings tabs.

## 1. Settings navigation is fixed

The Settings secondary navigation is always:

`Account / People / Comms / System`

in that order, for every authenticated employee.

Capabilities may change the content available inside a section, but they must not change the four-tab geometry, order, labels, or presence.

An employee without permission for a section may open it. The section renders no privileged content. Do not show fake controls, placeholder admin data, or an "Access denied" card merely to fill the page.

The persistent shell footer remains:

`Today / F&B / Messages / Brand`

The Settings secondary rail is the existing approved shell-owned contextual footer. Route-owned Settings navigation remains a non-painted controller cloned into `#app-footer` by `site/footer-route-guard.js`.

## 2. Developer UI Library

The internal living CI / UX library is an authenticated in-shell route:

`/ci`

It is not part of the global footer and is not a fifth Settings tab.

Its visible entry point is:

`Settings -> System -> UI Library`

The UI Library entry is shown only when the effective capability set contains:

`developer.ui_library`

Initial policy grants that capability to `account_type = developer` only.

`system.manage`, `super_admin`, or another privileged role does not by itself imply UI Library access unless the effective capability resolver returns `developer.ui_library`.

## 3. Authorization is double-gated

Hiding the System card is not authorization.

The `/ci` mount must independently load the current Settings authority and verify `developer.ui_library` before rendering CI content.

If a user without that capability manually navigates to `/ci`, the app returns them to `/settings?section=system` in the same persistent shell and renders the empty System section.

## 4. CI page is a living implementation authority

The CI page must consume production classes, tokens, components and interaction owners wherever those exist. It must not recreate visual approximations solely for documentation.

Examples:

- route hero -> `site/route-hero-standard.css`
- back / quiet actions -> `site/app-controls.css`
- F&B cards / selector -> F&B production styles
- Settings fields / dialog -> Settings production styles and dialog controller
- Factsheet disclosure / table -> Factsheet production styles
- persistent navigation -> actual shell footer remains visible as the live specimen

Documentation-only CSS may style the manual layout, code panels, labels and specimen containers, but it must not silently become a second implementation of app components.

## 5. New-page rule

Every new authenticated page must use the persistent single-shell router and should start from the UI Library new-page blueprint.

The semantic hero API for new routes is:

- `.app-route-hero`
- `.app-route-eyebrow`
- `.app-route-title`
- `.app-route-copy`

These are aliases of the approved F&B-derived hero authority. Existing route-specific selectors remain compatibility aliases until migrated.

A developer building a new page should consult `/ci` for component ownership before copying or creating UI.

## 6. Drift prevention

The UI Library is paired with deterministic and browser-level CI checks.

At minimum the gate verifies:

- `/ci` is an authenticated SPA route, not a standalone HTML document;
- normal employee direct `/ci` access does not render the library;
- developer System view exposes the UI Library card;
- Settings footer remains exactly Account / People / Comms / System for both identities;
- main footer remains Today / F&B / Messages / Brand;
- header/footer/atmosphere nodes survive Settings -> CI -> Settings navigation;
- LINE Seed Sans TH remains the active UI font;
- tracking remains zero;
- canonical hero, back-control geometry, route transition and no-route-overlay checks pass;
- 360px, 390px and 768px layouts have no horizontal document overflow;
- reduced-motion behavior remains understandable.

## 7. Ownership boundary

Supabase owns effective capabilities and authorization policy.

GitHub / Cloudflare Pages owns the reusable Settings/CI renderer, persistent shell, component implementations, registry metadata and automated browser validation.

Routine changes to which employee/account type receives `developer.ui_library` should be possible in Supabase without a Cloudflare deployment. Renderer or component changes still use the normal branch -> preview -> validation -> PR -> merge -> production verification release path.
