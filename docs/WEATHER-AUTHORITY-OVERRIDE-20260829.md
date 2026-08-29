# Weather Authority Override — 2026-08-29

This document supersedes every earlier Sindhorn Midtown Internal weather-source statement that names Open-Meteo as the production current-weather or precipitation authority.

## Product decision

Open-Meteo is removed from the production weather data path after repeated physical dry observations on 2026-08-29 while Open-Meteo reported drizzle (WMO 51 / 0.1 mm). Fresh nearby TMD AWS observations at the same times reported non-rain weather code 3 and zero 15-minute / one-hour rainfall.

Do not restore Open-Meteo as a current-weather, rain-now, atmosphere, fallback, or arbitration dependency without a new explicit product-owner decision.

## Production authority

Production weather is:

`device GPS`
`→ authenticated Supabase sindhorn-weather-core`
`→ TMD AWS current observation`
`+ MET Norway Locationforecast cloud / forecast support`
`→ observation-only precipitation authority`
`→ existing Bangkok seasonal atmosphere renderer`

### TMD AWS

TMD AWS is authoritative for fresh observed current conditions when a suitable Bangkok station is available within the configured distance/freshness limits. It supplies observed temperature, humidity, wind and current station condition/rain evidence.

TMD trailing 15-minute or one-hour rainfall totals are recent accumulation evidence, not instantaneous rain rate. A stale or lingering rain weather code alone must not keep the app raining when the observation no longer supports current rain.

### MET Norway

MET Norway Locationforecast is the model support source for cloud fraction and forecast fields that the current TMD AWS feed does not provide. It is fetched server-side with provider-compliant identification and caching.

MET Norway precipitation/model output is forecast context only. A model wet signal is never permitted to activate the current rain animation or current `rainNow` state.

### Precipitation authority

Current precipitation is observation-only:

1. Fresh explicit observed wet evidence can activate rain.
2. Fresh observed dry evidence releases rain immediately.
3. Base/model weather cannot activate rain by itself.
4. There is no seven-minute dry hysteresis after a fresh observed dry sample.
5. If observations are unavailable/stale/ambiguous, current rain is unknown internally rather than inferred from a model drizzle code; the renderer must not invent rain.
6. Fresh exact-point radar/QPE may later outrank station evidence when a reliable current feed is approved, but stale TMD QPE/SATDA products must not be treated as live.

## Implementation

- Supabase Edge Function: `sindhorn-weather-core`
  - TMD AWS + MET Norway normalization
  - authenticated (`verify_jwt=true`)
  - `diagnostics.openMeteoUsed=false`
- `site/location.js`
  - current migration adapter
  - intercepts the legacy environment weather request signature and serves normalized `sindhorn-weather-core` data instead
  - clears old Open-Meteo cached weather once on provider migration
  - the legacy `api.open-meteo.com` string is only a compatibility request signature; no request is sent to Open-Meteo
- `site/weather-authority.js`
  - observation-only precipitation decision
  - immediate fresh-dry release
  - model/base wet cannot activate current rain
- `site/rain-now.js`
  - reads current precipitation evidence from `sindhorn-weather-core`
  - no production call to the former `sindhorn-rain-now` path
- `site/environment.js`
  - atmosphere/rendering contract remains unchanged during this safe provider migration
  - receives normalized TMD/MET data through the compatibility adapter

A future cleanup may change `site/environment.js` to call the normalized weather core directly and remove the legacy URL contract entirely. That cleanup must not change the provider authority rules above.

## Regression case that must remain locked

For a case equivalent to the verified 2026-08-29 failure:

- physical truth: DRY
- base/model weather: WMO 51 / drizzle / 0.1 mm
- fresh TMD AWS: weather code 3, 0 mm in 15 minutes, 0 mm in one hour

Required result:

- `active = false`
- `precipitationState = dry`
- `authority = tmd-aws`
- effective `precipitationMm = 0`
- effective `rainMm = 0`
- no rain animation
- no current “Drizzle” label derived from the model

This case is encoded in `site/weather-authority.test.mjs` and must not be weakened.

## Public camera and radar research

Bangkok public-camera weather analysis and TMD/BMA radar research remain optional supporting/research layers until separately approved for production. They must not delay or weaken the TMD + MET Norway replacement described here.
