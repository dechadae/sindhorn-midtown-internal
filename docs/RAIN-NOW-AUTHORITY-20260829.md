# Rain-Now Authority — 2026-08-29

## Status

Branch: `fix-rain-now-authority`

This decision changes precipitation STATE authority only. It does not redesign the Bangkok atmosphere renderer.

Approved rendering architecture remains:

Bangkok seasonal sky prior + Open-Meteo general weather + actual local astronomy + AirBKK PM2.5 optics -> atmosphere.

The precipitation correction adds a separate rain-now observation path:

device coordinates -> Tomorrow.io rain-now -> deterministic authority resolver -> UI precipitation state + existing rain layer.

Open-Meteo remains the general weather authority and fallback.

## Confirmed production failure modes

1. `site/environment.js` derives the displayed condition from `weather_code` only. Therefore WMO code 3 can display `Overcast` even when precipitation fields are non-zero.
2. Open-Meteo documents its current conditions as weather-model data. In Bangkok, 15-minute current values are not native high-resolution radar observations and may be interpolated from hourly model output. A localized convective shower can therefore be missed.
3. The current PWA can initially use a weather cache for up to 45 minutes while a live fetch is pending or unavailable.
4. The previous location shell allowed a cached device location for 24 hours and requested geolocation with `enableHighAccuracy:false`. It also printed coordinates in the Today UI. The branch reduces the cache window to six hours, requests one-shot high accuracy, refreshes after five minutes of foreground staleness, and no longer prints coordinates.

The exact failed-session Open-Meteo precipitation/rain/showers values cannot be reconstructed because the production app did not persist weather-response telemetry. The observed label `Overcast` proves the UI resolved WMO code 3 at display time, but it does not prove whether precipitation fields were zero or merely ignored by the label mapper. No precise device coordinates are persisted server-side by this change.

## Provider comparison

| Provider | Rain-now basis | Bangkok / exact point | Time detail | Production notes | Decision |
| --- | --- | --- | --- | --- | --- |
| Thai Meteorological Department radar/QPE | Radar/QPE observation | Bangkok radar coverage and national composite | Public radar updates frequently; QPE advertised at 15-min class cadence | Official machine-readable QPE ZIP was tested live on 2026-08-29 and its `latest` member was timestamped 2026-07-11. Public radar pages were current, so the machine endpoint is not safe as a production authority. TMD also warns of radar artifacts and does not provide an SLA for this public product. | Reject as production override for now; retain as local reference/evidence source. |
| AccuWeather MinuteCast | Proprietary hyperlocal precipitation product | Exact geoposition; Bangkok public coverage exists | Minute-by-minute, next 120 min | Separate paid MinuteCast package, API key, and attribution/logo obligations. Strong candidate but adds branding/commercial constraints. | Runner-up. |
| Tomorrow.io | Unified Precipitation fusion of quality-controlled radar + satellite + weather intelligence | Exact coordinates; global coverage including Bangkok | Realtime rain/precipitation intensity; fused precipitation layer refreshes rapidly; premium tiers add finer/minutely capability | Private key required. Free allowance is useful for testing but is not sized for many concurrent employees. Stable REST boundary and no need to replace Open-Meteo fields. | **Selected production rain-now authority.** |
| OpenWeather One Call | Proprietary hyperlocal weather model | Exact coordinates | Current rain plus 1-minute next-hour precipitation; provider update cadence about 10 min | Private key / paid subscription boundary. Useful fallback commercial option but more model-derived than the selected precipitation-fusion approach. | Not selected. |
| Apple Weather / WeatherKit | Apple multi-source weather service | Exact coordinates | Next-hour precipitation is not currently offered for Thailand | TMD appears in Apple attribution for severe-weather alerts; that does not make WeatherKit a Bangkok radar authority. Requires Apple credentials and attribution. | Reject for this use case. |
| RainViewer public API | Radar tiles | Broad Thailand coverage | Historical radar tiles every ~10 min; service data refresh is frequent | Public API terms are personal/educational/small-community use and no SLA; unsuitable for this hotel production app. | Reject. |

## Authority hierarchy

1. Fresh Tomorrow.io rain-now signal.
2. Open-Meteo current precipitation/rain/showers and WMO rain codes.
3. Open-Meteo general condition.
4. Bangkok seasonal prior for visual character only.

Seasonal data never creates precipitation.

The resolver preserves the original Open-Meteo cloud code as `cloudWeatherCode`. When fresh rain-now evidence says rain while the cloud state is Overcast, the effective public weather snapshot becomes a rain code for precipitation consumers while the WebGL atmosphere keeps the original cloud family. Result: overcast cloud geometry + existing rain layer + UI label `Rain`.

## Deterministic rain confidence

Operational thresholds use instantaneous rain rate from the selected rain-now provider:

- `< 0.1 mm/h`: dry
- `0.1–<0.3 mm/h`: possible drizzle; does not activate rain alone unless Open-Meteo also reports precipitation
- `0.3–<1 mm/h`: drizzle
- `1–<4 mm/h`: rain
- `>= 4 mm/h`: heavy rain

Provider weather codes can strengthen classification, including Tomorrow.io drizzle/rain/heavy-rain/thunderstorm codes. The 0.1 mm threshold is intentionally a noise floor; 4 mm/h is treated as heavy rain. This is an understandable deterministic rule, not ML.

## Hysteresis

Rain starts immediately on a fresh high-confidence provider signal or a fresh Open-Meteo rain fallback.

Rain does not stop on one new dry observation. Two distinct dry observations are required. With the three-minute active foreground poll, normal release is about six minutes after sustained dry evidence. A seven-minute maximum hold prevents stale wet state from persisting indefinitely.

A meaningful location-cell change resets hysteresis rather than carrying rain from the previous location.

## Freshness

- Tomorrow.io observation stale threshold: 7 minutes.
- Open-Meteo current observation stale threshold: 20 minutes when an observation timestamp is available.
- Server provider cache: 2 minutes, keyed to an approximately 0.0025-degree cell while sending exact device coordinates on a cache miss.
- Foreground client poll: 3 minutes.
- Background: no periodic provider polling.
- Resume: refresh promptly when provider data is older than 2 minutes; refresh one-shot device geolocation when location age exceeds 5 minutes.

Stale rain-now data never overrides fresh Open-Meteo.

## Secret and privacy boundary

`TOMORROW_API_KEY` exists only as a Supabase Edge Function secret when configured. It is not present in client JavaScript, the service worker, manifest, GitHub source, or public tables.

The Edge Function requires an authenticated employee JWT. The response contains only rain-state fields and timing/latency metadata; it does not echo device coordinates. The client does not log coordinates. The Today location row now says `Current device location` / `Last known device location` instead of printing latitude/longitude. Existing atmosphere debug text is sanitized by the rain-now integration before it can remain visible with precise coordinates.

## Failure behavior

If Tomorrow.io is unavailable, stale, times out, unauthenticated, or not configured, the client silently falls back to Open-Meteo. Atmosphere initialization and Today rendering are not blocked. No technical error is surfaced in normal UI.

As of this branch build, the live Supabase project has **no `TOMORROW_API_KEY` configured**. Therefore the branch preview exercises the complete fallback path until the key is provisioned. The code must not be described as having a live Tomorrow.io signal until that credential is configured and a fresh provider response is verified.

## Renderer invariants

Unchanged:

- `site/environment.js`
- `site/atmosphere-shader.js`
- `site/seasonal-sky.js`
- `site/rain-layer.js`
- three cloud families
- real sun/moon and device-coordinate astronomy
- AirBKK PM2.5 optics
- fixed DPR 2
- current cloud sampling and frame pacing
- single-shell/no-flash routing architecture

The new bridge changes only the effective weather snapshot read by precipitation consumers; the renderer's internal cloud state remains Open-Meteo based.
