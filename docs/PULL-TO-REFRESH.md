# Pull-to-refresh

The installed Sindhorn Midtown PWA must provide an app-owned pull-down refresh gesture on iOS and Android rather than relying on inconsistent browser-native pull-to-refresh behavior.

This specialist document is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Final contract

- Gesture engine belongs to the stable Cloudflare bootstrap shell.
- Start only when the active route is already at scroll position 0.
- Track a single-finger downward gesture and ignore horizontal swipes.
- Preserve normal scrolling when the page is not at the top.
- Show three states: `Pull to refresh`, `Release to refresh`, `Refreshing`, with Thai supporting/operational copy.
- The indicator must use the **same glass material tokens as the persistent header/footer**: same base opacity, border opacity, blur/saturation family and restrained shadow. It must not appear as a visually solid pill.
- On release after threshold, refresh the current environmental data sources (AirBKK and Open-Meteo) and revalidate the current Supabase UI-pack manifest if appropriate.
- Do **not** require a full document reload merely to refresh live data in the final persistent-shell architecture.
- Keep the current Today / Guidance / Details route and preserve WebGL continuity.
- The gesture must work in installed PWA mode on Android and iOS/iPadOS.
- Normal releases must never require uninstall/reinstall; service-worker/core-shell updates use the standard update lifecycle and Supabase presentation changes update through the remote UI pack.
