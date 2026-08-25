# Sindhorn Midtown Internal — English-First Bilingual Override

**Approved:** 25 August 2026  
**Status:** Current language-order authority

This file records a later approved product decision made during the v15 hybrid-shell migration.

## Rule

> **The application remains fully bilingual, but English comes first throughout the entire app. Thai follows immediately as supporting translation.**

This supersedes every earlier rule that made Thai first for health guidance, actionable instructions, warnings, errors/recovery, permissions, operational information, safety/medical disclaimers, or Web Push notifications.

## Applies to

- Today, Guidance and Details routes
- header/footer/navigation
- live PM2.5/AQI status
- weather labels
- health guidance
- actionable instructions
- warnings and unavailable states
- recovery/error text
- permission/operational UI
- pull-to-refresh
- Save/Share feedback
- disclaimers
- Web Push notification title and body

## DOM/read order

When both languages are present, English must precede Thai in source/DOM/read order. Do not rely only on CSS visual reordering.

## Typography

- English / Latin: Vignette Sans
- Thai: Noto Sans Thai
- Official hotel/Vignette logo remains artwork

Thai remains clearly legible and directly associated with its English counterpart. It must not be reduced to decorative microcopy.

## Architecture impact

This is primarily presentation/copy policy and belongs in the Supabase UI-pack layer. Stable shell surfaces that exist before the UI pack loads, such as skip/recovery copy and service-worker notification composition, must follow the same English-first rule.

No language selector is required.
