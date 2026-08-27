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

## Messages inbox rollout

After Android delivery acceptance, the notification experience was extended with a fourth persistent footer destination: **Messages**.

Production Pack 38 provides the Messages footer chip and bilingual inbox presentation. Shell 17 / service-worker v22 persist future received push payloads locally in IndexedDB, retain up to 50 messages per browser profile, show an unread badge, mark messages read when the inbox is opened or a notification is tapped, and allow local history to be cleared without uploading it.

The sample notification above predates service-worker v22 and therefore is not expected to appear retroactively in Messages. The next real environmental push received after v22 activation is the acceptance event for inbox persistence.

## Remaining notification acceptance

- tap/deep-link behavior to `/details` still requires explicit physical confirmation;
- persistence of the next real Web Push into the Messages route still requires physical confirmation;
- iOS/iPadOS installed-PWA subscription, delivery and Messages persistence remain unverified until a physical Apple device is tested.

## Cleanup

The one-shot sample endpoint/token was temporary acceptance plumbing only. It has been removed from the production Worker and release workflow. Normal operation is threshold-driven environmental notifications only.
