# Sindhorn Midtown Internal — LINE Seed Sans TH Typography Architecture

**Status:** Mandatory production typography authority  
**Date:** 28 August 2026

## Decision

`LINE Seed Sans TH` is the one and only production type family for Sindhorn Midtown Internal, for both Latin/English and Thai.

The production app self-hosts exactly three WOFF2 faces:

- 100 — Thin: large premium atmospheric/display typography only.
- 400 — Regular: body copy, values, navigation and ordinary UI.
- 700 — Bold: emphasis, labels and controls where genuine emphasis is required.

No synthetic intermediate weight is part of the architecture. CSS must use only 100, 400 or 700.

## Global invariants

- `letter-spacing: 0` everywhere, including uppercase English labels.
- No English/Thai split font stack.
- No runtime Google Fonts, CDN, GitHub raw or other third-party font dependency.
- `font-synthesis: none` prevents browser-generated fake weights.
- The official Sindhorn Midtown / Vignette logo remains image artwork and is not re-typeset.
- Thai F&B campaign copy remains bilingual content, but it uses the same LINE Seed family as English.

## Delivery

`site/fonts.css` owns the three `@font-face` declarations and the canonical `--font-ui` token. The authenticated shell and standalone `login.html` both load it. The installed PWA precaches the stylesheet and all three WOFF2 files.

The regular 400 and thin 100 faces are preloaded on the authenticated shell because they are needed immediately for the body/UI and large atmospheric display. Bold 700 is loaded on demand.

## Regression gate

`site/font-architecture.test.mjs` fails release validation if production code reintroduces retired font families/assets, nonzero letter spacing, unsupported numeric weights, external runtime font hosting, or more than the approved three production font binaries.

## Editorial hierarchy — Pack 47

On 29 August 2026 the Today / Guidance / Reading Details presentation was deliberately reduced from many perceived type levels to six editorial roles. This is a hierarchy rule, not a new font architecture.

1. **Display** — `Breathe well`, `Guidance`, `Reading details`; LINE Seed Thin 100, one dramatic headline per major section.
2. **Primary metric** — PM2.5 and the secondary AQI/weather numerals; LINE Seed Thin 100, with PM2.5 remaining the dominant data point.
3. **Section headline** — interpretation such as `Very good`; Regular 400, sentence case, clearly subordinate to the display headline.
4. **Body** — route decks, guidance, explanations, disclaimers and reference prose; one shared reading size.
5. **Label** — small editorial/navigation labels such as `LIVE AIR QUALITY`, `TODAY’S GUIDANCE`, `PM2.5`, `THAI AQI`, buttons and tab labels.
6. **Meta** — timestamps, locations, qualifiers, weather metadata and scale references; one subdued supporting size.

Uppercase is reserved for true small editorial/navigation labels. Secondary content headings such as `For everyone`, `Sensitive groups`, field names and weather conditions use sentence case rather than creating additional typographic tiers.

Structural separation should come from spacing, rules and alignment before introducing another font size or weight. `Observation` in Reading Details remains an accessible heading but is visually hidden because the route title and deck already establish the context.

Pack 46 is the immediate rollback target for this presentation change.
