# Sindhorn Midtown Internal — Single-Shell Router Invariant

**Status:** Mandatory architecture invariant  
**Date:** 28 August 2026

## Decision

Every authenticated Sindhorn Midtown Internal screen is an in-shell SPA route.

The installed PWA document, WebGL atmosphere, authenticated session, header host, route host and footer host are created once and remain mounted for the entire authenticated session. Route changes replace only the contents of `#route-view`.

This applies to all current authenticated routes:

- `/` — Today
- `/guidance`
- `/details`
- `/messages`
- `/account`
- `/admin`

It also applies to every future authenticated page or module. A future feature must be registered in `site/route-registry.js` and mounted through the persistent shell. It must not introduce a new standalone authenticated HTML document.

## Only document boundary

`/login.html` is the only intentional standalone application document because it is the unauthenticated security boundary.

Sign-in may enter the authenticated shell. Sign-out may leave it. Once authenticated, navigation between app screens must not replace or reload the document.

## Transition rule

Authenticated route transitions must:

- keep the header visually stable;
- keep the footer/navigation visually stable;
- keep the WebGL atmosphere running continuously;
- keep weather, PM2.5, astronomy, location, push and auth state alive;
- animate only `#route-view`;
- use one restrained opacity crossfade;
- never use document-root fades, page reload veils, white frames, route slides, zooms or browser-dependent cross-document View Transitions.

## Routing authority

`site/route-registry.js` is the executable route registry.

Remote presentation routes use validated Supabase pack fragments. Shell-owned application routes such as Account and Admin use local mount modules. Both route types are mounted through `window.SindhornAppPack.mountRoute()` and navigated through the same History API router.

Legacy `/account.html` and `/admin.html` URLs are compatibility redirects only; they are not application documents.

## Release gate

A change fails architecture review if any authenticated navigation path uses `location.assign`, `location.replace`, a normal same-origin document link, or a new standalone HTML page instead of the SPA router, except when deliberately leaving the authenticated app for `/login.html`.

No authenticated feature may be merged until direct-load, in-app navigation, browser back/forward and installed-PWA navigation all preserve the single persistent shell without a document flash.
