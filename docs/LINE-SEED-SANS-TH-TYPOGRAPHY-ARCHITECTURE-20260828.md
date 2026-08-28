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
