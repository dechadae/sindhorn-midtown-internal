# Language order override — 25 August 2026

This document is the latest language-order authority for Sindhorn Midtown Internal and overrides earlier Thai-first exceptions in older planning text.

## Final rule

The application is bilingual **English first throughout**.

- English appears first in DOM/read order and is visually primary.
- Thai follows immediately as direct operational support.
- This applies to navigation, status, health guidance, actionable instructions, warnings, errors, recovery states, permissions, safety/medical disclaimers, pull-to-refresh states, save/share feedback and push notifications.
- Critical information must remain understandable without a language selector.
- English uses Vignette Sans; Thai uses Noto Sans Thai.
- The official Sindhorn Midtown / Vignette lockup remains artwork and is never re-typeset.

## Implementation contract

For paired instructional copy, use English before Thai in source markup. The stable shell also includes a small `bilingual.css` contract that preserves English-first visual ordering for `.instruction-copy` even if a future UI pack accidentally changes flex ordering.

Web Push title/body composition is English first, then Thai. Plain-text push payload fallback is treated as English.

## Remote UI packs

Every future Supabase app pack must preserve this language order. Pack publication remains versioned and immutable: edit a new pack version rather than silently mutating an already deployed pack. The v15 loader validates pack version, content type and SHA-256 integrity before activation.
