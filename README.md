# Sindhorn Midtown Internal

Canonical frontend repository for the Sindhorn Midtown internal web app.

- Production: `https://sindhorn-midtown-internal.pages.dev`
- Cloudflare Pages project: `sindhorn-midtown-internal`
- Shared Supabase project: `sjpvhgxacsiorrtijqua`

## Current state

`main` contains the approved migrated PM2.5 v5 baseline.

The experimental branch `webgl-environment-v1` contains the realtime atmospheric redesign. Its current visual direction uses the WebGL atmosphere as the full-page background, with all PM2.5/AQI/status/guidance information layered directly above it and no filled dashboard cards.

Weather, astronomy and pollution remain independent realtime inputs. See `docs/REALTIME-ENVIRONMENT-PLAN.md` for the architecture and safety rules.

## Deployment

GitHub Actions deploys `site/` through Wrangler to Cloudflare Pages. Production deploys come from `main`; the WebGL branch deploys to its Cloudflare preview alias for review before merge.
