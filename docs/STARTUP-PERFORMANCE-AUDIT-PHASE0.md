# Startup Performance Audit · Phase 0

Date: 2026-09-01
Branch: `audit-startup-phase0`
Base: `b5cf2b1e021d2bd9bc93dff7e28aaf6dd22e41ab`

## Purpose

Measure the installed-PWA startup path without changing production behavior, approved Betta visuals, authentication authority, weather authority, business data, F&B data, Business Card behavior, push delivery semantics or Supabase state.

This phase adds instrumentation only to the preview branch. Production remains untouched.

## Existing evidence before instrumentation

The current authenticated production browser smoke runs with service workers explicitly blocked. It reaches the shared startup reveal at roughly 0.8 s desktop and 1.2 s at a 390×844 mobile viewport. The user's Android installed-PWA recording is roughly 9 s from tap to usable Today. This isolates the largest unexplained delta to the installed-PWA/device startup path rather than ordinary Today/Betta bootstrap.

The current service worker is network-first for app navigations, precaches 65 shell resources serially during install, and v43 performs a one-time client navigation after activation. These remain audit findings; Phase 0 does not change them.

## Instrumentation captured

Each navigation stores timing-only metadata under localStorage key `sindhorn-startup-audit:v1`:

- display mode: standalone PWA or browser
- whether the document started under a service-worker controller
- Navigation Timing fields including `workerStart`, `fetchStart`, `requestStart`, `responseStart`, `responseEnd`, DOMContentLoaded and load
- paint timings when exposed by the browser
- existing Sindhorn marks including Betta first frame and shared startup reveal
- shell-loading and route mount events
- service-worker registration, update, updatefound, worker state transitions and controllerchange events observable from the page
- classified fetch timing for employee profile, token refresh, UI pack, weather core, satellite and air-current requests
- slow resource timing summaries without request bodies, authorization headers or private payload content
- pagehide / visibility transitions so forced re-navigation can be distinguished from one continuous launch

The audit does **not** store access tokens, refresh tokens, authorization headers, employee IDs, PINs, request bodies or private business-report data.

## Android protocol

1. Open the branch preview root in Chrome.
2. Clear this preview origin's site data before the first clean install test.
3. Install the preview as a PWA.
4. Close the PWA completely.
5. Launch it from the home screen and wait until Today is visible.
6. Repeat one warm close/relaunch without clearing data.
7. Open `/startup-audit.html` on the same preview origin.
8. Copy the JSON report.

Keep the first installed/update launch and second warm launch as separate records.

## Interpretation

### Navigation / service-worker delay

A large gap between navigation start and `responseStart`, combined with a non-zero `workerStart`, indicates time in the service-worker-controlled navigation path before document execution.

### Authentication delay

`employee-profile` is expected on authenticated cold document startup. `auth-refresh` should appear only when the stored token is near expiry or a forced retry occurs. Their recorded durations show whether auth materially contributes after HTML begins executing.

### Update / reload amplification

`sw-updatefound`, worker state transitions, `sw-controllerchange`, `pagehide`, followed by another saved navigation indicate the update lifecycle caused an additional document navigation.

### Betta / shell delay

The difference between DOMContentLoaded, the existing `sindhorn-betta-first-frame` mark and `sindhorn-startup-enter-visible` separates app bootstrap from the service-worker/native-launch phase.

## Phase 0 exit criteria

Phase 0 is complete when we have at least:

- one clean installed-PWA launch record
- one warm installed-PWA relaunch record
- one ordinary browser launch record for the same preview
- clear evidence whether a controller/update transition causes a second navigation
- enough timing to assign the dominant multi-second delay to navigation/SW, auth, document bootstrap or device process startup

Only after these measurements should Phase 1 change navigation strategy or Phase 2 change service-worker install/update behavior.
