# Sindhorn Midtown Internal

Production PWA for Sindhorn Midtown Hotel Bangkok environmental reporting and internal hotel operations.

## Architecture

- Cloudflare Pages hosts the persistent PWA shell and WebGL renderer.
- Supabase supplies versioned presentation resources and operational data used by internal modules.
- AirBKK remains authoritative for PM2.5 / Thai AQI.
- Open-Meteo supplies current weather used by both the UI and atmospheric renderer.
- The application interface is English-only; bilingual Thai/English F&B marketing copy remains operational content for artwork production.

## F&B promotion data

Supabase is the canonical runtime authority for F&B promotions. Excel workbooks are source/import material; routine promotion content must not be moved back into `site/fnb-data.js`.

When the product owner uploads updated F&B Excel workbooks, follow:

1. `docs/FNB-SUPABASE-DATA-AUTHORITY-20260829.md`
2. `docs/FNB-EXCEL-TO-SUPABASE-UPDATE-RUNBOOK.md`

The runbook covers workbook inspection, stable IDs, conservative copy cleanup, Supabase writes, artwork links/progress, validation, rollback, and the limited case where a brand-new promotion share slug needs a Cloudflare share-page generation release.

## Release model

Executable infrastructure is released through GitHub → GitHub Actions → Cloudflare Pages. Operational F&B content is updated in Supabase and normally propagates without a Git deployment. UI/rendering/schema changes still use the normal branch → preview → PR → merge release flow.

Production: https://sindhorn-midtown-internal.pages.dev
