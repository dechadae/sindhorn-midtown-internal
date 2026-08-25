# Pull-to-refresh

The installed Sindhorn Midtown PWA must provide an app-owned pull-down refresh gesture on iOS and Android rather than relying on browser-native pull-to-refresh behavior.

## Contract

- Start only when the page is already at scroll position 0.
- Track a single-finger downward gesture and ignore horizontal swipes.
- Show a restrained Sindhorn/Flipgazine-style frosted indicator with three states: Pull to refresh, Release to refresh, Refreshing.
- Crossing the threshold and releasing reloads the current route (`/`, `/guidance`, or `/details`) so both AirBKK and Open-Meteo are fetched again through their existing no-store/live-data paths.
- The gesture must work in installed PWA mode on Android and iOS/iPadOS.
- Do not require uninstall/reinstall after release; bump the service-worker shell version so installed clients receive the implementation.
- Preserve normal scrolling when the page is not at the top.
