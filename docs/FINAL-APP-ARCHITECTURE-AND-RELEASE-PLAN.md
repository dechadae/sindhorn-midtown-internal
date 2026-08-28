# Sindhorn Midtown Internal — Final App Architecture and Release Plan

**Status:** Canonical implementation plan  
**Date:** 25 August 2026  
**Repository:** `dechadae/sindhorn-midtown-internal`  
**Current production origin:** `https://sindhorn-midtown-internal.pages.dev`  
**Shared Supabase project:** `sjpvhgxacsiorrtijqua`

This document is the final implementation authority for the Sindhorn Midtown internal environmental app. It consolidates and supersedes any conflicting architectural or visual rules in older planning documents. Older documents remain useful as history and specialist detail, but when they conflict with this file, **this file wins**.

---

## 1. Final product definition

Sindhorn Midtown Internal is a premium, installable environmental PWA for hotel employees. It combines:

1. live AirBKK PM2.5 / Thai AQI;
2. live weather from Open-Meteo;
3. Bangkok time, sun and moon astronomy;
4. a continuously animated Three.js/WebGL environmental atmosphere;
5. bilingual English/Thai operational information;
6. App Store-quality navigation and interaction;
7. cross-platform Web Push notifications for meaningful environmental changes;
8. zero-reinstall updates after launch.

The app must feel closer to a native iOS Weather-style environmental application than a generic dashboard.

The page content and controls are HTML. WebGL is the persistent environmental surface behind them.

---

## 2. Final architecture decision: persistent Cloudflare shell + Supabase UI pack

The current GitHub-only static PWA workflow is too slow for frequent design iteration because every `site/**` change triggers GitHub Actions and a Cloudflare Pages deployment.

The final architecture therefore adopts the useful part of Flipgazine's bootstrap-shell model without making Sindhorn Midtown part of Flipgazine itself.

### 2.1 Cloudflare / GitHub owns the stable installed engine

The Cloudflare Pages application remains the installed PWA and owns only relatively stable executable infrastructure:

- thin bootstrap `index.html`;
- PWA manifest;
- service worker;
- install icons;
- official brand/font assets;
- Three.js dependency;
- persistent WebGL renderer engine;
- astronomy engine;
- SPA/bootstrap router;
- remote UI-pack loader;
- pull-to-refresh gesture engine;
- full-page capture engine;
- offline/recovery shell;
- Web Push receiver;
- shell-to-UI compatibility validation.

The WebGL canvas, app header host, route host and footer host are persistent DOM layers. They are created once and do not restart during Today → Guidance → Details navigation.

Conceptually:

```text
Cloudflare Pages / installed PWA

<header id="app-header"></header>
<canvas id="environment"></canvas>   ← persistent
<main id="route-view"></main>         ← Supabase route content mounts here
<footer id="app-footer"></footer>
```

### 2.2 Supabase owns frequently edited presentation/content

Create a Sindhorn-specific remote application namespace, preferably a dedicated table such as:

`public.sindhorn_app_files`

Do **not** reuse Flipgazine's page namespace as the canonical Sindhorn application source.

Supabase should own frequent UI/content changes such as:

- Today route markup;
- Guidance route markup;
- Details route markup;
- header markup/configuration;
- footer/navigation markup/configuration;
- UI CSS;
- component CSS;
- typography rules;
- bilingual copy;
- spacing and hierarchy;
- button styling;
- glass opacity and border recipes;
- route-transition configuration;
- weather visual/art-direction parameters;
- PM2.5 optical parameters;
- cloud visibility/contrast parameters;
- moon/sun presentation parameters;
- tilt/parallax parameters;
- non-secret application configuration.

Routine visual edits should therefore become:

```text
edit Supabase
→ save
→ refresh/open app
→ inspect
```

instead of:

```text
edit GitHub
→ commit
→ GitHub Actions
→ Wrangler
→ Cloudflare Pages
→ service-worker update
→ inspect
```

### 2.3 What must not move to Supabase

Keep core executable platform code on Cloudflare/GitHub:

- service worker;
- manifest and PWA identity;
- WebGL/Three.js engine implementation;
- bootstrap loader;
- router engine;
- secure push-receiving code;
- offline/recovery engine.

The renderer **configuration** may live in Supabase; the renderer **engine** stays in GitHub/Cloudflare.

This provides rapid art-direction changes without making offline boot, CSP/security, versioning and recovery dependent on remotely executed arbitrary code.

---

## 3. Source-of-truth map

After migration, canonical ownership is:

| Concern | Canonical source |
|---|---|
| PWA identity / manifest / service worker | GitHub / Cloudflare shell |
| WebGL renderer engine | GitHub / Cloudflare shell |
| Astronomy engine | GitHub / Cloudflare shell |
| SPA/bootstrap loader | GitHub / Cloudflare shell |
| Pull-to-refresh gesture engine | GitHub / Cloudflare shell |
| Push notification receiver | GitHub / Cloudflare shell |
| Brand assets / fonts | GitHub / Cloudflare shell |
| Today / Guidance / Details UI | Supabase Sindhorn app namespace |
| Header/footer presentation | Supabase Sindhorn app namespace |
| Buttons / typography / spacing / component CSS | Supabase Sindhorn app namespace |
| Atmosphere art-direction parameters | Supabase Sindhorn app namespace |
| PM2.5 / AQI | AirBKK direct live source |
| Weather | Open-Meteo direct live source |
| Sun/moon position | local astronomy calculation |
| Push subscription backend | Cloudflare Worker + D1/KV |

Supabase is an application presentation/configuration layer, **not** the live environmental database.

---

## 4. Persistent continuity requirement

The atmosphere must feel continuous throughout the app.

The following layers remain alive while routes change:

- WebGL canvas;
- weather state;
- PM2.5/AQI state;
- sun/moon state;
- device orientation/tilt state;
- header host;
- bottom navigation/footer host;
- service-worker/PWA session.

Only the active route fragment inside `#route-view` changes.

Route navigation must not:

- reload the document;
- recreate Three.js;
- flash the atmosphere;
- restart cloud animation;
- reset sun/moon position;
- re-request permissions;
- drop push subscription state.

---

## 5. Route model

Keep three app routes:

- `/` — Today / live report + realtime weather + full-page save action;
- `/guidance` — practical current-condition guidance + Thailand AQI scale;
- `/details` — monitoring point, data period, sources, refresh/share, methodology and disclaimers.

The router uses History API navigation with persistent shell state.

The route fragments are fetched/cached as one validated Supabase UI pack. Do not keep all three large pages mounted and merely hidden if it increases layout/paint cost.

---

## 6. Visual design authority

The app adopts **Flipgazine CI interaction/component grammar** while remaining unmistakably Sindhorn Midtown / Vignette.

### 6.1 Brand colors

Primary Sindhorn palette:

- Twilight base: `#2E273B`;
- warm off-white: `#FAF7F5`;
- Sorbet accent: `#E5ECBE`;
- supporting translucent Twilight surfaces and hairlines derived from those colors.

Do not import Flipgazine's blue identity as the Sindhorn brand color.

### 6.2 Typography authority — LINE Seed Sans TH

**28 August 2026 override:** `LINE Seed Sans TH` is the one and only production family for both English/Latin and Thai. This supersedes the earlier Vignette Sans / Noto Sans Thai split-family decision.

Production ships only real weights 100, 400 and 700. Weight 100 is reserved primarily for very large premium atmospheric/display typography; ordinary mobile UI and body copy use 400; emphasis uses 700. No synthetic intermediate weights.

Every text treatment uses `letter-spacing: 0` with no exceptions, including uppercase English labels. The font is self-hosted from the Cloudflare/GitHub shell; no runtime external font service is permitted. The official Sindhorn Midtown / Vignette lockup remains image artwork and is never re-typeset.

### 6.3 Thai comprehension rule

Thai must remain clearly readable and never become tiny caption text.

Thai appears first in reading order when comprehension/action/safety is more important than aesthetics:

- health guidance;
- actionable instructions;
- warnings;
- errors and recovery;
- permissions;
- operational instructions;
- safety/medical disclaimers.

English immediately supports those instructions.

Navigation, branding, display labels, status labels and ordinary utility UI remain English-first visually.

Critical information must never require a language selector.

### 6.4 Header

Persistent header inspired by Flipgazine CI:

- official Sindhorn Midtown / Vignette lockup;
- current date;
- fullscreen utility;
- restrained translucent/frosted surface;
- fine 1px structural line;
- optional reading/progress rule if still useful;
- stable safe-area behavior in installed/fullscreen modes.

The approved logo reduction remains approximately 10% below the earlier oversized version.

### 6.5 Footer / bottom navigation

Use the **Flipgazine Voice-page footer grammar**, adapted to Sindhorn colors:

- edge-to-edge sticky/fixed rail rather than a giant floating rounded dock;
- one parent frosted-glass layer;
- compact independent Today / Guidance / Details navigation chips;
- English first, Thai visible;
- selected state uses restrained Sorbet emphasis;
- safe-area-aware bottom padding;
- no redundant nested backdrop-filter stacks.

### 6.6 Buttons

- premium restrained glass/pill grammar;
- 1px borders;
- Sindhorn accent tint;
- tactile `scale(.98–.985)` press response;
- no heavy shadows;
- no opaque dashboard-style boxes unless required for legibility.

### 6.7 Pull-to-refresh

Pull-to-refresh must work from the top of every route on installed iOS and Android PWAs.

The pull indicator must use **the same glass material tokens as header/footer**:

- same base opacity;
- same border opacity;
- same blur/saturation family;
- no visually solid pill.

Gesture rules:

- activate only at scroll position 0;
- ignore horizontal gestures;
- show Pull → Release → Refreshing states;
- refresh the current route and live environmental sources;
- preserve app installation and route identity.

---

## 7. Realtime environment architecture

The environment is not an AQI mood animation. It is a realtime simulation driven by independent physical inputs.

### 7.1 Required evaluation order

The visual pipeline is:

```text
REAL WEATHER
    ↓
SKY
    ↓
CLOUDS
    ↓
SUN / MOON
    ↓
RAIN / STORM / FOG
    ↓
PM2.5 OPTICAL HAZE + PARTICLES
    ↓
HTML UI
```

**Weather is established first. PM2.5 is applied afterward.**

### 7.2 Bangkok astronomy

Use Sindhorn Midtown's Bangkok coordinates and realtime local date/time to calculate:

- solar altitude;
- solar azimuth;
- day/twilight/night;
- lunar altitude/azimuth;
- approximate lunar phase/illumination.

Pollution never changes physical sun/moon position.

### 7.3 Weather

Open-Meteo supplies the weather state used by the environment:

- weather code;
- cloud cover;
- precipitation / rain / showers;
- humidity;
- wind speed;
- wind direction;
- gusts where useful;
- visibility;
- temperature;
- apparent temperature;
- day/night observation state.

Weather-code state must visibly agree with rendering.

Acceptance examples:

- Clear → genuinely clear sky, unless pollution reduces clarity.
- Partly cloudy → identifiable moving cloud masses with open sky between.
- Overcast → visually connected dense cloud deck; it must never look clear.
- Rain → clouds plus visible precipitation appropriate to intensity.
- Thunderstorm → dark dense cloud state and restrained distant illumination, not game-like lightning.
- Fog → low-contrast atmospheric veil distinct from PM2.5 pollution.

### 7.4 Cloud system

Clouds must be an explicit visible rendering layer rather than barely perceptible FBM haze.

Use multiple soft procedural depth layers:

- broad low-frequency cloud bodies;
- middle-scale shape variation;
- fine edge structure;
- different motion rates for depth;
- wind direction controls drift;
- cloud cover controls occupied sky area;
- sun/moon can illuminate cloud edges;
- night clouds retain enough luminance contrast to remain visible.

Overcast should produce broad connected cloud structures, not isolated fluffy sprites.

### 7.5 PM2.5 optics

AirBKK remains authoritative for PM2.5 / Thai AQI.

PM2.5 affects atmospheric optics after weather is rendered:

- extinction/haze;
- Mie-like sun/moon diffusion;
- loss of blue saturation;
- reduced horizon visibility;
- reduced distant contrast;
- pollution tint;
- suspended particulate.

Example:

**Noon + clear weather + hazardous PM2.5** still has the real high sun, but the sky becomes washed grey/beige with a diffused sun and reduced visibility.

### 7.6 Moon and sun quality

- no pixelated sprite treatment;
- high-precision anti-aliased edges;
- atmospheric halo responds to pollution/humidity;
- cloud layer may occlude/diffuse celestial objects;
- clear sky yields crisper presentation;
- overcast can mostly obscure moon/sun.

### 7.7 No blocky renderer boundaries

With HTML hidden, the environment must appear as **one uninterrupted sky**.

QA must explicitly inspect:

- canvas dimensions vs viewport;
- CSS transforms;
- shader aspect ratio;
- large-scale noise tiling;
- screen-coordinate gradients;
- fixed-layer compositing;
- interactions with translucent UI surfaces.

No rectangular/square WebGL region or tonal panel boundary may be visible.

---

## 8. Mobile rendering rule: no quality downgrade

The user explicitly requires mobile to look like desktop.

Do **not** improve mobile performance by:

- lowering renderer DPR relative to desktop;
- reducing cloud complexity only on mobile;
- reducing visible animation cadence;
- lowering sun/moon quality;
- disabling tilt;
- disabling atmospheric motion because of `prefers-reduced-motion`.

Performance must instead come from removing waste:

- no full-page CSS blur animations;
- no giant filtered DOM layers over WebGL;
- no unnecessary nested backdrop filters;
- no duplicate large raster layers;
- no expensive DOM animation that contributes little visually;
- keep WebGL active only while the document is visible.

The quality target should remain equivalent on mobile and desktop.

---

## 9. Route transition rule

The current full-main `filter: blur(...)` transition is prohibited because it can force expensive full-page rasterization while WebGL is rendering.

Final route transitions use only GPU-cheap properties:

```text
opacity
transform: translate3d(...)
very small scale change if useful
```

No full-page CSS `filter: blur()`.

Target feel:

- approximately 260–340 ms;
- luxurious ease such as `cubic-bezier(.22,1,.36,1)`;
- atmosphere/header/footer remain persistent;
- route content swaps smoothly without restarting live environmental state.

---

## 10. Mobile tilt

Tilt is part of the default environmental experience.

- Android/device-orientation-capable browsers: attach continuously when available.
- iOS/iPadOS: request DeviceOrientation permission from the first valid user gesture because the OS requires a user gesture.
- Once granted, keep tilt active.

Tilt may subtly affect:

- cloud depth/parallax;
- celestial parallax;
- haze/particulate drift.

Do not tilt the HTML UI itself.

---

## 11. Full-page save behavior

The old compact square image concept is retired.

The Save action means:

**SAVE FULL PAGE / บันทึกทั้งหน้า**

It captures the full length of the Today route with the live/current atmosphere rendered at suitable capture resolution.

Exclude:

- masthead/header;
- sticky bottom navigation/footer;
- reference footer if present;
- the Save button itself.

Include:

- live PM2.5 / AQI;
- current status and guidance;
- current weather;
- source/data details that belong on Today;
- full atmospheric rendering corresponding to the current environmental state.

This is browser/web-app capture, not generative image creation.

---

## 12. Live data rules

### 12.1 Air quality

AirBKK remains authoritative for PM2.5 / Thai AQI.

- Preserve validated station-selection and fallback behavior.
- Preserve cache/offline behavior.
- Preserve observation freshness states.
- Never interpolate through fabricated numeric readings.

When a new genuine reading arrives:

```text
old number → direct crossfade → new number
```

The atmosphere may interpolate visually over a few seconds.

### 12.2 Weather

Open-Meteo remains the current weather source.

- Cache last valid weather for resilience.
- If weather cannot be fetched but a valid cached state exists, continue using it with appropriate freshness handling.
- If no weather state exists, fall back to astronomy + PM2.5 atmosphere without inventing rain/cloud/storm conditions.

### 12.3 Day/night independence

There is no manual UI theme controlling the environment.

Physical day/night is based on Bangkok astronomy even if UI chrome is dark.

---

## 13. UI-pack versioning and atomic updates

The Supabase presentation layer must be versioned as an atomic application pack.

Recommended manifest shape:

```json
{
  "appPack": 42,
  "minimumShell": 1,
  "environmentConfig": 18,
  "updatedAt": "2026-08-25T21:57:00+07:00"
}
```

A pack can reference validated resources such as:

- `header.html`;
- `today.html`;
- `guidance.html`;
- `details.html`;
- `footer.html`;
- `ui.css`;
- `components.css`;
- `environment-config.json`.

Update process:

1. shell checks latest pack manifest;
2. fetches all resources for that pack;
3. validates presence/type/hash/schema;
4. writes them to local Cache API / IndexedDB as one known-good pack;
5. only then promotes the new pack;
6. if anything fails, continue using previous known-good pack.

Never expose users to a half-updated combination of old CSS + new HTML.

---

## 14. Zero-reinstall update policy

This is a launch-level non-negotiable requirement:

> **After employees begin installing the production app, normal Sindhorn Midtown releases must never require them to uninstall and reinstall the PWA.**

### 14.1 Freeze the installed-app identity before launch

Before hotel-wide installation, finalize and freeze:

- production origin;
- manifest `id`;
- manifest `scope`;
- `start_url`;
- service-worker scope;
- app identity/name/icon contract.

Current origin is:

`https://sindhorn-midtown-internal.pages.dev`

If an official custom domain will be used long-term, decide and migrate **before** broad installation. Moving to another origin after rollout is not a normal update and may create a separate installed web app and separate push subscription context.

### 14.2 Routine Supabase updates

UI/content/configuration changes require no reinstall and normally no shell deployment.

The installed shell fetches/promotes the latest validated UI pack.

### 14.3 Core shell updates

Rare service-worker/router/WebGL/bootstrap updates use the normal service-worker lifecycle:

```text
old installed shell
→ browser discovers new service worker
→ new core downloads/validates
→ activate/claim
→ existing installed app continues
```

No uninstall.

### 14.4 Preserve user state

Normal releases must preserve:

- installed app;
- push permission;
- push subscription;
- local preferences;
- cached known-good UI pack;
- route/deep-link functionality.

A release that instructs normal users to uninstall/reinstall is considered an architectural regression.

Unavoidable external exceptions include manual storage clearing, OS/browser corruption, or a deliberate origin change.

---

## 15. Cross-platform lock-screen notifications

The app must support meaningful Web Push notifications on both supported iOS/iPadOS Home Screen PWAs and Android installed PWAs.

### 15.1 Architecture

```text
Cloudflare scheduled Worker
        ↓
AirBKK + Open-Meteo
        ↓
threshold/category-change logic
        ↓
Web Push
        ↓
installed iOS / Android PWA
```

Store push subscriptions in Cloudflare D1 or KV. Do not introduce Supabase as the notification database unless there is a later explicit reason.

### 15.2 Notification principles

Notify only meaningful changes, such as:

- movement into an unhealthy AQI category;
- meaningful health-guidance threshold change;
- severe weather condition;
- another explicitly approved operational alert.

Do not notify every numeric refresh.

Critical notification content follows the Thai-first comprehension rule, with English supporting.

### 15.3 Platform reality

- iOS/iPadOS Web Push requires an installed Home Screen web app and user-initiated permission flow on supported versions.
- Android installed PWAs use standards-based Push API/service-worker notification handling.
- Native-app Live Activities / continuously updating lock-screen widgets are not promised by this PWA architecture.

Physical-device QA is required before release: at least one supported iPhone/iPad Home Screen install and one Android installed PWA.

---

## 16. Offline and recovery behavior

The app must remain usable if Supabase or a live environmental source is temporarily unavailable.

On boot:

1. start stable Cloudflare shell;
2. load last known-good cached UI pack immediately;
3. render cached live data if valid;
4. attempt fresh Supabase UI pack and live environmental fetches;
5. promote only validated updates.

If Supabase is unavailable:

- continue using last known-good UI pack.

If weather is unavailable:

- use cached valid weather if allowed;
- otherwise use astronomy + PM2.5 fallback and do not invent weather.

If AirBKK is unavailable:

- show last available valid reading according to existing cache/freshness policy;
- otherwise show explicit unavailable state.

HTML information/controls must remain usable even if WebGL fails.

---

## 17. Performance architecture

Performance target: native-feeling without lowering requested visual quality.

Rules:

- persistent WebGL canvas, not recreated per route;
- stop rendering only when `document.hidden`;
- avoid full-page filters;
- one main backdrop-filter per persistent header/footer surface rather than many nested blur surfaces;
- use transform/opacity for route motion;
- keep active route DOM small;
- avoid unnecessary global reflow/repaint on data refresh;
- use tabular numerals for live readings;
- direct crossfade genuine numeric changes;
- no huge HDRI assets;
- no expensive real volumetric raymarching unless proven performant at the required full mobile quality.

---

## 18. Loading screen

The loading/splash presentation must remain simple and premium:

- flat Sindhorn Twilight background;
- official white Sindhorn Midtown / Vignette logo;
- no darker rounded square/card behind the logo;
- Android icon masking must visually blend into the same manifest background;
- no unnecessary loading UI if cached shell/UI can appear immediately.

---

## 19. Migration plan

### Phase 0 — freeze unnecessary cosmetic deployment work

Do not spend additional Cloudflare deployment cycles on minor styling in the current monolithic architecture unless required for a production-critical bug.

### Phase 1 — establish new Supabase namespace

Create dedicated Sindhorn app storage, preferably `public.sindhorn_app_files`, with versioned content and integrity metadata.

Recommended fields:

- `path`;
- `content`;
- `content_type`;
- `version` / pack id;
- `hash`;
- `enabled`;
- `updated_at`.

Add a pack manifest record.

### Phase 2 — build Sindhorn Bootstrap Shell v1

One coherent GitHub branch implements:

- persistent environment canvas;
- persistent header/footer hosts;
- Supabase pack loader;
- route fragment loader;
- atomic pack cache/promotion;
- fallback UI pack bundled for first boot/recovery;
- service-worker compatibility;
- zero-reinstall update lifecycle.

This should be the major Cloudflare migration deployment.

### Phase 3 — migrate current UI to Supabase

Move current Today/Guidance/Details presentation and editable CI styling into the new app pack while preserving behavior.

Immediately correct currently identified UI issues in the Supabase layer:

- restore Vignette Sans for English;
- retain Noto Sans Thai for Thai including `ข้อมูลล่าสุด`;
- keep English typography eminent;
- remove redundant numbered route kickers;
- use semantic route kickers only;
- apply Flipgazine Voice footer grammar;
- match pull-refresh opacity/material to header/footer;
- keep Save Full Page behavior.

### Phase 4 — environment fidelity pass

On the stable shell engine:

- remove any blocky/rectangular atmosphere artifact;
- establish visible weather-first cloud system;
- verify clear / partly cloudy / overcast / fog / rain / thunderstorm states;
- preserve sharp anti-aliased sun/moon;
- apply PM2.5 optics last;
- keep mobile/desktop quality equivalent;
- keep tilt active.

Atmosphere art-direction numbers should be Supabase-configurable so most tuning needs no deployment.

### Phase 5 — transition/performance pass

- remove full-page blur/filter transitions;
- transform/opacity-only route transitions;
- reduce redundant backdrop filters;
- verify stable frame pacing while WebGL and navigation are active.

### Phase 6 — complete push backend

- Cloudflare Worker;
- VAPID keys/secrets stored securely;
- D1/KV subscription store;
- opt-in UI;
- scheduled AirBKK/Open-Meteo checks;
- threshold deduplication;
- iOS + Android physical-device tests.

### Phase 7 — launch hardening

Before hotel-wide installation:

- finalize permanent production origin;
- freeze manifest identity/scope/start URL;
- verify service-worker upgrade path;
- verify cached UI-pack rollback;
- verify offline boot;
- verify pull-to-refresh;
- verify fullscreen/safe-area behavior;
- verify Web Push on iOS/Android;
- verify no reinstall required across a real shell version upgrade.

---

## 20. Development/deployment discipline after migration

### Frequent UI/content work

Edit Supabase app pack directly, validate, then promote the new pack. No Git/Cloudflare deployment.

Examples:

- change font sizes;
- change header/footer appearance;
- adjust button styling;
- edit bilingual copy;
- tune cloud visibility parameter;
- tune glass opacity;
- change route content.

### Core-engine work

For WebGL engine, service worker, bootstrap or router changes:

1. inspect current canonical shell + live pack;
2. create one coherent development branch;
3. implement the complete requested batch;
4. QA mobile and desktop;
5. test environmental fixtures;
6. merge once;
7. deploy once;
8. verify production URL;
9. do not claim production before deployment succeeds.

Avoid a sequence of tiny `main` commits that each trigger Cloudflare deployment.

---

## 21. Required QA matrix

Before major production release, verify:

### Mobile

- 320px width;
- 360/390px common Android widths;
- supported iPhone viewport;
- installed standalone PWA;
- browser mode;
- fullscreen where supported;
- portrait tilt response.

### Desktop

- Chrome;
- Safari where available;
- DPR/retina display behavior.

### Environment fixtures

- clear daytime;
- clear night;
- partly cloudy daytime/night;
- overcast daytime/night;
- rain;
- thunderstorm;
- fog;
- very good PM2.5;
- hazardous PM2.5 over clear weather;
- high PM2.5 over cloudy/rain weather.

### Failure states

- WebGL unavailable;
- weather API unavailable;
- AirBKK unavailable;
- Supabase unavailable;
- offline launch;
- stale cached UI pack;
- interrupted UI-pack download;
- old service worker upgrading to new shell;
- background → foreground;
- BFCache;
- long-running session.

---

## 22. Acceptance criteria for the next implementation cycle

The migration/next design pass is not complete until all of the following are true:

- Cloudflare persistent shell is operational.
- Supabase Sindhorn UI pack is canonical for frequently edited UI/content.
- Atmosphere persists continuously through Today / Guidance / Details.
- English renders in Vignette Sans.
- Thai renders in Noto Sans Thai, including `ข้อมูลล่าสุด`.
- English typography remains visually eminent.
- Critical/actionable instructions remain Thai-first.
- No numbered `02 · Guidance` / `03 · Details` route labels.
- Footer matches the Flipgazine Voice-page interaction grammar using Sindhorn colors.
- Pull-to-refresh glass matches header/footer opacity/material.
- Route transitions use transform/opacity only; no full-page blur.
- Mobile and desktop environment quality are equivalent.
- Visible weather agrees with Open-Meteo weather code.
- Overcast visibly contains dense cloud structure.
- Moon/sun are smooth and atmospheric, not pixelated/pasted-on.
- PM2.5 is applied after weather as haze/optics, not as fake weather.
- No square/block renderer boundary is visible.
- Tilt remains active on mobile subject only to platform permission requirements.
- Save Full Page captures Today without header/footer/save button and includes the atmosphere.
- Pull-to-refresh refreshes current environmental data.
- Existing installation survives UI-pack updates and shell upgrades without reinstall.
- PWA identity/origin decision is frozen before broad employee rollout.

---

## 23. Documentation authority

Use this order when resuming the project:

1. `AGENTS.md` — repository operating rules and pointer to canonical plan.
2. `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md` — **canonical final architecture and implementation plan**.
3. `docs/CI-UI-ADAPTATION.md` — visual/UI detail where it does not conflict with this plan.
4. `docs/REALTIME-ENVIRONMENT-PLAN.md` — environment detail where it does not conflict with this plan.
5. `docs/NOTIFICATIONS-ARCHITECTURE.md` — push detail where it does not conflict with this plan.
6. `docs/PULL-TO-REFRESH.md` — pull-refresh detail where it does not conflict with this plan.
7. `docs/PWA-SPA-ARCHITECTURE.md` — historical/current-shell detail; superseded by the hybrid bootstrap architecture in this file where conflicting.

When implementation changes the actual live architecture, update this document and `AGENTS.md` so a new ChatGPT/Codex session can recover the real state without relying on conversation history.
