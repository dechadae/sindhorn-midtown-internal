# Installed PWA Warm-Startup Regression Audit

Date: 2026-09-01
Branch: `startup-warm-regression-audit`
Status: preview-only investigation

Observed product behavior:

- newly installed PWA reaches usable Today in about 2 seconds
- subsequent installed-PWA launches can take about 6 seconds

Objective: reproduce and isolate the additional warm-start delay without changing production behavior first.

This audit reuses the 2026-09-01 `audit-startup-phase0` instrumentation model against current `main` and separates four timing domains:

1. service-worker controlled navigation (`workerStart` → `responseStart`)
2. authenticated employee-profile / token-refresh network work
3. document/bootstrap/route mounting
4. Betta first frame → shared startup reveal

Primary hypotheses, in order:

1. network-first service-worker navigation adds a warm-launch round trip before HTML execution
2. authenticated startup blocks on `sindhorn_current_employee_profile` before bootstrap continues
3. service-worker activation/update can amplify startup with a second navigation
4. serial shell installation work is update/install cost rather than the ordinary warm-launch cause

No production merge is authorized by this audit. Any runtime fix must remain on a dedicated preview branch until Android installed-PWA measurements confirm improvement.
