# Bangkok Seasonal Sky + Cloud Architecture — Override

**Status:** Approved next architecture  
**Date:** 27 August 2026  
**Repository:** `dechadae/sindhorn-midtown-internal`  
**Production:** `https://sindhorn-midtown-internal.pages.dev/`

This is the latest approved atmosphere-input decision. It supersedes `docs/LIVE-BANGKOK-SKY-CALIBRATION-ARCHITECTURE-OVERRIDE-20260827.md` for the production rendering path. The earlier live-camera work remains preserved as research/future adaptation only.

All other product rules remain unchanged: English first with Thai immediately supporting, AirBKK authority for PM2.5 / Thai AQI, Open-Meteo authority for current local weather, local astronomy for sun/moon geometry, Supabase atomic UI packs, zero-reinstall PWA updates, Web Push, Messages, and branch → preview → PR → production verification for consequential executable changes.

## 1. Product decision

Do not depend on third-party Bangkok webcams or Cloudflare Workers AI for normal production atmosphere rendering.

The production renderer will use a deterministic **Bangkok Seasonal Sky Profile** plus the current physical environment:

```text
DEVICE LOCATION + LOCAL TIME
        |
        +--> LOCAL ASTRONOMY ---------------------- authoritative sun/moon geometry
        |
        +--> OPEN-METEO --------------------------- authoritative current weather mechanics
        |
        +--> BANGKOK SEASONAL SKY PROFILE -------- annual color/cloud prior
        |
        +--> AIRBKK ------------------------------- authoritative PM2.5 / Thai AQI
        |
        v
CURRENT WEATHER MODULATES SEASONAL PRIOR
        |
        v
SKY COLOR + CLOUD MORPHOLOGY + SOLAR LIGHTING
        |
        v
PRECIPITATION / FOG / STORM -> PM2.5 OPTICS -> UI
```

The seasonal profile is a **prior**, never a fake weather state. Actual current weather always wins on cloud amount, precipitation, storm/fog mechanics and visibility.

## 2. Why the live-camera production path is deferred

The first automated camera set was technically live but visually unsuitable: bridge/river frames contained too little clean sky, image quality was inconsistent, and the view geometry was poor for reliable atmosphere calibration.

Higher-quality 360° rooftop feeds are a promising future direction, especially when the camera geometry is known, but sourcing/licensing/calibration is too much complexity for the current release.

Cloudflare Workers AI also proved unsuitable as a permanent realtime dependency because the free daily neuron allocation can be exhausted. Production atmosphere must not depend on daily AI quota.

Therefore:

- live-camera calibration is deferred, not deleted;
- existing camera/AI code may be preserved for future experimentation;
- production must not require camera confidence or Workers AI availability;
- no Cloudflare AI allocation is required for the seasonal architecture.

## 3. Authority boundaries

### 3.1 Astronomy

Local astronomy controls:

- solar altitude;
- solar azimuth;
- sunrise/sunset/twilight progression;
- lunar altitude/azimuth and phase presentation.

Seasonal profiles may change colors and lighting response but never move the sun or moon.

### 3.2 Open-Meteo

Open-Meteo remains authoritative for:

- WMO weather code;
- cloud-cover baseline;
- precipitation/rain/showers/snowfall where applicable;
- humidity;
- wind;
- visibility;
- temperature/apparent temperature;
- severe-weather state.

A December profile may allow pink/purple twilight, but if current weather is an opaque overcast deck the renderer must show the overcast deck rather than a fake clear-magenta sunset.

### 3.3 AirBKK

AirBKK remains authoritative for PM2.5 and Thai AQI. PM2.5 may alter optical haze, extinction, blue saturation and sun diffusion, but seasonal color priors may never invent or alter the numeric pollution reading.

### 3.4 Bangkok Seasonal Sky Profile

The seasonal profile controls only visual priors such as:

- zenith hue tendency;
- horizon hue tendency;
- sunrise pastel strength;
- sunset warm intensity;
- pink/magenta potential;
- lilac/violet twilight potential;
- aerosol-warmth tendency;
- haze desaturation tendency;
- post-sunset color persistence;
- cloud-light color tendency.

The profile is interpolated continuously by day-of-year. There must be no visible palette jump at month boundaries.

## 4. Bangkok seasonal baseline

Use twelve monthly control points or an equivalent continuous annual curve. The following seasonal families are the approved art-direction baseline.

### November–February — cool/dry Bangkok

- sunrise: lavender-blue → pale rose / peach;
- sunset: amber → peach → rose → magenta/lilac → violet;
- stronger pink/purple potential than the rest of the year;
- broken mid/high cloud can carry pink/lilac undersides;
- horizon may retain soft aerosol haze even when upper sky is relatively clear.

December–February must be capable of the familiar Bangkok pinkish/purple twilight seen in winter reference photography, but must not force it every day.

### March–April — hot/dry Bangkok

- sunrise: pale apricot / warm cream;
- sunset: amber / orange / copper / dusty rose;
- generally less violet richness than the cool season;
- stronger heat/haze softening and lower contrast;
- cloud illumination is warm but often bleached rather than saturated.

### May–June — monsoon onset

- cool gray-blue base with peach/gold openings;
- growing convective cloud structure;
- localized warm light under/through cloud rather than a whole-sky orange wash.

### July–September — wet/monsoon

- dominant blue-gray / slate / violet-gray cloud masses;
- heavier low/mid cloud bodies and darker bases;
- warm coral/gold appears selectively beneath cloud decks or through breaks;
- storm structure and precipitation dominate any seasonal beauty palette.

### October — transition

- decreasing rain frequency;
- clearer pastel peach/pink sunrise potential;
- gold → rose/violet sunset after showers/storm clearing;
- cleaner post-rain atmosphere may increase contrast.

## 5. Solar-altitude color progression

Seasonal color is evaluated against actual solar altitude, not fixed clock hours.

A cool-season sunset may progress approximately as:

```text
sun +4°   pale blue / warm cream
sun +1°   gold / peach
sun  0°   salmon / rose
sun -2°   rose / magenta potential
sun -4°   pink-lilac / violet potential
sun -6°   deep violet-blue twilight
```

The exact hue/intensity is modulated by current cloud cover, humidity, visibility, AirBKK haze and current weather code.

Sunrise is not simply a reversed sunset. Bangkok winter sunrise should generally be softer, paler and more pastel: lavender/blue → rose/peach → daylight.

## 6. Phase 8.2 cloud morphology architecture

The main visual gap is cloud structure and cloud lighting, not only sky color.

Cloud rendering should move from generic procedural haze toward **Bangkok seasonal cloud morphology** using three conceptual depth families.

### 6.1 High veil / cirrus

- thin, soft structure;
- low opacity;
- catches sunrise/sunset color early;
- useful for pink/lilac winter twilight;
- never rendered as hard fluffy sprites.

### 6.2 Mid cloud layer

- primary broken cloud bodies for partly cloudy conditions;
- carries most seasonal sunset/sunrise illumination;
- preserves open sky between masses when cloud cover permits;
- directional solar lighting creates warm sun-facing edges / undersides and cooler ambient faces.

### 6.3 Low convective / monsoon layer

- thicker, larger cloud bodies;
- darker lower bases;
- stronger vertical depth and connected structures;
- used more heavily during May–October, showers and thunderstorms;
- warm horizon light appears selectively through/below cloud, not as a uniform tint.

## 7. Cloud lighting rules

Cloud lighting must be tied to real solar altitude and azimuth.

Required behaviors:

- sun-facing edges can brighten when geometrically plausible;
- low sun warms undersides and horizon-facing cloud surfaces;
- opposite/cloud-base faces remain cooler/darker;
- after sunset, upper ambient fill shifts toward blue/violet;
- overcast remains connected and broad rather than isolated puffs;
- rainy-season clouds may have deep slate/blue-gray bases with narrow coral/gold light leaks;
- winter broken clouds may carry restrained pink/mauve/lilac without turning every cloud purple.

## 8. Weather-first cloud mechanics

Open-Meteo cloud cover and WMO state remain primary controls.

Examples:

- **Clear:** little/no cloud even if seasonal profile has beautiful sunset colors.
- **Partly cloudy:** discrete layered masses with genuine sky gaps.
- **Overcast:** connected dense deck; seasonal color can influence illumination but cannot reveal fake clear sky.
- **Rain/showers:** cloud mass + precipitation appropriate to intensity.
- **Thunderstorm:** large dark convective bodies, restrained lightning/illumination, localized warm breaks only if solar geometry allows.
- **Fog:** low-contrast veil distinct from cloud morphology and distinct from PM2.5 haze.

## 9. Haze / humidity integration

Bangkok atmosphere often softens distant clouds and horizon color.

- humidity and low visibility reduce distant cloud contrast;
- AirBKK PM2.5 reduces blue saturation and increases optical diffusion;
- horizon cloud/haze can be warmer and softer than the zenith;
- upper sky may remain cleaner than the low horizon;
- seasonal aerosol tendency is only a prior; actual AirBKK/visibility data wins.

## 10. Renderer implementation boundary

The renderer engine remains GitHub/Cloudflare executable code. Seasonal profile values may live in checked-in configuration or, where safe and validated, in the existing Supabase art-direction/configuration pack.

Do not require generative AI, computer-vision AI or third-party camera access for normal rendering.

The existing live-camera client/compositor must be disabled or made zero-influence in the production path when Phase 8.2 is released. Preserve it as future-adaptation code/documentation rather than deleting research history unless cleanup later proves desirable.

## 11. Performance / mobile rule

Maintain desktop-equivalent visual quality on mobile.

Do not solve performance by lowering mobile DPR, cloud complexity, celestial quality or animation cadence. Improve efficiency through renderer implementation, reuse, bounded layer count and avoiding redundant filtered DOM work.

## 12. Full-page capture parity

`SAVE FULL PAGE` must capture the same seasonal sky and cloud morphology visible in the live Today route. No separate simplified export palette is allowed.

## 13. Future live-camera adaptation

A future Sindhorn-controlled rooftop 360° sky camera remains the preferred live visual calibration upgrade.

If adopted later:

- camera geometry/azimuth must be known;
- sky-dominant calibrated crops/masks are required;
- deterministic pixel analysis is preferred over a vision LLM for color measurement;
- licensing/ownership must permit automated use;
- camera data remains an enhancement layer and never replaces Open-Meteo/AirBKK/astronomy authority;
- the seasonal model remains the robust fallback.

## 14. Release discipline

Phase 8.2 is a consequential renderer change.

Use:

```text
dedicated branch
→ syntax/structural tests
→ seasonal/weather fixture tests
→ Cloudflare Pages branch preview
→ visual smoke tests
→ PR
→ merge
→ production main workflow verification
→ physical Android/iOS visual QA
```

Do not claim the seasonal/cloud architecture is production-live until the production workflow passes.