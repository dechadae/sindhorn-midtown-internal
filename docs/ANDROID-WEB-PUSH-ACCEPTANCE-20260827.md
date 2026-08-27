# Android Web Push acceptance — 27 August 2026

## Result

Physical Android Web Push delivery passed on an installed Sindhorn Midtown PWA without reinstall.

Observed acceptance evidence:

- employee enabled Environmental Alerts from the installed PWA;
- production D1/Web Push subscription was accepted;
- a one-shot bilingual English-first sample notification was sent through the production Cloudflare Worker;
- Android received and displayed the notification in the system notification shade;
- Sindhorn Midtown app icon/identity rendered with the notification;
- English title/body appeared first with Thai immediately supporting;
- receipt succeeded while Android Do Not Disturb was enabled, confirming delivery into the notification system even though audible/heads-up behavior remains OS-controlled.

## Remaining notification acceptance

- tap/deep-link behavior to `/details` still requires explicit physical confirmation;
- iOS/iPadOS installed-PWA subscription and delivery remain unverified until a physical Apple device is tested.

## Cleanup

The one-shot sample endpoint/token is temporary acceptance plumbing only. It must be removed from the production Worker after this test so normal operation returns to threshold-driven environmental notifications only.
