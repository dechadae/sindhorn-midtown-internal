# Notification Messages Inbox — Architecture Override

**Status:** User-approved architecture override  
**Date:** 27 August 2026  
**Scope:** footer navigation, notification history, Web Push receiver and UI-pack route model

This document records the later product decision to add a **Messages** footer chip for Environmental Alerts. It supersedes the three-route-only clause in section 5 of `FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md` wherever the notification inbox is concerned. All other final-plan rules remain in force.

## Product decision

The persistent footer now has four application destinations:

1. `/` — Today
2. `/guidance` — Guidance
3. `/details` — Details
4. `/messages` — Messages / notification history

Messages is a real route, not a shortcut to Details.

## Authority split

GitHub / Cloudflare owns executable notification-inbox infrastructure:

- `/messages` SPA routing support;
- service-worker storage of received push payloads;
- device-local IndexedDB notification history;
- unread-count calculation;
- notification-click read state;
- inbox rendering/client behavior;
- offline fallback route support.

Supabase UI packs own presentation:

- `messages.html` markup;
- the footer Messages chip;
- badge/card/empty-state CSS;
- bilingual copy and spacing.

## Storage and privacy model

The Messages inbox is **device-local**. Only notifications actually received by that installed browser/PWA are stored in IndexedDB.

- No employee account is required.
- No device notification history is uploaded to Supabase.
- The inbox stores the normalized push payload and receipt timestamp only.
- Maximum retained history is 50 messages per browser profile.
- Clearing site data clears the local inbox.
- Opening Messages marks locally retained messages as read.
- A notification tap marks that message read and keeps the existing safe deep-link behavior.

The Cloudflare push backend continues to decide when a meaningful environmental alert should be sent. The Messages route does not change alert thresholds or environmental authority.

## Navigation and badge behavior

- Footer has four compact chips and must remain safe on narrow mobile screens.
- Messages may show a small unread badge.
- English remains first; Thai immediately supports the Messages page and accessible navigation label.
- The footer remains a persistent shell host and must not restart the WebGL environment.

## Offline and zero-reinstall behavior

Shell version 17 adds Messages route capability while preserving the existing PWA identity, origin, manifest id/start URL/scope and service-worker scope.

Service-worker v22 precaches the Messages inbox client and fallback route. Normal installed users must receive this through the existing service-worker update lifecycle; **no reinstall is required**.

During rollout, shell 17 must remain compatible with production Pack 37. Pack 38 is staged with `minimumShell: 17` and stays disabled until the new shell is verified in production. Then Pack 38 can be atomically enabled to expose the fourth footer chip.

## Release sequence

1. Stage Pack 38 disabled in Supabase.
2. Validate shell 17 + service-worker v22 + local inbox on a dedicated branch preview.
3. Merge only after preview gates pass.
4. Verify production Pages promotion and launch-hardening checks while Pack 37 is still active.
5. Atomically disable Pack 37 and enable Pack 38.
6. Verify four-chip footer, `/messages`, empty state and badge behavior in production.
7. Confirm the next real environmental push is both displayed by Android/iOS and persisted into Messages.

## Acceptance

Technical acceptance requires:

- Pack 38: 9 rows total, 8 manifest resources, all hashes exact, `minimumShell: 17`;
- `/messages` route works without document reload;
- received pushes persist locally even when the PWA is closed;
- unread badge updates when a push arrives while the PWA is open;
- opening Messages clears the unread count without deleting history;
- Clear all removes local history only;
- threshold-driven Web Push behavior remains unchanged;
- Today/Guidance/Details, live atmosphere, current location, pull-to-refresh, offline boot and zero-reinstall behavior do not regress.
