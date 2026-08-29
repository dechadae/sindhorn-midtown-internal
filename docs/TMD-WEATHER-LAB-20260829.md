# TMD Weather Lab — 2026-08-29

## Status

Branch: `tmd-weather-lab`

This is an isolated comparison lab. It does **not** replace the production weather authority and it does not alter the Bangkok atmosphere renderer, PM2.5 optics, seasonal sky, sun/moon astronomy, cloud morphology, rain renderer, authentication, or footer navigation.

The lab is an authenticated single-shell SPA route at `/weather-lab` and is intentionally not listed in the four-item footer.

Supabase Edge Function: `sindhorn-weather-lab` (JWT required).

## Objective

Evaluate a TMD-first Bangkok weather architecture using the device's actual GPS location, with special focus on:

1. whether rain is occurring at the device location now;
2. how quickly a TMD source detects rain starting;
3. how quickly it releases to dry after rain stops;
4. freshness and spatial relevance of TMD AWS;
5. operational health and update cadence of TMD radar/QPE and SATDA nowcasting.

## TMD sources under test

### Nationwide radar QPE ASCII

Official TMD machine product:

`https://weather.tmd.go.th/composite/compositeQPE_VTBB_latest.asc.zip`

The Edge Function downloads the ZIP server-side, unpacks the `.asc` member, parses ESRI-style grid header fields when present, and samples the grid at the device latitude/longitude only when the grid header can be safely interpreted as geographic coordinates.

The response exposes:

- HTTP `Last-Modified` and ETag;
- archive/member size;
- ASCII member name and timestamp token, if one is present in the filename;
- parsed grid header;
- exact cell value;
- 3×3 neighborhood maximum and mean;
- approximate cell resolution when geographic sampling is supported.

Until TMD product timestamp semantics are verified, the lab labels freshness based on HTTP `Last-Modified` explicitly rather than pretending it is an observation timestamp.

### TMD AWS

The lab reads the current Bangkok AWS dataset and finds the nearest station to the device location. It exposes observation time, station distance, temperature, humidity, wind, weather code, 15-minute rain, hourly rain and daily rain.

Important: `precip15Mins * 4` is **not** treated as instantaneous rain intensity. A 15-minute accumulation is trailing evidence and can remain non-zero after rain has stopped. `weatherType` is also a supporting hint rather than an exact-point rain-now authority.

### SATDA Bangkok nowcast

The lab checks the TMD SATDA landing page and Bangkok three-hour nowcasting page separately. It exposes current radar-composite update text, recent frame names, page health, and discovered nowcast assets for diagnostics.

SATDA is not yet used as an exact-coordinate numerical rain decision until its live data assets and georeferencing are verified.

## Experimental decision shown in the lab

The displayed `Proposed TMD rain-now` is deliberately separate from production.

Current experimental logic:

1. A fresh, georeferenceable QPE cell at the device location is the direct rain-now evidence.
2. Center-cell value `> 0.05` is shown as rain; a fresh center cell at or below that threshold is shown as dry.
3. A wet neighboring 3×3 cell is shown as `rain nearby` but does not by itself turn the exact device point wet.
4. AWS rain weather codes or recent 15-minute accumulation are support-only when QPE is unavailable/stale.
5. If no fresh exact-point QPE evidence exists, the lab returns `UNKNOWN` rather than allowing a model or trailing accumulation to assert rain.

The `0.05` grid-value threshold is experimental and must be recalibrated after verifying the QPE value units/product cadence.

## Truth logging

The lab includes two tester controls:

- `RAINING HERE NOW`
- `DRY HERE NOW`

A truth event stores a local device record containing:

- timestamp;
- location source and GPS accuracy;
- proposed TMD decision;
- QPE cell evidence/freshness;
- AWS observation/distance/recent rainfall;
- SATDA frame status;
- current production authority snapshot.

Precise latitude/longitude are not persisted in the truth log and are not echoed by the Edge Function.

The log can be copied as JSON for later rain-start/rain-stop analysis.

## Refresh behavior

- Lab client: once per minute while foregrounded.
- TMD QPE Edge cache: 3 minutes.
- TMD AWS Edge cache: 2 minutes.
- SATDA Edge cache: 3 minutes.
- Returning to the foreground refreshes when the lab sample is older than one minute.
- Manual `Refresh now` also asks the existing location subsystem for a fresh high-accuracy device location.

These intervals are for evaluation only. Production polling will be selected after real storm measurements.

## Production invariants

The lab must not:

- write its proposed rain state into `site/weather-authority.js`;
- call the lab function from `site/rain-now.js`;
- modify WebGL atmosphere state;
- change Open-Meteo production weather behavior yet;
- add a fifth footer item;
- persist exact employee coordinates server-side.

Production migration requires review of truth-log evidence and explicit approval.
