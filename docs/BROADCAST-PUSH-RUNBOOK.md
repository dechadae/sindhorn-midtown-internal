# Broadcast Push Runbook (r16b)

## Product contract

A broadcast published from Settings › Broadcast reaches its audience in Messages. If it is addressed to **Everyone** and has push enabled, every device that opted in to Web Push also receives one system notification. Tapping it opens Messages; the broadcast is read there and receipted through `sindhorn_broadcast_mark_read_v1`.

Push subscriptions are anonymous — a device, not an employee — so a broadcast targeted to a department, role, group or person is **never pushed**. It appears in Messages for its audience only. A **sensitive** broadcast pushes its title with the neutral body "Open Messages to read it."; the text is only ever shown inside the signed-in app.

The service worker does not store a broadcast push in the local Messages inbox; the server inbox is the record, so nothing is shown twice and a revoked broadcast disappears everywhere.

## Components

### Supabase bridge

`supabase/migrations/20260905083000_sindhorn_broadcast_push_bridge_v1.sql` (applied 5 Sep 2026)

- `public.sindhorn_broadcast_push_events` — one ledger row per broadcast: `not_configured`, `skipped` (+ reason `not_published` / `push_disabled` / `expired` / `targeted`), `queued` (+ `request_id`), or `error` (+ SQLSTATE). Transport only; never holds the URL or the token.
- `public.sindhorn_broadcast_queue_push(p_broadcast_id, p_force)` — reads the URL/token from Vault, queues one `pg_net` POST. Executable by `service_role` only.
- Trigger `sindhorn_broadcast_push` — fires when a row becomes `published`; a transport failure is a warning, never a rollback of the publish.
- `public.sindhorn_broadcast_release_due()` — flips due `scheduled` rows to `published` (the stamp trigger keeps `publish_at`, records `published_at`), which fires the push. Scheduled by `pg_cron` job `sindhorn-broadcast-release-due` every minute.

### Alerts Worker

`worker/src/index.js` — `POST /broadcast-published`

Validates the private bearer token, validates the reduced broadcast (`id` uuid, `titleEn` ≤ 120, `bodyEn` ≤ 240 or null, `priority`, `publishedAt`), deduplicates by broadcast id in D1 `broadcast_dispatches`, and sends `{kind:'broadcast', tag:'broadcast:<id>', route:'/messages'}` through the existing subscription/VAPID path. `/health` reports `broadcastPushConfigured`.

### Installed PWA

`site/sw.js` (`v86-fnb-r16b`) shows the notification, skips local storage for `kind === 'broadcast'`, and posts `SINDHORN_NOTIFICATION_STORED` with the kind. `site/shell.js` refetches the broadcast inbox on that message so the badge is right; `site/messages-page.js` refetches the list.

## Required secrets

Never commit secret values or the production endpoint to GitHub. Both halves must match.

Worker secret (Cloudflare → Workers → `sindhorn-midtown-alerts` → Settings → Variables and Secrets):

- `BROADCAST_PUSH_TOKEN` — a long random string (e.g. `openssl rand -base64 48`).

Supabase Vault (Dashboard → Project Settings → Vault):

- `sindhorn_broadcast_push_url` — `https://sindhorn-midtown-alerts.decha-dae.workers.dev/broadcast-published`
- `sindhorn_broadcast_push_token` — the same value as `BROADCAST_PUSH_TOKEN`.

## Release order

1. Deploy the Worker (the `Phase 6 Web Push Release` workflow does this on any `worker/**` change on `main`). Until the secret exists, the endpoint answers `503 broadcast_push_unavailable`.
2. Confirm `GET /health` shows `"broadcastPushConfigured": false` and everything else unchanged.
3. Add `BROADCAST_PUSH_TOKEN` to the Worker; `/health` flips to `true`.
4. Add both Vault entries.
5. The bridge migration is already applied; nothing to re-run. Publishing an Everyone broadcast from Settings › Broadcast queues the request. Check the ledger:

   ```sql
   select b.title_en, e.status, e.reason, e.request_id, e.queued_at
   from public.sindhorn_broadcast_push_events e
   join public.sindhorn_broadcasts b on b.id = e.broadcast_id
   order by e.created_at desc limit 10;
   ```

   and the transport result in `net._http_response` for that `request_id`.

6. Expect one system notification on an opted-in test device and the row unread in Messages.

Do not publish a real broadcast just to test transport. Use a short test broadcast, then revoke it.

## Idempotency

The Supabase ledger has a unique `broadcast_id`; the Worker D1 table has the same id as primary key. Re-queueing with `p_force` cannot fan out a second notification once the Worker has accepted the id.

## Failure behaviour

- Vault empty → ledger `not_configured`, no outbound request, publish commits.
- `pg_net` raises → ledger `error` with SQLSTATE only.
- Worker rejects (401/400) → the request row in `net._http_response` shows it; the ledger stays `queued` because the queueing succeeded. Fix the secret, then retry.
- Expired subscriptions are removed by the existing push path; others deliver independently.

## Retry

`select public.sindhorn_broadcast_queue_push('<broadcast id>', true);` as `service_role`. Check first that the broadcast is still published, still addressed to Everyone, and that the Worker did not already accept the id (D1 `broadcast_dispatches`).

## Rollback

1. `select cron.unschedule('sindhorn-broadcast-release-due');` stops automatic release of scheduled broadcasts (they still show in Messages when due through `sindhorn_broadcast_inbox_v1`).
2. `drop trigger sindhorn_broadcast_push on public.sindhorn_broadcasts;` stops queueing. Keep the ledger.
3. Remove or rotate `BROADCAST_PUSH_TOKEN` to close the endpoint. Environmental and business pushes are unaffected.
