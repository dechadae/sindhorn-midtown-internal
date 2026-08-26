# Sindhorn Midtown Internal — User Local Location Override

**Date:** 26 August 2026  
**Status:** Approved product override

## Decision

On app opening, the browser requests the user's geolocation permission.

When permission is granted:

- current weather is requested from Open-Meteo for the user's coordinates;
- Open-Meteo resolves the local timezone automatically;
- the header date follows the resolved local timezone;
- the live atmosphere uses the user's local weather;
- sun and moon position are calculated from the user's latitude and longitude;
- coordinates are cached only in the user's browser storage and are not written to Supabase or GitHub.

When permission is denied, unavailable, or times out without a usable recent cached location, the app falls back to Sindhorn Midtown Bangkok coordinates and Asia/Bangkok.

A recent cached user location may be used temporarily when a fresh location request is unavailable for a non-permission reason.

## Air-quality authority remains unchanged

PM2.5 and Thai AQI remain official AirBKK readings from the Sindhorn Midtown / Pathum Wan monitoring set. The app does not silently replace the official ground-station reading with a modelled global air-quality estimate.

Therefore the app intentionally separates:

- **local user weather + celestial atmosphere**, and
- **official hotel-area PM2.5 / Thai AQI**.

## Runtime ownership

`site/location.js` is executable shell infrastructure and belongs to GitHub / Cloudflare. It:

- requests browser geolocation on opening;
- exposes `window.SindhornLocation`;
- routes Open-Meteo forecast requests to the approved user coordinates;
- maintains the local timezone/header date;
- publishes `sindhorn:location-updated` events;
- falls back safely without blocking the app.

The PWA origin, id, scope and start URL remain unchanged. No reinstall is required.
