# Sindhorn Midtown Internal

Private source repository for Sindhorn Midtown Hotel Bangkok internal web applications.

## Production

- Cloudflare Pages project: `sindhorn-midtown-internal`
- Production URL: `https://sindhorn-midtown-internal.pages.dev`
- Deployment: GitHub Actions → Wrangler → Cloudflare Pages
- Deploy directory: `site/`

## Backend and shared assets

This app may reuse the existing Flipgazine Supabase project (`sjpvhgxacsiorrtijqua`) for approved shared assets and backend services. GitHub is the canonical source of truth for this app's frontend code; the app must not be stored in Flipgazine `public.site_files`.

## Current status

Repository/deployment bootstrap. The approved PM2.5 v5 interface will be migrated here before the real-time weather + astronomy + PM2.5 WebGL environment is developed.

Read `AGENTS.md` before making consequential changes.
