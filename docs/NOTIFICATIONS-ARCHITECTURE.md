# Sindhorn Midtown PWA Notification Architecture

This specialist document is subordinate to `docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md`.

## Objective

Provide useful lock-screen notifications for installed Sindhorn Midtown web-app users without requiring a native app and without making Supabase a notification-runtime dependency.

The final app may use Supabase for rapidly editable UI/content/configuration, but the notification backend remains Cloudflare-native.

## Capability

The installed PWA uses standards-based Web Push through its persistent service worker. Notifications may appear on the device Lock Screen / notification center when the employee has explicitly granted notification permission and the operating system allows them.

The PWA must not rely on browser-side periodic polling while closed. Periodic Background Sync is not sufficiently portable or guaranteed for a critical employee alerting mechanism.

## Cross-platform support requirement

This feature must work on both supported mobile platforms through standards-based Web Push and capability detection rather than browser-name detection.

### iOS / iPadOS

- Target iOS/iPadOS 16.4 or newer for Web Push.
- The site must be installed as a Home Screen web app before push can be enabled.
- The manifest must continue to use standalone/fullscreen app behavior.
- Notification permission must be requested only in direct response to an employee action such as tapping `AIR QUALITY ALERTS`.
- Once granted, notifications can appear on the Lock Screen and Notification Center and participate in Focus settings like other applications.
- Use standards-based `PushManager`, service-worker `push`, and `showNotification()`.
- Do not require Apple Developer Program membership for standards-based Web Push.

### Android

- Support modern Chromium-based installed PWAs using the same Push API / Notifications API / service-worker implementation.
- Permission UX remains employee-initiated rather than automatically prompting on first launch.
- Notifications may be presented on the Lock Screen subject to Android notification settings, battery policies, Focus/Do Not Disturb and user preferences.
- Do not depend on a native foreground service or continuously running browser process.

### Shared implementation rule

Use capability detection such as service-worker, Notification API and `registration.pushManager` availability. If a capability is unavailable, hide or disable the opt-in control with a clear bilingual explanation rather than attempting a broken subscription flow.

## Canonical architecture

```text
AirBKK ----------------------\
                              \
Open-Meteo ------------------> Cloudflare scheduled Worker
                                |
                                | normalize + compare state
                                | apply notification policy
                                v
                         Web Push delivery
                                |
                                v
                         PWA service worker
                                |
                                v
                      OS lock-screen notification
```

### Cloudflare components

- Cloudflare Pages hosts the stable installed bootstrap shell.
- A Cloudflare Worker runs on a scheduled trigger to fetch official environmental data.
- D1 is preferred for durable push-subscription records and notification-state history. KV is acceptable for small current-state/cache records.
- Web Push uses VAPID credentials stored only as Cloudflare secrets.
- No Supabase database is required for notification subscriptions/delivery.

## Notification policy

Notifications are for meaningful changes, not every polling cycle.

Recommended default triggers:

1. Air-quality category worsens across a health threshold.
2. Air-quality category improves back into a safer category after a prior warning.
3. Severe or operationally relevant weather begins or is imminent.
4. Data source has been unavailable long enough that staff should know the displayed reading may be stale.

Do not notify for small PM2.5/AQI numeric movement within the same category.

## Bilingual notification hierarchy

Notifications are operational communication, therefore they use the Thai-first comprehension exception.

Example:

```text
คุณภาพอากาศเริ่มมีผลกระทบ
AQI HAS WORSENED

PM2.5 42 µg/m³ · AQI 86
ควรลดกิจกรรมกลางแจ้ง โดยเฉพาะกลุ่มเสี่ยง
Reduce prolonged outdoor activity, especially for sensitive groups.
```

The application itself retains the governing visual rule: **English typography is eminent. English defines the premium editorial composition; Thai guarantees operational understanding.** Lock-screen warnings prioritize comprehension over editorial hierarchy.

## Permission UX

Never request notification permission on first launch.

Use an explicit in-app action such as:

```text
AIR QUALITY ALERTS
แจ้งเตือนคุณภาพอากาศ
```

Explain the value first, then request permission only after the employee taps to enable alerts.

On iOS, if the site is not installed as a Home Screen web app, explain that installation is required before notifications can be enabled. On Android, use the same control and standards-based permission flow.

The app must remain fully usable if permission is denied.

## Service-worker behavior

On `push`:

- validate payload shape;
- show one bilingual OS notification;
- use a stable `tag` for each alert class so repeated updates replace rather than stack unnecessarily;
- attach the relevant app route as notification data;
- optionally update app badge state where supported.

On `notificationclick`:

- focus an existing Sindhorn Midtown PWA window if available;
- otherwise open the installed app;
- navigate to the relevant route (`/`, `/guidance`, or `/details`) without breaking the persistent-shell model.

## Zero-reinstall requirement

Push permission and subscription state must survive normal application updates.

Freeze the production origin, manifest identity/scope and service-worker scope before broad employee rollout. Routine Supabase UI-pack changes and normal core-shell upgrades must not require users to reinstall or re-enable notifications.

A deliberate origin move is outside the normal update model and should be completed before broad installation.

## Reliability and privacy

- Push subscriptions are device/browser capability URLs and must be treated as protected data.
- Store only the minimum subscription metadata needed for delivery and lifecycle cleanup.
- Remove expired/invalid subscriptions after push-service rejection.
- Do not use silent push for tracking or hidden continuous polling.
- The scheduled backend is the source of background freshness; the phone is not expected to run AirBKK/Open-Meteo fetch loops while closed.

## Scope limitation

This architecture supports native-style OS notifications and lock-screen delivery. It does not promise iOS Live Activities, Android native foreground services, or continuously updating lock-screen widgets; those require native-platform capabilities beyond a standards-based PWA.

## Implementation sequence

1. Complete the persistent Cloudflare bootstrap + Supabase Sindhorn UI-pack migration.
2. Stabilize the final CI/bilingual UI and zero-reinstall shell update lifecycle.
3. Add notification preference surface to Details or a dedicated Settings sheet through the Supabase UI pack.
4. Preserve/complete service-worker `push` and `notificationclick` handlers in the stable shell.
5. Add VAPID public-key subscription flow with cross-platform capability detection.
6. Add Cloudflare Worker + D1 subscription API.
7. Add scheduled AirBKK/Open-Meteo evaluation job.
8. Add category-change deduplication and bilingual notification templates.
9. QA Android installed PWA and iOS 16.4+ Home Screen PWA, including denied permission, Focus/Do Not Disturb, offline state, expired subscriptions, notification replacement tags, notification deep links and a real shell upgrade without reinstall.
