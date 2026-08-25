# Sindhorn Midtown Internal — PWA / SPA Architecture

The logo/date masthead, realtime WebGL atmosphere and bottom navigation persist while route content changes client-side.

## Routes
- `/` — live PM2.5 / Thai AQI report followed by current weather.
- `/guidance` — health guidance and AQI interpretation.
- `/details` — reading details, source and methodology.

Navigation uses the History API and Cloudflare Pages SPA fallback.

## PWA
`manifest.webmanifest` defines standalone/fullscreen-capable installation and uses the official hotel lockup for app icons. `sw.js` caches the same-origin app shell and falls back to `index.html` for offline SPA navigation.

## Native-app interaction
A persistent safe-area-aware bottom tab bar provides route navigation. The top utility button uses the browser Fullscreen API. Installed standalone mode respects device safe areas. Route changes use View Transitions where supported and respect reduced-motion preferences.

## Environment rule
There is no UI light/dark theme. Physical day/night, sun position, clouds, rain and pollution are realtime environment state.
