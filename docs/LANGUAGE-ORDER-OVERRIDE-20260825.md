# Language order override — 25 August 2026

> **SUPERSEDED — 28 August 2026.** The interface is now **English-only**. The
> bilingual pairing described below was removed from every interface surface:
> nav, headings, labels, buttons, status lines, alerts, push notifications,
> login, account and admin. A language-switch feature is planned, and it will
> *select* a language rather than render both at once — so the "English first,
> Thai immediately after" pairing rule no longer applies to new work.
>
> Two things from this document still stand:
>
> - Thai **content** is unaffected. F&B promotion copy remains bilingual in
>   `site/fnb-data.js`, because that Copy section exists to give the designer
>   both language versions to set into artwork. Both the English and Thai campaign copy use the same self-hosted
>   `LINE Seed Sans TH` family.
> - Remote Supabase packs remain versioned and immutable: publish a new pack
>   version rather than mutating a deployed one.
>
> The rest of this file is kept as the record of the decision it replaced.

This document is the latest language-order authority for Sindhorn Midtown Internal and overrides earlier Thai-first exceptions in older planning text.

## Final rule

The application is bilingual **English first throughout**.

- English appears first in DOM/read order and is visually primary.
- Thai follows immediately as direct operational support.
- This applies to navigation, status, health guidance, actionable instructions, warnings, errors, recovery states, permissions, safety/medical disclaimers, pull-to-refresh states, save/share feedback and push notifications.
- Critical information must remain understandable without a language selector.
- English and Thai both use the single self-hosted `LINE Seed Sans TH` family. Production weights are 100 / 400 / 700, and every text treatment uses `letter-spacing: 0`.
- The official Sindhorn Midtown / Vignette lockup remains artwork and is never re-typeset.

## Implementation contract

For paired instructional copy, use English before Thai in source markup. The stable shell also includes a small `bilingual.css` contract that preserves English-first visual ordering for `.instruction-copy` even if a future UI pack accidentally changes flex ordering.

Web Push title/body composition is English first, then Thai. Plain-text push payload fallback is treated as English.

## Remote UI packs

Every future Supabase app pack must preserve this language order. Pack publication remains versioned and immutable: edit a new pack version rather than silently mutating an already deployed pack. The v15 loader validates pack version, content type and SHA-256 integrity before activation.
