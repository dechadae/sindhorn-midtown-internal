# F&B Excel → Supabase Update Runbook

**Status:** Canonical operating procedure  
**Applies to:** future F&B promotion workbook updates supplied by the product owner  
**Supabase project:** `sjpvhgxacsiorrtijqua`  
**Runtime authority:** `docs/FNB-SUPABASE-DATA-AUTHORITY-20260829.md`

## Purpose

This document tells future agents exactly what to do when the product owner uploads one or more updated F&B Excel workbooks and asks to update the promotion calendar.

The normal business-content path is:

`uploaded Excel workbook(s)`  
`→ inspect every sheet/cell/link`  
`→ compare with live Supabase`  
`→ conservative cleanup + normalization`  
`→ preserve stable IDs`  
`→ atomic Supabase upsert/delete only where justified`  
`→ validate live read models`  
`→ verify production /fnb and public share behavior`

For an existing promotion, ordinary copy/date/time/price/artwork/link changes do **not** require editing `site/fnb-data.js`, a Git commit, or a Cloudflare deployment. Supabase is the operational content authority.

Do not turn the uploaded workbook into a new JS fixture. Do not paste promotion copy into Git as the canonical dataset.

## What the product owner needs to provide

The product owner only needs to upload the latest Excel workbook(s) and say, in substance:

> Update F&B promotions from these Excel files. Follow the F&B Excel-to-Supabase runbook and preserve stable IDs.

Do not ask the product owner to convert the workbook to CSV, manually identify changed cells, restate the schema, or repeat project history unless a genuine workbook ambiguity cannot be resolved from the file and current live data.

## Read before doing anything

Always re-fetch current state. Do not rely on a SHA, row count, workbook list, or promotion count copied from an earlier handoff.

Read in this order:

1. `AGENTS.md`
2. `docs/FNB-SUPABASE-DATA-AUTHORITY-20260829.md`
3. this runbook
4. `docs/SINGLE-SHELL-ROUTER-INVARIANT-20260828.md`
5. current `site/fnb-data.js`
6. current `site/fnb.js`
7. current `site/fnb-artwork-sync.js`
8. current public-share generator: `scripts/generate-fnb-share.mjs`
9. current F&B tests/workflows
10. F&B Supabase migrations, especially:
   - `supabase/migrations/20260829065500_fnb_supabase_content_authority.sql`
   - `supabase/migrations/20260829073000_fnb_parent_update_timestamp_cascade.sql`

Then re-fetch:

- current GitHub `main`;
- current production deployment state;
- live Supabase table/function/RLS definitions relevant to F&B;
- live counts and IDs from the F&B read models;
- live artwork-completion state before any operation that could affect artwork IDs.

The live database may have approved corrections newer than the uploaded workbook. Never assume the workbook automatically wins every conflict without checking.

## Canonical F&B tables

### `public.sindhorn_fnb_promotions`

Promotion-level fields include:

- `id`
- `title`
- `summary`
- `start_date`
- `end_date`
- `display_date_label`
- `brief`
- `copy_en`
- `copy_th`
- `display_outlets`
- `sort_order`
- `published`
- `source_workbook`
- `source_sheet`
- `created_at`
- `updated_at`

### `public.sindhorn_fnb_promotion_activations`

Activation/outlet fields include:

- `id`
- `promotion_id`
- `outlet`
- `service_time`
- `ihg_one_rewards`
- `brief`
- `copy_en`
- `copy_th`
- `sort_order`
- timestamps

### `public.sindhorn_fnb_artwork_requirements`

Artwork/collateral fields include:

- `id`
- `activation_id`
- `name`
- `dimensions_format`
- `notes`
- `sort_order`
- timestamps

### `public.sindhorn_fnb_activation_links`

Artwork-folder metadata:

- `activation_id`
- `artwork_folder_url`
- `source_kind` = `workbook` or `approved-manual`
- timestamps

### `public.sindhorn_fnb_artwork_status`

This is **completion/progress state**, not workbook content. Never rebuild or clear it as part of a normal content import.

Stable artwork IDs are what connect workbook content to completion state.

## Phase 1 — inspect the uploaded Excel files completely

Programmatically inspect every supplied workbook. Do not assume one row equals one promotion.

For every workbook, inspect:

- workbook filename;
- every sheet name;
- hidden/visible sheet state if relevant;
- used range;
- merged cells and merged headings;
- visible cell values;
- formulas and cached/displayed values where present;
- hyperlinks, including links attached to display text rather than shown as raw URLs;
- date cells and number formats;
- service times;
- prices;
- outlet names;
- campaign/event names;
- promotional periods;
- mechanics;
- menu items;
- allergens;
- IHG One Rewards details;
- English copy;
- Thai copy;
- master briefs;
- outlet-specific briefs/copy;
- artwork requirements;
- artwork dimensions/formats;
- artwork-folder SharePoint/OneDrive links;
- notes that materially affect the promotion.

A campaign can span several rows, merged blocks, multiple outlet sections, separate English/Thai paragraphs, menus and artwork rows. Reconstruct the intended hierarchy rather than flattening the sheet row-by-row.

Do not use OCR for an ordinary `.xlsx` file. Read the workbook structure directly.

## Phase 2 — create a workbook-derived normalized candidate in memory

Before touching Supabase, reconstruct each promotion as a normalized candidate equivalent to the runtime model:

```text
promotion
  id
  title
  summary
  start/end
  date label
  master brief
  English copy
  Thai copy
  display outlets[]
  sort order
  published
  source workbook/sheet
  activations[]
    id
    outlet
    service time
    IHG One Rewards
    outlet brief
    outlet English copy
    outlet Thai copy
    artwork folder URL
    artworks[]
      id
      name
      dimensions/format
      notes
      sort order
```

Do not write this candidate into `site/fnb-data.js`.

## Phase 3 — compare against live Supabase before assigning IDs

Fetch the current live dataset from Supabase first and match workbook items to existing real-world promotions.

Compare at least:

- title;
- dates;
- outlet(s);
- campaign meaning;
- activation structure;
- artwork task names;
- current stable IDs;
- existing folder links;
- existing completion-status keys.

### Stable ID rule

If the workbook item is the same real-world promotion/activation/artwork as an existing row, reuse its existing ID even if the title, date, wording or dimensions changed.

Examples of durable IDs already used in this project:

- promotion: `fried-chicken-waffles`
- activation: `fried-chicken-waffles-sip`
- artwork: `fried-chicken-waffles::sip::a4-menu`

Never regenerate an ID merely because copy changed.

For a genuinely new item, derive a readable stable ID once using the existing naming convention and verify it does not collide with any promotion, activation, artwork or local/server progress key. After insertion, that ID becomes durable.

If an unavoidable ID change is proposed, stop and report the exact reason plus a migration plan for existing artwork/progress state before changing it.

## Phase 4 — produce a pre-write diff

Before changing Supabase, classify every workbook item as one of:

- unchanged;
- existing promotion updated;
- new promotion;
- new activation under existing promotion;
- activation updated;
- new artwork requirement;
- artwork requirement updated;
- artwork requirement removed;
- artwork-folder link added/updated/removed;
- possible promotion removal;
- ambiguous/conflicting source value.

Also record live-only values that are newer approved corrections and should be preserved.

### Absence is not automatically deletion

Do **not** delete a live promotion simply because it is absent from one uploaded workbook.

A deletion is justified only when one of these is true:

1. the product owner explicitly says the workbook is a complete replacement for the covered period and the missing campaign has been removed; or
2. the workbook clearly marks the campaign cancelled/removed; or
3. another authoritative source clearly supersedes the live row.

If uncertain, keep the live row and report the discrepancy.

The same conservative rule applies to activations and artwork tasks.

## Phase 5 — conservative grammar and formatting cleanup

Correct only obvious source errors before import.

Allowed corrections include:

- grammar agreement;
- obvious spelling mistakes;
- duplicate spaces;
- malformed punctuation;
- accidental quote characters;
- capitalization inconsistencies;
- price spacing;
- date/time punctuation;
- clearly unambiguous Thai spelling/spacing errors.

Do not creatively rewrite marketing copy merely because another phrase sounds better.

Preserve:

- intended meaning;
- proper names;
- chef/bartender names;
- product/brand names;
- menu/cocktail names;
- prices;
- allergens in substance;
- phone numbers;
- email addresses;
- URLs;
- Thai meaning.

Never infer an allergen.

If meaning is ambiguous, preserve the source wording and report it.

Keep a concise meaningful-corrections report, for example:

```text
Source: Each cocktail offer a cultural blend...
Imported: Each cocktail offers a cultural blend...
```

Do not report every comma or spacing adjustment.

## Phase 6 — normalize production formatting

Use the existing F&B formatting conventions unless the workbook has a legitimate reason to differ.

### Dates

Prefer:

- `1 September – 31 December 2026`
- `21 – 27 September 2026`
- `12 September 2026`

Store machine dates as ISO `YYYY-MM-DD` in `start_date` / `end_date`.

### Times

Prefer display values such as:

- `6:30 am – 12 am`
- `5 pm – 2 am`
- `7 pm – 11 pm`

Do not invent a time when the workbook says TBC or does not provide one.

### Prices

Prefer:

- `THB 490++`
- `THB 350++`
- `THB 420++`

Do not change the amount or tax/service-charge meaning.

### Outlets

Use the exact approved outlet naming currently used by the app/database unless the workbook introduces a genuinely new outlet.

Current known outlet names include:

- `ANJU`
- `Bangkok'78`
- `Sip & Co.`
- `Horizon Pool Bar`
- `The Lobby Lounge`
- `In-room Dining`

Do not silently map an unfamiliar outlet name to the nearest existing outlet. Resolve/report it.

### Multi-outlet campaigns

Use `display_outlets` when the campaign should visually list several outlets but operational artwork tasks belong to only one real activation. Do not create fake duplicate activations merely to make the outlet label display correctly.

## Phase 7 — treat artwork links correctly

Excel hyperlinks can be hidden behind display text. Extract hyperlink targets, not only visible cell text.

Workbook SharePoint/OneDrive artwork-folder URLs belong in `public.sindhorn_fnb_activation_links` with `source_kind='workbook'` unless the product owner has separately approved a manual URL.

Current product decision: these folder URLs are allowed in the public F&B read model because the destination still requires IHG authentication.

Do not put passwords, access tokens, employee data or other credentials into promotion content.

## Phase 8 — write Supabase safely

For a normal workbook update, **do not create a new schema migration containing the business data**. The schema stays versioned in Git; operational rows live only in Supabase.

Use one transaction where practical:

```text
BEGIN
  upsert promotions by stable id
  upsert activations by stable id
  upsert artwork requirements by stable id
  upsert/remove activation links where explicitly justified
  remove retired artwork/activation/promotion rows only after the pre-write diff proves they should be removed
  run integrity checks
COMMIT
```

Prefer `INSERT ... ON CONFLICT (id) DO UPDATE` or the equivalent safe Supabase operation rather than delete-and-reinsert.

Do not manually set `created_at` for existing rows. Let the database `updated_at` triggers run normally.

Child-row changes automatically touch the parent promotion freshness timestamp through `20260829073000_fnb_parent_update_timestamp_cascade.sql`.

### Never use delete-and-recreate as a shortcut

Delete/reinsert churn can break:

- stable activation IDs;
- stable artwork IDs;
- artwork completion state;
- local cached state;
- share links;
- auditability.

Upsert the existing row instead.

## Phase 9 — artwork completion safety

Before changing or deleting an artwork requirement, inspect whether its ID exists in shared completion state.

If the collateral is still the same real-world task and only its label/dimensions/notes changed, keep the same artwork ID.

If the workbook truly removes the task, remove the content row only after confirming the source is authoritative. Do not clear unrelated completion rows or reset the entire promotion's progress.

Never use `sindhorn_fnb_artwork_status` as an import target for workbook content.

## Phase 10 — post-write validation in live Supabase

Validate the actual rows after writing, not just the candidate object used during import.

At minimum verify:

- unique promotion IDs;
- unique activation IDs;
- unique artwork IDs;
- valid ISO dates;
- `start_date <= end_date`;
- every activation references an existing promotion;
- every artwork references an existing activation;
- no orphan artwork rows;
- no duplicate promotion cards in the read model;
- valid month coverage;
- expected outlets;
- no `undefined`, `NaN`, raw formula strings or Excel metadata;
- no broken Unicode/replacement characters;
- Thai strings remain valid Thai Unicode;
- all workbook hyperlinks intended for F&B exist in the correct activation rows;
- public and authenticated read models return the expected campaign structure;
- no employee/auth/admin data is exposed by `sindhorn_fnb_public_read_model()`;
- artwork counts still agree with completion-state IDs.

Also compare before/after counts and IDs so accidental mass deletion is immediately visible.

## Phase 11 — verify runtime propagation without editing Git

For ordinary updates to existing promotions, verify the production app directly after the Supabase transaction.

Check:

- `/fnb` reflects the changed content;
- the visible `Updated …` freshness timestamp advances;
- affected month filters still include the promotion correctly;
- affected outlet filters still include it correctly;
- detail Overview / Brief / Copy / Artwork sections are correct;
- index artwork count equals detail artwork count;
- zero-artwork outlet groups remain hidden;
- public shared calendar reflects the update;
- existing individual public promotion share reflects the update;
- artwork folder link opens where applicable.

A normal existing-row edit is complete when the deployed runtime reads the new Supabase values. Do not perform a Git/Cloudflare release just to change copy, dates, price, time, menu text or an existing artwork-folder URL.

## Important exception — brand-new promotion IDs and public share routes

The authenticated `/fnb` route and `/share/fnb` shared calendar read Supabase live, so a newly inserted promotion can appear there without a Git deployment.

However, current individual public share URLs are physical crawler-ready HTML files generated by `scripts/generate-fnb-share.mjs`:

`/share/fnb/<promotion-id>.html` → clean URL `/share/fnb/<promotion-id>`

Therefore, when the workbook introduces a **brand-new promotion ID/slug**, the new individual public share URL does not exist until the generator is run in a normal Git/Cloudflare release.

This is the current exception to the no-deploy content rule.

For a new promotion:

1. import and validate the Supabase rows first;
2. confirm `/fnb` and `/share/fnb` show it correctly;
3. create a small dedicated branch that changes no business-content JS;
4. run the normal F&B share-generation validation/deploy workflow so the new physical share page is generated;
5. preview/smoke the new share URL;
6. merge only after validation.

If only existing promotion IDs are updated, do not do this step.

## Existing promotion title changes

A title change does not imply a slug/ID change. Keep the old stable promotion ID and existing share URL unless the product owner explicitly requests a URL migration.

The static initial HTML metadata for an existing share page may still reflect the last generated build until the next deployment, while the rendered promotion content comes from live Supabase. If title/summary social-preview metadata must change immediately, run the public-share generator release as a separate executable/share-metadata update. Do not change the stable ID merely to refresh metadata.

## Rollback procedure

Before a multi-row import, retain enough before-state evidence to restore the affected IDs. This can be a structured export/diff of the affected promotion, activation, artwork and link rows; do not commit private operational exports into Git.

If validation fails after writing:

1. stop further writes;
2. restore the affected Supabase rows from the captured before-state using their same stable IDs;
3. re-run integrity/read-model validation;
4. verify `/fnb` and public shares have returned to the previous state;
5. report the failure and the restored state.

Do not try to “fix forward” by inventing workbook values.

## What must never change during a content-only workbook update

Do not modify, unless the product owner explicitly expands the task:

- Phase 9 authentication architecture;
- employee tables/auth data;
- atmosphere/weather/PM2.5 code;
- single-shell navigation;
- F&B UI layout/design;
- fonts/typography architecture;
- PWA identity;
- RLS globally;
- public-read allowlists beyond fields actually required by approved F&B sharing;
- `site/fnb-data.js` business-content fallback as a new canonical corpus.

A workbook content update is not a reason to redesign the app.

## Required completion report

After every workbook update, report at least:

1. workbook filenames and sheets inspected;
2. promotions found per workbook;
3. resulting published promotion count;
4. promotions added;
5. promotions updated;
6. promotions removed, if any;
7. activations added/updated/removed;
8. outlets found, including any new/unrecognized outlet;
9. artwork requirements added/updated/removed and resulting total;
10. artwork-folder links added/updated/removed;
11. meaningful grammar/typo corrections;
12. ambiguous/conflicting values preserved or escalated;
13. stable IDs preserved and any unavoidable ID migration;
14. validation results for relationships/dates/Unicode/duplicates;
15. confirmation that artwork completion state was preserved;
16. confirmation that production `/fnb` reflected Supabase without a Git deployment;
17. public shared-calendar verification;
18. whether any new promotion slug required a share-generator release;
19. final live Supabase counts.

## Quick decision table

| Change from uploaded Excel | Supabase update | Git/Cloudflare deploy |
| --- | --- | --- |
| Existing promotion copy/brief/menu/Thai/English | Yes | No |
| Existing promotion dates or display date | Yes | No |
| Existing activation time/IHG info | Yes | No |
| Existing artwork requirement label/dimensions | Yes, preserve artwork ID | No |
| Existing artwork-folder URL | Yes | No |
| Existing promotion title | Yes, preserve promotion ID | Usually no; deploy only if initial share metadata must refresh immediately |
| New activation under existing promotion | Yes | No |
| New artwork requirement | Yes, create durable artwork ID | No |
| New promotion with new stable ID | Yes | **Yes once if an individual `/share/fnb/<id>` page is required** |
| Promotion/activation/artwork removal | Only when source is clearly authoritative | No, unless share-route/static metadata cleanup is separately required |
| UI/filter/rendering/schema/RLS behavior change | Not merely content | Yes, normal branch/preview/PR release |

## Final rule

When the product owner gives an updated Excel workbook, the default assumption is:

**the workbook is import material, Supabase is runtime authority, IDs are durable, and Git is not the place where routine F&B business content lives.**

Always compare against live Supabase before writing, preserve newer approved live corrections when clearly established, and report genuine ambiguities instead of guessing.
