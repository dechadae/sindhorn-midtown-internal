# F&B Supabase Data Authority

**Status:** Canonical architecture decision  
**Date:** 29 August 2026

## Authority split

- **F&B operational content authority:** live Supabase project `sjpvhgxacsiorrtijqua`.
- **F&B executable UI authority:** GitHub / Cloudflare Pages (`site/fnb.js`, CSS, routing, transitions, validation, share rendering and offline behavior).
- **Excel workbooks:** source/import material, not runtime authority.
- **`site/fnb-data.js`:** runtime data adapter plus compact emergency offline structure only. It is **not** a business-content source of truth and must not be expanded with routine promotion copy/menu content.

Normal promotion edits after this migration are therefore:

`update Supabase row → F&B reflects change`

A Git commit or Cloudflare deployment is required only when executable UI/validation/rendering behavior changes.

## Source workbooks imported

1. `Sep - Oct 2026 F&B Promotions (1).xlsx` — sheet `Sep - Oct 2026`
2. `Nov  - Dec 2026 F&B Promotions.xlsx` — sheet `Nov - Dec 2026`

Import/reconciliation date: **29 August 2026**.

Both workbooks were inspected programmatically, including merged cells, visible values, hyperlinks, dates, outlet/time fields, menu/copy blocks, allergens, prices and artwork requirements. Neither workbook contains formulas.

## Production tables

### `public.sindhorn_fnb_promotions`

Promotion-level content: stable ID, title, summary, dates, display label, master brief, English/Thai copy, display outlets, publication/sort metadata and source-workbook traceability.

### `public.sindhorn_fnb_promotion_activations`

Outlet/activation-level content: stable activation ID, promotion relationship, outlet, service time, IHG One Rewards information, outlet-specific brief/copy and sort order.

### `public.sindhorn_fnb_artwork_requirements`

Stable artwork IDs, activation relationship, collateral name, dimensions/format, notes and sort order.

### `public.sindhorn_fnb_activation_links`

Canonical SharePoint/OneDrive artwork-folder URLs keyed by activation. These are content metadata, separate from artwork-completion state.

### `public.sindhorn_fnb_artwork_status`

Existing server-backed artwork completion state. This table remains separate from canonical promotion content so content imports do not churn progress state.

## Read models and security

### Authenticated app

`public.sindhorn_fnb_read_model()` returns one render-friendly JSON payload containing published promotions, activations and artwork requirements. It requires an authenticated user mapped to an active Sindhorn employee.

The four content tables have RLS enabled. Anonymous raw-table reads are not granted and RLS is not disabled.

### Public read-only share

`public.sindhorn_fnb_public_read_model()` is the explicit anonymous allowlist for the public F&B share experience. It exposes only F&B promotion/read-only fields required by that page; it does not join employee, authentication, admin or secret data.

**Product decision, 29 August 2026:** artwork-folder URLs are intentionally included in this public read model. The workbook URLs point to IHG SharePoint and still require the destination's IHG authentication. Public share pages may therefore render `View artwork folder(s)` while edit/completion controls remain unavailable.

## Runtime path

Authenticated `/fnb`:

`site/fnb-data.js` → authenticated `sindhorn_fnb_read_model()` → validation → last-known-good cache → existing F&B renderer.

Public `/share/fnb` and `/share/fnb/:promotion`:

`site/share/fnb-public-data.js` → `sindhorn_fnb_public_read_model()` → existing read-only F&B renderer. Build generation also embeds the last validated public snapshot as a secondary failure fallback, so metadata/share documents are deployable even if the live API is briefly unavailable later.

No normal online path uses a static JS corpus as content authority.

## Offline behavior

The authenticated adapter stores the last successfully validated full dataset under `sindhorn-midtown:fnb-dataset:v2`.

Order of authority:

1. Supabase live read model.
2. Last-known-good validated local cache when Supabase/network is unavailable.
3. Compact emergency structural fallback only when neither live data nor a prior cache exists.

A failed, empty or malformed network response never overwrites a valid cached dataset. Cache/fallback use is identified with a restrained offline/stale note.

The emergency structure contains enough promotion/date/outlet information to avoid a blank F&B route; it intentionally does not duplicate operational copy/menu/artwork content and must never be treated as canonical.

## Stable ID rule

Promotion, activation and artwork IDs are durable external keys because existing device/server state can be keyed by them. Imports must preserve an existing ID whenever the source still represents the same real-world item.

Do not regenerate slugs simply because a title changes. Any unavoidable ID change requires an explicit state migration.

The Sep–Dec 2026 migration preserved all existing production IDs. A concurrent live correction added `fried-chicken-waffles-lobby` as a real zero-artwork Lobby Lounge activation; it is retained as current canonical state.

## Multi-outlet display rule

Some workbook/copy material explicitly states that a promotion is available at both Sip & Co. and The Lobby Lounge while artwork production is attached only to the Sip activation. `display_outlets` represents this without duplicating artwork tasks.

Current examples include Fried Chicken & Waffles, Festive Afternoon Tea and Matcha Moments.

## Import/normalization policy

Excel remains source authority for Sep–Dec 2026 operational facts unless there is clear evidence of a later approved live correction.

Before import:

- normalize date ranges to English long-date labels with en dashes;
- normalize times such as `6:30 am – 12 am`, `5 pm – 2 am`;
- normalize prices such as `THB 490++` without changing amount/tax meaning;
- correct only obvious grammar, spelling, punctuation, capitalization and spacing;
- preserve brand/proper/menu names, prices, phone/email/URL values and allergen substance;
- never infer an allergen;
- preserve ambiguous source meaning and report it instead of creatively rewriting it.

Meaningful examples from this import include:

- `Each cocktail offer a cultural blend...` → `Each cocktail offers a cultural blend...`
- `7 delicious vegetarian menu` → `seven delicious vegetarian dishes`
- `Featuring 3 highlight menu:` → `Three highlights include:`
- `FESTVE HAMPER` → `FESTIVE HAMPER`
- `Koeran Winter Sea` → `Korean Winter Sea`
- `Prawn and Logan Salad` → `Prawn and Longan Salad`
- `Selling Price: 370++ per glass` → `Selling Price: THB 370++ per glass`

Thai was changed only for clearly unambiguous spelling/spacing issues; no stylistic Thai rewrite is part of this migration.

## Artwork-folder and local-state migration

Workbook artwork-folder links are canonical Supabase activation metadata. The old device-local folder-link editor is retired/hidden by the adapter, and its local link overrides are cleared once while preserving local artwork check state.

Artwork completion continues to use stable artwork IDs and the existing `sindhorn_fnb_artwork_status` sync path, so the content-authority migration does not unnecessarily break progress.

## Validation requirements

Every import/read model must continue to verify:

- unique promotion, activation and artwork IDs;
- ISO dates with `start <= end`;
- valid promotion/activation relationships;
- no orphan artwork requirements;
- correct Sep–Dec month coverage;
- no duplicate promotion cards;
- no undefined display strings or NaN dates;
- no raw Excel formulas/metadata;
- valid Unicode/Thai text;
- no empty/malformed dataset replacing the last-known-good cache.

The F&B interface, single-shell navigation, atmosphere and Phase 9 auth architecture are outside this data-authority migration and must remain unchanged.
