# Business Dashboard Data Dictionary

## Authority model

Today reads one approved publication through `public.sindhorn_business_dashboard_read_model`. Client code must not query the underlying business tables directly.

All business values are scoped to a `business_report_runs.id`. A publication maps one `business_date` to one approved run. A corrected source creates another revision rather than mutating historical normalized rows.

## Provenance

### `business_report_runs`

One normalized import/reconciliation attempt.

Key semantics:

- `business_date`: dashboard business date represented by the run;
- `revision`: monotonic correction number for that business date;
- `status`: draft/validated/approved lifecycle state;
- `parser_version`: parser/normalizer contract used for the run;
- `validation_status`: pass/warning/failure outcome;
- `validation_summary`: machine-readable reconciliation and anomaly evidence;
- `imported_at`, `approved_at`: lifecycle timestamps.

### `source_report_files`

One source-file identity attached to a run.

Canonical source types currently include:

- `fnb_xlsx`: daily F&B workbook;
- `rooms_pdf`: Rooms pickup report.

Important fields:

- `filename`: original supplied filename;
- `sha256`: content identity used for provenance/change classification;
- `byte_size`: source byte size;
- `detected_report_date`: date inferred from the report itself;
- `source_sheet_count` / `source_page_count`: structural metadata;
- `storage_path`: optional future private archive location;
- `metadata`: parser/source-specific structural evidence.

## F&B normalized model

### `fnb_daily_summary`

Headline daily and MTD F&B values for a run.

Daily fields represent the current report day. MTD fields represent the source workbook’s month-to-date summary and may carry validation warnings when workbook formulas are internally inconsistent.

Core metric groups:

- revenue: actual, forecast, variance;
- covers: actual and forecast;
- food revenue and forecast;
- beverage revenue and forecast;
- other revenue and forecast;
- other discount.

Discount columns are stored as positive magnitudes. Presentation may prefix them with a minus sign.

### `fnb_outlet_daily`

One row per outlet for daily totals and forecast comparison.

Typical components:

- revenue / forecast / variance;
- covers;
- food gross, food discount, food net;
- non-alcohol gross and discount;
- beverage gross, beverage discount, beverage net;
- other revenue and other discount;
- outlet-level validation metadata.

`display_order` is presentation order and must not be interpreted as financial hierarchy.

### `fnb_outlet_daypart`

One outlet/daypart row. Dayparts are source-defined operating periods and should remain attached to their outlet rather than being aggregated into a global daypart total unless the product explicitly needs that view.

The model can retain:

- covers;
- amenity/contactless counts where present;
- food, non-alcohol, beverage and other components;
- net daypart revenue;
- source/presentation ordering.

### `fnb_operational_notes`

Operational commentary from the workbook.

- `raw_text`: exact source wording;
- `display_text`: whitespace-normalized rendering form only;
- outlet/daypart keys and labels: source context;
- `source_cell`: provenance pointer.

The ingest pipeline must not summarize, rewrite or infer missing operational notes.

## Rooms normalized model

### `rooms_monthly_summary`

One Grand Total row per stay month represented in the pickup report.

Metric families:

- `pickup`: most recent pickup period;
- `otb`: on-the-books room nights, ADR and revenue;
- `forecast`;
- `budget`;
- `stly`: same time last year;
- `last_year`: actual prior-year comparison;
- `otb_vs_stly`;
- `forecast_remaining`;
- `historical_remaining` / remaining-to-actual-last-year;
- occupancy and RevPAR comparison fields.

Occupancy is stored as a decimal ratio (`0.85` means 85%). Currency values are stored as numeric source units without display rounding.

A forecast section that is not loaded in the source must be represented through validation/source context so the UI can say “Forecast not loaded” instead of implying meaningful zero performance.

### `rooms_market_segment`

One market-segment or subtotal row per stay month.

Hierarchy metadata:

- `segment_key`: stable normalized key;
- `segment_label`: source-facing label;
- `segment_code`: source code when present;
- `parent_segment_key`: parent relationship;
- `hierarchy_level`: indentation/depth;
- `is_subtotal`: subtotal marker;
- `is_grand_total`: Grand Total marker;
- `included_in_grand_total`: explicit inclusion semantics;
- `display_order`: original report order.

The hierarchy is authoritative. Consumers must not sum all rows indiscriminately because leaves, subtotals and Grand Total coexist in the same normalized table.

## Attention rules

### `business_dashboard_rules`

Configuration for deterministic “Needs Attention” logic. Rules are data/configuration rather than client-side hard-coded thresholds.

Initial rule families cover:

- total F&B below forecast;
- selected outlets materially below forecast;
- current-month Rooms occupancy below forecast;
- current-month Rooms revenue below forecast.

### `business_dashboard_flags`

Materialized exceptions rebuilt for a run by `sindhorn_business_rebuild_flags`.

Fields identify:

- domain (`fnb` or `rooms`);
- scope key;
- metric key;
- severity;
- user-facing title/detail;
- originating rule key;
- sort order;
- small rule-specific comparison payload.

Flags are deterministic outcomes of normalized data + active rules. They are not editorial commentary.

## Publication

### `business_dashboard_publications`

One row per published `business_date`.

- `run_id`: currently approved run shown to employees;
- `supersedes_run_id`: optional prior run explicitly replaced by a correction;
- `published_at`: publication timestamp.

Today’s freshness and motion state are keyed to publication identity/timestamp rather than browser load time.

## Notification audit

### `business_dashboard_notification_events`

Defined by the notification bridge migration. This is transport metadata only and intentionally contains no hotel figures.

It records:

- current and previous run IDs;
- business date/revision;
- source-change domain (`fnb`, `rooms`, `both`);
- deterministic event ID;
- asynchronous `pg_net` request ID;
- queue state and SQLSTATE-only error code.

## Read model contract

`public.sindhorn_business_dashboard_read_model(p_business_date)` returns one JSON object containing:

- publication/run metadata;
- source provenance;
- F&B summary, outlet/daypart detail and notes;
- Rooms monthly summary and market segments;
- materialized attention flags;
- active attention-rule configuration.

The browser adapter may cache a last-known-good read-model response locally for resilience, but Supabase publication remains canonical.

## Display conventions

- Money: store full numeric precision; round/compact only in UI.
- Occupancy/rates: store ratios; format as percent in UI.
- Variance: preserve sign from comparison semantics.
- Discounts: positive magnitude in storage, negative sign is presentation.
- Missing/not-loaded: preserve as missing/source state rather than silently converting to zero.
- Notes: exact raw wording retained; display normalization may only change whitespace.
- Dates/times: database timestamps are absolute; employee UI presents the intended hotel/Bangkok context.
