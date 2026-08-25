# AGENTS.md

## Project identity

This repository is the canonical core-shell / engine source for the Sindhorn Midtown internal environmental PWA.

- Repository: `dechadae/sindhorn-midtown-internal`
- Cloudflare Pages project: `sindhorn-midtown-internal`
- Production origin: `https://sindhorn-midtown-internal.pages.dev`
- Shared Supabase project: `sjpvhgxacsiorrtijqua`
- Dedicated presentation table: `public.sindhorn_app_files`
- Canonical architecture: `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
- Latest language-order override: `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md`

Before consequential work, read this file and the final architecture plan. The language-order override is a later approved product decision and supersedes any older Thai-first clauses in the final plan or specialist documents.

## Current release state

Production remains the v14 monolithic PWA until PR #9 / `hybrid-shell-v15` is fully QA'd, merged and deployed.

The approved v15 target is:

- Cloudflare/GitHub = stable installed shell and executable engines.
- Supabase `public.sindhorn_app_files` = versioned presentation/configuration pack.
- AirBKK = authoritative PM2.5 / Thai AQI.
- Open-Meteo = realtime weather.
- Bangkok sun/moon = local astronomy.
- Cloudflare Worker + D1/KV = future Web Push backend.

Do not use Flipgazine `public.site_files` as Sindhorn's canonical application source.

## Final bilingual rule — English first everywhere

This is the current highest language rule:

> **The app is fully bilingual, with English first throughout the entire experience and Thai immediately supporting it.**

This applies to every visible or announced app surface, including:

- brand/editorial copy;
- headings and labels;
- navigation and buttons;
- live status and weather;
- health guidance and actionable instructions;
- warnings, errors and recovery states;
- permissions and operational instructions;
- safety/medical disclaimers;
- pull-to-refresh;
- Save/Share feedback;
- Web Push notification titles and bodies.

English must precede Thai in DOM/read order where both are presented. Thai remains clearly readable and must not be reduced to tiny decorative caption text. No language selector is required for critical comprehension.

Typography remains:

- English / Latin = **Vignette Sans**.
- Thai = **Noto Sans Thai**.
- Official Sindhorn Midtown / Vignette lockup = artwork.

The earlier Thai-first exception for safety/actionable copy is retired.

## Persistent hybrid architecture

GitHub / Cloudflare owns relatively stable executable infrastructure:

- thin bootstrap `index.html`;
- manifest/service worker/PWA identity;
- official assets/fonts/icons;
- Three.js dependency;
- persistent WebGL renderer;
- astronomy engine;
- History API router/bootstrap;
- Supabase UI-pack loader;
- pull-to-refresh gesture engine;
- full-page capture engine;
- offline/recovery shell;
- Web Push receiver.

Supabase owns frequently edited presentation/configuration:

- Today / Guidance / Details markup;
- header/footer presentation;
- UI/component CSS;
- typography/layout/copy;
- spacing/glass/buttons;
- route-transition configuration;
- environment art-direction parameters.

The WebGL canvas, weather/AirBKK/astronomy state, device tilt, header host and footer host stay alive while route fragments change.

## Atomic UI-pack rules

UI packs are versioned and atomic.

- Fetch manifest.
- Fetch all declared resources.
- Validate presence, content type, schema and SHA-256.
- Cache a complete known-good pack.
- Promote only after full validation.
- If anything fails, keep the previous known-good pack.
- Never expose a mixed old/new pack.
- Bundled fallback pack must allow first boot/offline recovery.

## Realtime environment authority

Required order:

```text
REAL WEATHER
→ SKY
→ CLOUDS
→ SUN / MOON
→ RAIN / STORM / FOG
→ PM2.5 OPTICAL HAZE / PARTICLES
→ HTML UI
```

Weather and PM2.5 remain independent. Overcast must visibly look overcast. Clear weather plus hazardous PM2.5 still retains the physical sun through pollution haze.

The v15 renderer is Oscar-inspired conceptually but remains our own Three.js/GLSL engine. Art-direction parameters may be Supabase-configurable; executable shader/renderer code stays in GitHub/Cloudflare.

## Rendering / mobile rules

Mobile must visually match desktop.

Do not lower mobile DPR, cloud complexity, frame cadence, celestial quality or tilt. Improve performance by removing waste:

- no full-page CSS blur transitions;
- no giant filtered DOM layers;
- minimize nested backdrop filters;
- use opacity/translate3d/tiny scale only for routes;
- keep only active route DOM mounted;
- stop WebGL only when the document is hidden.

With HTML hidden, the atmosphere must be one uninterrupted sky with no square/rectangular tonal boundary.

## Tilt

- Android/device-orientation capable browsers: attach continuously.
- iOS/iPadOS: request DeviceOrientation permission from the first valid user gesture.
- Once approved, keep it active.
- Tilt clouds/celestial/haze subtly, never HTML UI.

## Pull-to-refresh

Installed iOS and Android PWAs must support pull-to-refresh at scroll top.

- Same glass material family as header/footer.
- Pull → Release → Refreshing.
- Refresh AirBKK, Open-Meteo and UI pack in place.
- Never reload/destroy the persistent shell for normal refresh.

## Save full page

`SAVE FULL PAGE / บันทึกทั้งหน้า` captures the full Today route with current atmosphere while excluding:

- masthead/header;
- sticky footer/navigation;
- reference footer;
- Save button itself.

This is browser capture, never image generation.

## Zero-reinstall rule

After employee rollout, normal releases must never require uninstall/reinstall.

Freeze production origin, manifest id/scope/start_url, service-worker scope and app identity before broad installation. Routine Supabase pack changes hot-update. Rare shell changes use the normal service-worker lifecycle while preserving installation, push permission/subscription, preferences and cached known-good pack.

## Notifications

Target:

Cloudflare scheduled Worker → AirBKK/Open-Meteo → meaningful threshold/category-change policy → Web Push → installed iOS/Android PWA.

Store subscriptions in Cloudflare D1 or KV, use VAPID, and do not use Supabase as notification storage unless explicitly approved later.

Notification titles/bodies are English first, Thai second.

## Deployment discipline

Production deploys from `main`. Avoid tiny production commits.

For the v15 migration:

1. work on `hybrid-shell-v15`;
2. seed and validate Supabase Pack 1;
3. run structural/syntax/offline/environment QA;
4. keep PR #9 draft until QA passes;
5. merge once;
6. deploy production once;
7. verify the actual production origin before claiming live.

After migration, normal visual/content/art-direction edits should be Supabase-only.

## Documentation authority

Use this order:

1. `AGENTS.md`
2. `docs/LANGUAGE-ORDER-OVERRIDE-20260825.md` for language-order conflicts
3. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`
4. specialist docs where they do not conflict

Update canonical documentation when the live architecture materially changes.
