# Sindhorn Midtown Internal

Production PWA for Sindhorn Midtown Hotel Bangkok environmental reporting.

## Architecture

- Cloudflare Pages hosts the persistent v15 PWA shell and WebGL renderer.
- Supabase `public.sindhorn_app_files` supplies versioned, SHA-256-validated UI packs.
- AirBKK remains authoritative for PM2.5 / Thai AQI.
- Open-Meteo supplies current weather used by both the UI and atmospheric renderer.
- English is first throughout the bilingual interface; Thai follows as direct operational support.

## Release model

Stable executable infrastructure is released through GitHub → GitHub Actions → Cloudflare Pages. Routine UI/content/art-direction changes should be published as a new immutable Supabase app pack compatible with the installed shell.

Production: https://sindhorn-midtown-internal.pages.dev
