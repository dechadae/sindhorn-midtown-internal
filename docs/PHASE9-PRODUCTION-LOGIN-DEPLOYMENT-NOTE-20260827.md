# Phase 9 production login deployment note

The first production release adds `/login.html` and `/admin.html` as standalone internal-auth surfaces while leaving the existing environmental PWA accessible during acceptance.

This is deliberate. Authentication is tested with real employee activation before the app-wide auth gate is switched on. The installed PWA identity, service worker, atmosphere renderer, Messages route, environmental alerts, and Phase 8.2 renderer remain unchanged by this release.
