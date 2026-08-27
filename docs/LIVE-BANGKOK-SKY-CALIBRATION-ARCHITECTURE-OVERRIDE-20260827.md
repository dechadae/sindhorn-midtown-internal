# Live Bangkok Sky Calibration — Architecture Override

**Status:** Approved architecture extension  
**Date:** 27 August 2026  
**Repository:** `dechadae/sindhorn-midtown-internal`  
**Production:** `https://sindhorn-midtown-internal.pages.dev/`

This document is a later architectural decision than `FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`. It overrides that document only where the realtime sky-input pipeline is concerned. All other product, language, PWA, AirBKK, Open-Meteo, Supabase-pack and deployment rules remain unchanged.

## 1. Product decision

Add a **Directional Live Bangkok Sky Calibration** layer so the rendered atmosphere follows the sky Bangkok is visibly experiencing, not only a weather model's categorical state.

The calibration layer is visual evidence, not a replacement weather authority.

```text
DEVICE LOCATION + LOCAL TIME
        |
        +--> ASTRONOMY ------------------------------ authoritative sun/moon geometry
        |
        +--> OPEN-METEO ----------------------------- authoritative local weather state
        |
        +--> DIRECTIONAL BANGKOK CAMERAS ----------- observed visual atmosphere
        |       east cameras -> sunrise/dawn
        |       west cameras -> sunset/dusk
        |       central/all cameras -> daytime/night consensus
        |
        +--> AIRBKK -------------------------------- authoritative PM2.5 / Thai AQI

FUSION / CONFIDENCE / SMOOTHING
        |
        v
RENDERER CALIBRATION VECTOR
        |
        v
SKY -> CLOUDS -> SUN/MOON -> PRECIPITATION/FOG/STORM -> PM2.5 OPTICS -> UI
```

## 2. Authority boundaries

The following boundaries are mandatory.

### Astronomy remains authoritative for geometry

Camera analysis must never move the calculated sun or moon. Solar/lunar altitude and azimuth continue to come from local astronomy using the app's resolved observer location and local time.

### Open-Meteo remains authoritative for local weather mechanics

Open-Meteo remains the authority for:

- weather code;
- cloud-cover baseline;
- precipitation/rain/showers;
- humidity;
- wind;
- visibility;
- temperature/apparent temperature;
- severe-weather mechanics.

A camera may visually calibrate cloud darkness, sky hue or haze, but it must not fabricate rain, hail, lightning or a weather code that conflicts with the local weather state.

### AirBKK remains authoritative for PM2.5 / Thai AQI

Camera-derived haze can influence visual confidence and atmospheric appearance, but it must never create or alter PM2.5/AQI numbers. PM2.5 optical effects remain downstream of weather and camera sky calibration.

### Camera evidence is authoritative only for observed appearance

Camera analysis may calibrate:

- zenith sky color;
- horizon sky color;
- color temperature / warm-vs-cool balance;
- luminance;
- saturation;
- cloud darkness / opacity appearance;
- haze appearance;
- horizon contrast / visibility appearance;
- sunrise/sunset glow strength;
- storm-darkness confidence.

## 3. Directional camera rule

Direction is a first-class property of every camera.

### Sunrise / dawn

When the sun is below or near the eastern horizon, **east-facing cameras dominate color evidence**. This is especially important from astronomical dawn through roughly one hour after sunrise.

### Sunset / dusk

When the sun is approaching or below the western horizon, **west-facing cameras dominate color evidence**. This is especially important from roughly one hour before sunset through astronomical dusk.

### Midday

When the sun is well above the horizon, east/west direction matters less. Use a broader Bangkok consensus weighted by camera quality, freshness and geographic relevance.

### Night

Use cameras mainly for cloud/haze/luminance confidence. Do not infer astronomical object position from camera pixels.

A starting directional weight is:

```text
solar altitude <= 12 deg:
    sunrise side weight = 0.55 to 0.80 when solar azimuth is broadly east
    sunset side weight  = 0.55 to 0.80 when solar azimuth is broadly west
    remaining weight distributed across valid central/opposite cameras

solar altitude > 12 deg:
    directional weight decreases smoothly
    consensus/quality/freshness/geographic relevance dominate
```

Do not switch weights abruptly at a clock time. Weight by actual solar azimuth and altitude.

## 4. Camera registry

Every automated camera source must be represented by metadata rather than anonymous URLs.

Minimum registry fields:

```json
{
  "id": "bang-yi-khan-east-317138",
  "name": "Bang Yi Khan / Krung Thon Bridge East",
  "latitude": 13.7813,
  "longitude": 100.5015,
  "facing": "east",
  "azimuthDeg": 90,
  "provider": "opencctv-public-source",
  "sourcePage": "https://opencctv.org/...",
  "feedType": "image",
  "freshnessTargetSeconds": 300,
  "rightsMode": "transient-analysis-only",
  "enabled": true
}
```

Initial discovery evidence includes multiple explicitly labelled East/West Bangkok cameras around Krung Thon Bridge / Chao Phraya. OpenCCTV currently indexes dozens of Bangkok public cameras and reports that most refresh within five minutes. A west-facing Bang Yi Khan camera is an image feed at approximately `13.7813, 100.5015` and refreshes about every three minutes.

Candidate secondary visual references include central-Bangkok skyline cameras and the Sathorn/Silom livestream. These are only automated when the provider/source permits programmatic analysis. Otherwise they remain manual QA references until permission or a suitable official/direct feed exists.

A future Sindhorn Midtown-owned roof/sky camera becomes the highest-confidence visual source because it is hyperlocal and under hotel control.

## 5. Acquisition policy

Automated acquisition must prefer direct public/official snapshot feeds or provider-supported access.

Rules:

1. Fetch server-side; never expose third-party camera URLs as a required client dependency.
2. Prefer upper-sky/horizon content and ignore street-level detail.
3. Do not retain raw camera frames after analysis.
4. Store only derived calibration values, source ID, timestamp, freshness and confidence.
5. If a provider prohibits extraction/automated use, do not scrape it. Keep it as manual QA evidence or obtain permission.
6. Camera failure must never break weather rendering.

## 6. Visual analysis

The preferred implementation is Cloudflare Workers AI using a vision-capable model with structured JSON output. Cloudflare currently documents vision-capable Workers AI models and JSON-schema output support; this keeps the analysis inside the existing Cloudflare stack.

The model is asked to evaluate only visible atmospheric properties and return a strict bounded schema such as:

```json
{
  "skyVisible": true,
  "quality": 0.91,
  "confidence": 0.88,
  "zenithRgb": [48, 91, 145],
  "horizonRgb": [221, 157, 124],
  "luminance": 0.62,
  "saturation": 0.54,
  "warmth": 0.73,
  "cloudOpacity": 0.66,
  "cloudDarkness": 0.42,
  "haze": 0.31,
  "horizonContrast": 0.58,
  "sunGlow": 0.81,
  "stormConfidence": 0.10
}
```

All numeric fields are clamped and validated by deterministic code after model output. Model text is never trusted directly as renderer configuration.

## 7. Quality and confidence gates

Reject or strongly down-weight frames when:

- the frame is stale;
- the camera is offline;
- sky occupies too little of the image;
- exposure is clipped/overexposed;
- the image is mostly indoors/road/buildings;
- there is a frozen/static frame;
- analysis confidence is low;
- one camera materially disagrees with the valid Bangkok consensus without supporting local-weather evidence.

Use robust aggregation rather than a raw average. Median/trimmed aggregation is preferred for color/luminance values, with directional weighting applied afterward.

## 8. Smoothing

The live PWA must not change color violently because a single cloud crosses one camera.

Use an exponential/rolling smoothing window equivalent to approximately **5–10 minutes** for ordinary visual calibration.

Allow faster convergence only when independent weather evidence supports rapid change, for example:

- incoming thunderstorm;
- heavy rain beginning;
- abrupt visibility loss;
- sunrise/sunset transition where the solar geometry is changing quickly.

The client should also interpolate between calibration vectors rather than snapping colors.

## 9. Calibration payload

The public Worker endpoint returns derived values only, for example:

```json
{
  "schema": 1,
  "observedAt": "2026-08-27T11:10:00Z",
  "expiresAt": "2026-08-27T11:20:00Z",
  "confidence": 0.82,
  "mode": "sunset-west",
  "sources": [
    {"id":"bang-yi-khan-west-317474","fresh":true,"weight":0.64},
    {"id":"central-reference-1","fresh":true,"weight":0.21}
  ],
  "visual": {
    "zenithRgb": [44, 72, 112],
    "horizonRgb": [231, 151, 111],
    "luminance": 0.56,
    "saturation": 0.48,
    "warmth": 0.78,
    "cloudOpacity": 0.71,
    "cloudDarkness": 0.51,
    "haze": 0.29,
    "horizonContrast": 0.50,
    "sunGlow": 0.74
  }
}
```

No raw camera frame or identifiable street imagery is returned to the PWA.

## 10. Client/renderer integration

The renderer remains physically driven first, camera-calibrated second.

The calibration layer may modify only bounded visual parameters. It must not replace normalized weather mechanics.

Initial safe integration order:

1. cloud opacity/contrast/darkness calibration;
2. fog/haze visual calibration where consistent with weather/PM2.5;
3. zenith/horizon color calibration;
4. sunrise/sunset directional glow calibration;
5. confidence-aware interpolation and fallback.

The long-term renderer target is explicit runtime shader uniforms for camera-derived zenith/horizon color and glow, rather than a full-page CSS filter.

## 11. Failure and fallback

If the camera system is unavailable, stale, low-confidence, rate-limited or legally disabled:

```text
camera confidence -> 0
Open-Meteo + astronomy + AirBKK continue exactly as today
```

The PWA must never display an error merely because live-sky calibration is unavailable. This feature is an enhancement layer.

## 12. Security / privacy / retention

- Camera fetching and analysis are server-side.
- No employee/device camera is used.
- No user location is sent to a third-party camera provider.
- Raw frames are transient and not persisted.
- Derived observations may be retained for QA/trend comparison.
- Do not intentionally analyze people, faces, licence plates or other street-level identity information.
- Prefer sky/horizon crops and public infrastructure cameras.

## 13. Source references used for this decision

- OpenCCTV Bangkok camera index: `https://opencctv.org/cameras/thailand/bangkok`
- Example west-facing image feed page: `https://opencctv.org/cameras/thailand/bangkok/bang-yi-khan-subdistrict/bang-yi-khan-subdistrict-west-saphan-krung-thon-sang-hee-dbf-apartments-by-the-river-krung-thon-bridge-sang-hi-chao-phraya-317474`
- SkylineWebcams Bangkok skyline reference: `https://www.skylinewebcams.com/en/webcam/thailand/central-thailand/bangkok/bangkok-crossroads.html`
- Sathorn/Silom 24/7 livestream reference: `https://www.youtube.com/watch?v=uDV_qKiXRVU`
- Cloudflare Workers AI vision tutorial: `https://developers.cloudflare.com/workers-ai/guides/tutorials/llama-vision-tutorial/`
- Cloudflare Workers AI JSON mode: `https://developers.cloudflare.com/workers-ai/features/json-mode/`

## 14. Release discipline

This is a consequential executable/backend change. Implementation follows the normal branch → validation → Cloudflare preview/backend validation → smoke test → PR → merge → production verification discipline.

Do not make live sky calibration a blocking dependency for the current production renderer until confidence/fallback testing passes.