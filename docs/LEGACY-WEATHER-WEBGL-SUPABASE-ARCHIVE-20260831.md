# Legacy Weather WebGL Supabase Archive — 2026-08-31

Status: retired from deployed app; private recovery copy retained.

## Archive identity

- Supabase project: `sjpvhgxacsiorrtijqua`
- Table: `private.legacy_weather_webgl_archive`
- Archive key: `legacy-weather-webgl-20260831`
- Source repository: `dechadae/sindhorn-midtown-internal`
- Source commit: `29b0c99941163582b84d376982e459fdf6ead85b`
- Files: 13
- Total source bytes: 1,169,050
- RLS: enabled
- `anon` / `authenticated` table grants: none

## Archived files

- `site/environment.js`
- `site/environment.bundle.js`
- `site/seasonal-sky.js`
- `site/atmosphere-shader.js`
- `site/rain-layer-legacy-weather.js`
- `site/rain-layer.js`
- `site/sun-dimmer.js`
- `site/storm-effects.js`
- `site/sky-calibration.js`
- `site/sky-color-renderer.js`
- `site/cloud-tester.js`
- `site/phase8-2-fixtures.js`
- `site/phase8-2-seasonal-clouds.test.mjs`

Every row stores exact source text, byte length and SHA-256 digest fetched directly by Supabase from the immutable source commit before app deletion.

## Product boundary

TMD/MET Norway weather, current-rain authority and AirBKK remain production data/UI services. They no longer have a separate weather-driven WebGL visual layer. The Sindhorn Betta renderer remains the app's sole persistent WebGL visual.
