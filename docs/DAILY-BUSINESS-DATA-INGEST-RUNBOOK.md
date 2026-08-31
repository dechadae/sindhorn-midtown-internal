# Daily Business Data Ingest Runbook

## Purpose

Today is an authenticated internal hotel business dashboard. Its canonical operational data is a versioned, approved Supabase publication assembled from the daily F&B workbook and Rooms pickup report supplied to ChatGPT.

The employee application is a reader only. There is no employee-facing report uploader in the initial architecture.

## Daily operating flow

1. Attach the current F&B workbook and Rooms pickup PDF to ChatGPT.
2. Ask ChatGPT to update the daily business data.
3. ChatGPT identifies each source by report type, report date, file hash and structural metadata before parsing values.
4. Parse each source into the normalized business schema without changing source meaning or inventing missing values.
5. Reconcile structural totals, subtotals, hierarchy relationships and source-date expectations.
6. Create a new `business_report_runs` revision in a non-published state.
7. Insert normalized F&B, Rooms, source-provenance and validation rows under that run ID.
8. Rebuild deterministic dashboard flags from `business_dashboard_rules`.
9. Reconcile database row counts and headline identities.
10. Mark the run approved only when blocking validation has passed. Warnings that are understood and preserved may remain as warnings.
11. Publish by pointing `business_dashboard_publications.business_date` to the approved run.
12. Today reads only the latest approved publication through `sindhorn_business_dashboard_read_model`.

Publishing is the only operation that changes what employees see. Importing or validating a draft run does not.

## Source handling rules

The original XLSX/PDF files and any private normalized working extract are internal business records. They must not be committed to the public GitHub repository or exposed through the static application.

`source_report_files` records provenance such as source type, original filename, SHA-256 hash, byte size, detected report date, page/sheet count and parser metadata. Raw source bytes are not currently archived by this pipeline because the available ChatGPT/Supabase workflow does not provide a private Storage upload step. The source files therefore remain external source records unless a separate private archive is introduced later.

## Duplicate handling

A repeated file hash is evidence that a source has not changed; it is not a reason to create different numbers.

For a new business date, the pipeline may legitimately reuse an unchanged source if that is what was supplied. Source hashes are retained so the system can distinguish “new date, same report” from a genuinely changed report.

Do not silently mutate an already approved run. If a corrected source is supplied, create a new revision and preserve the previous run.

## Corrected revisions

A corrected publication must:

- create a new `business_report_runs` row with an incremented revision;
- retain both old and new source hashes;
- set `supersedes_run_id` when publishing the correction where applicable;
- rebuild flags from the corrected normalized data;
- atomically point `business_dashboard_publications` to the new approved run.

The old run remains historical evidence and is never rewritten into the corrected state.

## Validation policy

Validation has three practical outcomes:

- `passed`: structural and source checks are clean;
- `passed_with_warnings`: the dashboard can publish, but source irregularities are explicitly preserved in validation metadata;
- failed/blocking: do not approve or publish.

Warnings must describe source behavior rather than silently “fixing” the source. Examples include workbook formulas that do not reconcile, a forecast section that is not loaded, an unusual subtotal relationship, or a report component that should be withheld because the source is internally inconsistent.

## F&B parsing rules

Use label-based and block-based parsing, not one permanent hard-coded cell layout. Daily sheets may move optional sections.

Preserve these semantic layers separately:

- daily summary and MTD summary;
- outlet totals and forecasts;
- outlet dayparts;
- food, beverage, other and discount components;
- covers and other operational counts;
- operational notes.

Discounts are normalized as positive magnitudes in storage; the UI decides whether to render a minus sign. Do not change the source meaning of gross, discount and net fields.

Operational note text is stored raw and may also have a whitespace-normalized display form. Do not rewrite or editorialize staff notes during ingest.

## Rooms parsing rules

Preserve the report hierarchy rather than flattening subtotals into leaves.

The normalized model keeps:

- monthly Grand Total metrics;
- pickup, OTB, Forecast, Budget, STLY and Last Year comparisons;
- Occupancy and RevPAR;
- market-segment hierarchy, subtotal and Grand Total identity;
- whether a segment is included in Grand Total;
- forecast remaining and historical remaining fields when present.

A source forecast that is genuinely absent/not loaded must remain distinguishable from a real zero forecast in the UI.

## Publication reconciliation checklist

Before publication, verify at minimum:

- exactly one intended approved run is selected for the business date;
- expected source report types exist and hashes are recorded;
- F&B outlet/daypart rows reconcile to the source within defined tolerance;
- Rooms monthly Grand Total rows reconcile to the source report;
- market-segment hierarchy has not been flattened or duplicated;
- known source warnings remain attached to the run;
- dashboard flags were rebuilt from the current rule configuration;
- direct table access remains closed to ordinary authenticated users;
- the read-model RPC returns the publication expected by Today.

## Notification relationship

A business update notification is downstream of publication, never upstream of it. The publication transaction remains authoritative even if notification transport is unavailable.

The notification bridge compares canonical source hashes with the previous publication to classify the update as F&B, Rooms or both. Notifications contain only generic update text and a Today deep link; they do not carry hotel figures or operational notes.

See `BUSINESS-DASHBOARD-NOTIFICATION-RUNBOOK.md` for release and transport details.

## Security boundary

Never place any of the following in public GitHub, Pages assets, client-side fixtures, logs intended for public artifacts, or notification bodies:

- real daily/MTD hotel financial values;
- real Rooms pickup/occupancy/revenue report values;
- operational notes;
- raw XLSX/PDF report bytes;
- private normalized JSON/SQL data fixtures;
- service credentials, bearer tokens or Vault secret values.
