# Business Dashboard Notification Runbook

## Product contract

Business update notifications are a downstream signal that an approved Today publication changed. They are not a second data authority and they must never contain confidential hotel figures or operational notes.

Employees continue to opt in through the existing Web Push control. The application must never request notification permission automatically.

All business notification deep links resolve to Today (`/`). Messages preserves the same event in the in-app inbox.

## Update categories

The publication bridge compares canonical source hashes with the previous publication:

- only `fnb_xlsx` changed → `fnb` → `F&B REPORT UPDATED`;
- only `rooms_pdf` changed → `rooms` → `ROOMS REPORT UPDATED`;
- both changed → `both` → `TODAY BUSINESS REPORT UPDATED`;
- neither changed → no business notification.

For a corrected publication on the same business date, the previous run is the run being replaced. For a newly inserted business date without an explicit supersession, the bridge compares with the most recent earlier publication.

## Components

### Supabase publication bridge

Migration:

`supabase/migrations/20260831045500_daily_business_dashboard_notification_bridge.sql`

Responsibilities:

- detect which canonical source changed;
- create a deterministic publication event ID;
- write transport-only audit metadata;
- read the endpoint/token from Supabase Vault;
- queue one asynchronous HTTPS request through `pg_net`;
- never block the publication transaction when transport is unavailable.

### Alerts Worker

`worker/src/index.js`

Endpoint:

`POST /business-update`

The Worker validates a private bearer token, validates the event shape, deduplicates by event ID, maps the domain to the correct notification kind/title, and sends through the existing subscription/VAPID infrastructure.

The Worker does not receive business report values. Its fallback copy contains only the business date/revision and a Today call to action.

### Installed PWA

`site/sw.js` stores the push event in the local Messages IndexedDB before showing the system notification. A notification click marks the local message read and opens Today.

`site/notification-inbox.js` maps the three business kinds into Messages.

## Required secrets

Never commit secret values or production endpoint configuration to GitHub.

Worker secret:

- `BUSINESS_UPDATE_TOKEN`

Supabase Vault secrets:

- `sindhorn_business_update_url` — full production `/business-update` endpoint;
- `sindhorn_business_update_token` — same bearer secret as the Worker secret.

The URL is in Vault as well so the database migration contains no production transport endpoint.

## Release order

The safe production release order is strict:

1. Keep the publication trigger unapplied while preview validation is underway.
2. Merge/deploy the compatible Alerts Worker so `/business-update` exists in production.
3. Verify Worker health and existing environmental push behavior.
4. Provision `BUSINESS_UPDATE_TOKEN` in the Worker secret store.
5. Provision the matching URL/token in Supabase Vault.
6. Apply the notification bridge migration.
7. Verify the trigger and audit table exist, without changing an existing publication.
8. Let the next normal approved daily publication exercise the bridge.
9. Confirm one audit row, one Worker dispatch identity and the expected in-app/system notification on an opted-in test device.

Do **not** republish an old report merely to create a notification. Initial rollout should not backfill historical business notifications.

## Idempotency

Event identity is deterministic and includes business date, revision, classified domain and run ID.

Two layers protect against duplicates:

- Supabase audit ledger has a unique `event_id`;
- Worker D1 `business_notification_dispatches.id` is the same event identity.

Retrying an event therefore cannot fan out repeated notifications after the Worker has already accepted it.

## Failure behavior

Publication is always more important than notification transport.

If Vault configuration is missing, the bridge records `not_configured` and returns without an outbound request.

If `pg_net` queueing raises an error, the ledger stores `error` plus SQLSTATE only. The trigger catches unexpected errors so a valid publication still commits.

If the Worker cannot deliver to an expired subscription, the existing push infrastructure removes that subscription. Other subscriptions continue independently.

## Retry

`public.sindhorn_business_queue_notification(run_id, previous_run_id, true)` is the controlled server-side retry primitive. It must not be exposed to ordinary authenticated users.

Before retrying, verify:

- the publication is still the intended approved run;
- the Worker endpoint and bearer secret are configured;
- the existing event was not already accepted/sent;
- the retry does not represent an obsolete historical publication.

Worker-side dedup remains the final safety boundary.

## Rollback

If business notifications misbehave after release:

1. Leave Today publications intact.
2. Disable/remove the Supabase publication trigger first so new publications stop queueing business pushes.
3. Keep the audit ledger for diagnosis.
4. If necessary, remove/rotate the Worker business-update token or disable the endpoint while preserving existing environmental notification behavior.
5. Fix in preview and re-enable only after the synthetic push, Messages, PWA and Worker contract suites pass.

Do not roll back the business dashboard data publication itself solely because notification transport failed.

## Validation gates

Before production enablement, require green checks for:

- dashboard 360×800, 390×844 and 768×1024;
- UI Library parity;
- reduced motion;
- persistent WebGL/Betta environment;
- installed PWA cache/controller;
- Messages mapping and Today deep links;
- synthetic Service Worker push storage/render contract;
- Worker payload normalization and dedup identity;
- notification bridge migration contract;
- absence of secret values and real hotel report data in repository changes.
