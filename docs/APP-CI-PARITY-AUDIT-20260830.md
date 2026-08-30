# Sindhorn Midtown Internal — APP → CI Parity Audit

Date: 2026-08-30
Branch baseline: `bda1d6425a19befa4109e3a84bde8a79b545addd`
Audit branch: `app-ci-parity-preview`
Production: `https://sindhorn-midtown-internal.pages.dev/`
Live Supabase project: `sjpvhgxacsiorrtijqua`
Live presentation pack observed during audit: **Pack 49**

## 1. Executive summary

The application is visually more aligned than its source ownership currently suggests.

- **Estimated rendered visual/system parity: ~72%.** Typography, zero tracking, route hero geometry, persistent-shell navigation, rounded-corner shape overrides, back-control geometry and route-transition timing already have shared authorities.
- **Estimated implementation-authority parity: ~58%.** Several canonical-looking components still obtain parity through route-specific selectors, copied CSS, or global overrides rather than a semantic production primitive.
- **Weighted overall design-system maturity: ~65%.** The app has a strong foundation and a real CI registry, but CI still documents F&B-, Factsheet- and Settings-named implementations as generic exemplars.

The biggest drift risks are:

1. **Supabase presentation-pack CSS is outside the GitHub source-level shape audit.** Pack 49 still contains `999px`/`50%` radii and older action/nav motion values. `app-shapes.css` corrects known selectors at runtime, but a new pack selector can escape the source gate.
2. **Actionable cards are duplicated.** F&B, Brand and Settings People cards share the same visual/tactile grammar but have separate CSS ownership.
3. **History and Factsheet disclosures are intentionally cloned but now materially duplicate controller code.** Both repeat the same 420 ms transition, ARIA/inert handling, one-open policy, scroll runway and 1800 ms settle guard.
4. **Forms/dialogs in compatibility Admin/Login surfaces are independent of the Settings authority.** The direct Admin document also relies on old Admin CSS embedded in `internal-auth.css`.
5. **Documentation drift can recreate retired architecture.** `CI-UI-ADAPTATION.md` still describes an unauthenticated standalone CI microsite, and several architecture docs still describe the old three-item footer.
6. **Current browser shape smoke is selective.** It proves core specimens but does not traverse every route or standalone/public surface.

Highest-leverage consolidation opportunities:

- introduce semantic `app-action-card` ownership while retaining F&B compatibility aliases;
- introduce one generic disclosure controller/style family for History + Factsheet;
- introduce semantic `app-field` aliases derived from Settings;
- define a shared dialog base with centered/settings and route-specific variants rather than independent controllers;
- add explicit Today/Messages pack hooks and a live-pack drift test without moving operational content into GitHub;
- make CI document all legitimate exceptions and make automated tests enforce the ownership map.

## 2. Audit classification legend

Every visible pattern is assigned exactly one primary bucket:

1. **SHARED CANONICAL** — consumes a shared authority shown/documented in CI.
2. **CANONICAL VIA LEGACY ALIAS** — rendered parity comes from a shared authority, but route-specific/legacy selectors remain.
3. **ROUTE-SPECIFIC BY NECESSITY** — domain-specific and should remain route-owned; CI must document the exception and owner.
4. **DUPLICATE — SHOULD MIGRATE** — separate implementation of an existing component/interaction family.
5. **MISSING FROM CI** — legitimate current UI lacks a CI specimen/rule/exception entry.
6. **LEGACY / DEAD / HIDDEN** — no longer a primary visible product pattern; remove, archive or keep only as an explicit compatibility surface.

## 3. Route-by-route inventory

### Today

Ownership: live Supabase presentation pack + shell runtime. Current live source is Pack 49.

- Persistent header/footer/shell: **SHARED CANONICAL**.
- Main footer geometry: **SHARED CANONICAL** (`footer-route-guard`). Pack 49's own older footer resource is not navigation authority.
- Typography and rounded UI geometry: **CANONICAL VIA LEGACY ALIAS**. Pack CSS is normalized by `fonts.css`/`app-shapes.css` at runtime.
- Report/readings/status/weather presentation: **ROUTE-SPECIFIC BY NECESSITY**.
- Connection indicator, action buttons, advice icon, scale marker, pull-to-refresh: **CANONICAL VIA LEGACY ALIAS** for shape; interaction values still partly pack-owned.
- Environmental/report/advice/pull-refresh patterns: **MISSING FROM CI** as explicit route-specific specimens/ownership notes.

### F&B

Ownership: local route UI + Supabase operational content authority.

- Hero: **SHARED CANONICAL** via semantic hero authority/compatibility alias.
- Back control: **CANONICAL VIA LEGACY ALIAS** (`.fnb-back` → app control authority).
- Promotion cards: **CANONICAL VIA LEGACY ALIAS** today; they are the visual source for the future generic action-card primitive.
- F&B select/dropdown: **ROUTE-SPECIFIC BY NECESSITY** until another route uses the same production implementation; Settings already reuses its classes and therefore demonstrates reuse potential.
- Chips: **CANONICAL VIA LEGACY ALIAS** for geometry; classify actual uses individually as filters/metadata, not general navigation.
- Promotion detail composition/artwork: **ROUTE-SPECIFIC BY NECESSITY**.
- Sharing/artwork centered modal: **ROUTE-SPECIFIC BY NECESSITY** interaction variant, but its modal base should join the dialog family.
- Share/action buttons: **DUPLICATE — SHOULD MIGRATE** to shared action-control semantics where interaction is generic.

### Messages

Ownership: Pack 49 markup + shell notification inbox JS.

- Route hero: **SHARED CANONICAL** via route hero compatibility selector.
- Message card/list composition: **ROUTE-SPECIFIC BY NECESSITY**.
- Open action, badge, unread marker: **CANONICAL VIA LEGACY ALIAS** for rounded geometry.
- Empty state: conceptually covered by CI States, but production class is independent; **CANONICAL VIA LEGACY ALIAS** at rule level.
- Message card/unread/badge/open-action specimens: **MISSING FROM CI**.

### Brand

- Hero: **SHARED CANONICAL**.
- Landing cards: **DUPLICATE — SHOULD MIGRATE**. `brand.css` explicitly reproduces the approved F&B promotion-card recipe.
- Whole-card anchor semantics: correct and should be preserved.
- Brand route content/illustration choice: **ROUTE-SPECIFIC BY NECESSITY**.

### Our History

- Hero/back: **SHARED CANONICAL / CANONICAL VIA LEGACY ALIAS**.
- Era accordion: **DUPLICATE — SHOULD MIGRATE** to generic disclosure family.
- Timeline imagery, facts and source treatment: **ROUTE-SPECIFIC BY NECESSITY**.
- History-specific summary/stat content: **MISSING FROM CI** only as an explicitly documented route-specific composition, not as a new generic component.

### Hotel Factsheet

- Hero/back: **SHARED CANONICAL / CANONICAL VIA LEGACY ALIAS**.
- Room cards: currently CI's disclosure authority, but route-named; **CANONICAL VIA LEGACY ALIAS** until semantic disclosure API exists.
- Disclosure JS: **DUPLICATE — SHOULD MIGRATE** with History.
- Metadata tags/hours/nearby labels: **CANONICAL VIA LEGACY ALIAS** for shape.
- Meeting/capacity table: **ROUTE-SPECIFIC BY NECESSITY** as the current dense-data reference; generic table rules may wrap it, but sticky-first-column behavior is a factsheet variant.
- Native `<details>` section disclosure around dense tables: **ROUTE-SPECIFIC BY NECESSITY** and distinct from card accordion interaction.
- Official imagery/source provenance: **SHARED CANONICAL** as documented imagery behavior.

### Settings / Account

- Hero: **SHARED CANONICAL**.
- Settings four-tab rail: **SHARED CANONICAL** and invariant.
- Duplicate in-route avatar: **LEGACY / DEAD / HIDDEN**; shared hero CSS hides it because masthead owns identity.
- Account facts: **ROUTE-SPECIFIC BY NECESSITY**.
- Sign-out action: **CANONICAL VIA LEGACY ALIAS** because it is promoted to F&B action classes.
- Business Card settings actions: **CANONICAL VIA LEGACY ALIAS** to Settings quiet actions.

### Settings / People

- Fixed rail: **SHARED CANONICAL**.
- Employee cards: **DUPLICATE — SHOULD MIGRATE** to generic action-card behavior with a People-specific composition/disabled variant.
- Search control: **DUPLICATE — SHOULD MIGRATE** to shared field/input geometry eventually.
- Fields: **CANONICAL VIA LEGACY ALIAS** (`.settings-field` is current CI authority).
- Custom select: **CANONICAL VIA LEGACY ALIAS** because Settings consumes F&B select markup/classes.
- Dialogs: **SHARED CANONICAL** through `settings-dialog-standard`.
- People-specific role/status/meta composition: **ROUTE-SPECIFIC BY NECESSITY**.

### Settings / Comms

- Fixed rail: **SHARED CANONICAL**.
- Current planned/empty content: **ROUTE-SPECIFIC BY NECESSITY**.
- No new generic component should be derived from a placeholder state.

### Settings / System

- Fixed rail: **SHARED CANONICAL**.
- Capability-driven content: **SHARED CANONICAL** architecture.
- Unauthorized blank System: **SHARED CANONICAL** invariant; no filler card.
- System tools/audit composition: **ROUTE-SPECIFIC BY NECESSITY**.
- UI Library launcher card: **DUPLICATE — SHOULD MIGRATE** to generic action-card semantics; current `.settings-planned` styling makes an actionable link share an informational/planned surface class.

### UI Library `/ci`

- Authenticated in-shell route + capability gate: **SHARED CANONICAL**.
- Live persistent footer used as specimen rather than a painted copy: **SHARED CANONICAL**.
- Hero/back/dialog specimens: **SHARED CANONICAL**.
- F&B card/Factsheet disclosure/Settings field specimens: **CANONICAL VIA LEGACY ALIAS** because generic CI concepts still depend on route-owned names.
- Missing Today/Messages, OTP, People card, Business Card, loading badge/status, public/compatibility exception coverage: **MISSING FROM CI**.
- Old standalone CI architecture document: **LEGACY / DEAD / HIDDEN**.

### Login

The login document is a legitimate standalone authentication boundary.

- LINE Seed Sans TH + zero tracking: **SHARED CANONICAL**.
- Final 2026-08-30 hero appearance: visually aligned but separately implemented; **DUPLICATE — SHOULD MIGRATE** only where safe, without touching auth behavior.
- Generic text field: **DUPLICATE — SHOULD MIGRATE** to `app-field` aliases.
- Primary action: **DUPLICATE — SHOULD MIGRATE** to shared action behavior; current active treatment uses translate rather than the app scale grammar.
- Six-box PIN/OTP group: **ROUTE-SPECIFIC BY NECESSITY** and **MISSING FROM CI**.
- Status/error/success states: **CANONICAL VIA LEGACY ALIAS** conceptually; need CI auth-state specimen.

### Account standalone

Normal in-app navigation canonicalizes `/account(.html)` to Settings, so this direct document is now a compatibility surface.

- Overall document: **LEGACY / DEAD / HIDDEN** for normal authenticated navigation, retained only for direct compatibility until deprecation is approved.
- Avatar/close geometry: **CANONICAL VIA LEGACY ALIAS** through `app-shapes.css`.
- Account actions: independent geometry, **DUPLICATE — SHOULD MIGRATE** if this compatibility page remains supported.
- Focus handling removes visible focus from several controls: accessibility drift; high priority if retained.

### Admin standalone

Normal app routing canonicalizes `/admin(.html)` to Settings; the direct document remains a compatibility/admin surface.

- Direct Admin document: **LEGACY / DEAD / HIDDEN** for normal product navigation, but security-sensitive and therefore cannot simply be deleted without a deprecation decision.
- Admin direct page uses Admin styles embedded in `internal-auth.css`, not `admin.css`.
- `admin.css` is loaded by the persistent app shell but no longer owns a dedicated local route: **LEGACY / DEAD / HIDDEN** candidate pending selector-use confirmation.
- Admin fields/dialogs/actions/navigation: **DUPLICATE — SHOULD MIGRATE** if direct compatibility continues.
- Capsule-named `.pill`, `.chip-btn`, `.admin-nav` are visually corrected by `app-shapes.css` but remain source-level legacy names.

### Business Card

Public business-card rendering is a legitimate public standalone exception.

- Public card presentation: **ROUTE-SPECIFIC BY NECESSITY**.
- The Settings presentation dialog reuses the same card renderer and the shared Settings dialog geometry: **SHARED CANONICAL** boundary.
- Public card actions follow the 160 ms/.975 tactile grammar but use private class names: **CANONICAL VIA LEGACY ALIAS** behavior; semantic action alias is optional.
- Public loading dots are natural loading indicators rather than general chrome, but loading/unavailable states should be documented: **MISSING FROM CI**.
- Custom scrollbar shape is **CANONICAL VIA LEGACY ALIAS** through `app-shapes.css`.

## 4. Component matrix

| Component / pattern | Routes using it | Current owner | CI equivalent | Classification | Drift risk | Recommendation | Difficulty |
|---|---|---|---|---|---|---|---|
| Typography | all | `fonts.css` | Typography | SHARED CANONICAL | Low | Keep hard gate | Low |
| Route hero | F&B, Brand, History, Factsheet, Settings, Messages, CI | `route-hero-standard.css` | Heroes | SHARED CANONICAL | Low | Migrate remaining semantic names gradually | Low |
| Persistent global footer | all in-shell | `footer-route-guard.*` | Navigation | SHARED CANONICAL | Low | Keep shell-owned | Low |
| Settings rail | Settings + CI return | footer guard + settings fixed-rail layer | Navigation | SHARED CANONICAL | Low | Never permission-filter geometry | Low |
| Back control | F&B/Brand/History/Factsheet/CI | `app-controls.css` | Actions | CANONICAL VIA LEGACY ALIAS | Low | Prefer `.app-back-control` on new code | Low |
| Quiet action | Settings/F&B/CI | app controls + route aliases | Actions | CANONICAL VIA LEGACY ALIAS | Medium | Establish semantic action roles | Low |
| Actionable card | F&B, Brand, People, System launcher | route CSS | F&B card specimen | DUPLICATE — SHOULD MIGRATE | High | Create `app-action-card` primitive | Medium |
| F&B select | F&B, Settings People | F&B CSS + duplicated controller bindings | Filters | CANONICAL VIA LEGACY ALIAS | Medium | Extract semantic select only after card/disclosure | Medium |
| Chips/tags | F&B, Factsheet, Settings, pack | route classes + `app-shapes` | Filters | CANONICAL VIA LEGACY ALIAS | Medium | Classify each actual use; remove decorative/legacy pills | Medium |
| Disclosure | History, Factsheet | duplicated route CSS/JS | Factsheet specimen | DUPLICATE — SHOULD MIGRATE | High | Shared controller/style; preserve content composition | Medium |
| Form field | Settings, Login, Admin | Settings + standalone copies | Settings specimen | DUPLICATE — SHOULD MIGRATE | High | Introduce `.app-field` with aliases | Medium |
| Native Settings dialog | Settings, Business Card settings | `settings-dialog-standard.*` | Dialogs | SHARED CANONICAL | Low | Rename toward generic base later | Medium |
| F&B centered modal | F&B | F&B route | Dialog launcher only | ROUTE-SPECIFIC BY NECESSITY | Medium | Join common backdrop/focus/scroll controller family as centered variant | Medium/High |
| Admin dialogs | Admin direct | `internal-auth.css` + `admin.js` | Settings dialog | DUPLICATE — SHOULD MIGRATE | High | Migrate presentation/controller without auth changes | High |
| Capacity table | Factsheet | factsheet | Tables | ROUTE-SPECIFIC BY NECESSITY | Low | Document sticky-column variant | Low |
| Admin dense user grid/list | Admin direct / Settings People | separate grids | none | MISSING FROM CI | Medium | Document responsive dense-list variant | Medium |
| Today readings/report | Today | Pack 49 | none | ROUTE-SPECIFIC BY NECESSITY | High | Document pack owner + semantic hooks | Medium |
| Advice blocks | Guidance pack | Pack 49 | none | MISSING FROM CI | High | Add route-specific specimen/ownership | Medium |
| Pull to refresh | Today | Pack + shell | none | MISSING FROM CI | Medium | Add specimen and semantic hook | Medium |
| Message card | Messages | shell JS + pack CSS | none | MISSING FROM CI | Medium | Document production class/semantics | Medium |
| Unread badge/marker | Messages/footer | pack/shell + shapes | generic States only | CANONICAL VIA LEGACY ALIAS | Medium | Add CI state specimen | Low |
| OTP/PIN control | Login | auth | none | MISSING FROM CI | Low | Document auth-specific control | Low |
| Business-card presentation | Public + Settings dialog | business-card component | none | ROUTE-SPECIFIC BY NECESSITY | Low | Add CI exception specimen/owner | Low |
| Loading/unavailable public-card state | Business Card | public CSS | generic States only | MISSING FROM CI | Low | Document state behavior | Low |
| Account/Admin direct documents | direct URLs | legacy standalone files | none | LEGACY / DEAD / HIDDEN | High | Keep compatibility until explicit retirement; do not copy forward | High |

## 5. Duplicate CSS / JS inventory

### Repeated radii and shape declarations

- Route CSS still contains `50%`/`999px` declarations in F&B, Factsheet, Settings, Admin/auth and Pack 49. Current `app-shapes.css` corrects known visible selectors.
- Pack 49 is outside the repository-only source audit, so its legacy declarations are not source-gated.
- Card surfaces repeat 14 px radii across F&B, Brand, History, Factsheet, Settings People.
- Dialogs repeat 24 px-class panel radii across Settings and Admin; Business Card has its own intentional full-card panel radius.

### Repeated glass surfaces

- F&B cards, Brand cards and Settings user cards separately declare translucent plum/glass material and borders.
- Auth/Admin compatibility surfaces separately define light/paper glass recipes.
- Pack 49 has its own glass/action material values.

### Repeated button/action geometry

- F&B actions, Settings actions, Login primary action, Admin add/save/buttons, public business-card actions all independently define heights/radii/padding/press/focus.
- Several already use the same 160 ms + `.975` grammar but are not owned by one semantic primitive.

### Duplicate modal code

- Settings is centralized with `settings-dialog-standard`.
- F&B owns a separate centered “sheet” implementation.
- Admin direct owns native-dialog presentation/controller separately.
- Business Card correctly delegates its Settings modal shell to the Settings standard and should remain a positive reference.

### Duplicate disclosure code

History and Factsheet repeat the same controller behavior:

- `DISCLOSURE_MS = 420`
- `SCROLL_SETTLE_MS = 1800`
- `aria-expanded`, `aria-hidden`, `inert`
- single-open policy
- scroll runway creation/removal
- animation-time alignment
- reduced-motion handling

This is the clearest JS centralization opportunity.

### Duplicate selector/dropdown code

Settings renders F&B selector classes but owns its own open/close/placement/focus controller logic. F&B owns its own controller. Visual parity is good; behavioral implementation is duplicated.

### Duplicate form styles

- Settings `.settings-field` is current CI authority.
- Login `.field` converged visually to 48 px/12 px in final auth-brand overrides but remains separate.
- Admin direct `.field` uses older 52 px/14 px geometry.

### Duplicate card press/focus rules

F&B, Brand, History disclosure cards, Factsheet room cards and Settings user cards repeat:

- large-card active scale near `.992`
- opacity reduction near `.88`
- hover lift near `-2px`
- Sorbet/soft focus outline family
- 260 ms base transitions

### Duplicate motion values

Shared intended grammar is 160 / 260 / 420 / 280 ms with `cubic-bezier(.22,1,.36,1)`, but:

- Settings dialog intentionally uses 300 ms in / 180 ms out;
- F&B centered modal uses approximately 220 / 180 ms;
- Pack 49 still contains `.12s`, `.2s`, `.22s` action/nav transitions plus domain-specific longer environmental motion;
- Login primary uses a `translateY(1px)` active treatment instead of shared scale language;
- Admin direct has little consistent tactile transition behavior.

Only interaction controls should converge; environmental/scene motion is not a UI-control target.

## 6. Missing CI specimens / rules

CI should add explicit coverage for:

1. Today report/readings/status-panel ownership.
2. Today connection state and pull-to-refresh.
3. Advice/guidance block and air-quality scale marker.
4. Messages card, unread marker, badge and Open action.
5. Settings People actionable/disabled employee card.
6. Settings empty unauthorized System invariant as an explicit state example.
7. Login OTP/PIN group and auth validation/status states.
8. Business Card public/full-card presentation as a route-specific exception.
9. Public Business Card loading/unavailable state.
10. Dense responsive People/Admin list variant.
11. Compatibility-surface policy for direct Account/Admin documents.
12. Presentation-pack ownership boundary: content/markup/data in Supabase; visual semantic hooks in shell/shared CSS.
13. A component status label that distinguishes semantic shared implementations from compatibility aliases and intentional route exceptions.

## 7. Dead / legacy / hidden patterns

- `docs/CI-UI-ADAPTATION.md` describes the retired standalone unauthenticated CI microsite and must be superseded/archived.
- Old three-item-footer statements in `AGENTS.md`, `SINGLE-SHELL-ROUTER-INVARIANT-20260828.md` and the Settings CI architecture note are documentation drift.
- Pack 49's own footer links (Today / Guidance / Details / Messages) are legacy presentation markup; persistent shell normalization is the navigation authority.
- Hidden Settings avatar is redundant identity markup under the current persistent masthead.
- Physical `/account.html` and `/admin.html` are compatibility surfaces; app routing canonicalizes them to Settings. Do not use them as starter-kit patterns.
- `admin.css` appears to be legacy for normal in-shell routing; the direct Admin document does not load it. Confirm no live selector dependency before removal.
- `internal-auth.css` contains a duplicated Admin styling block in addition to login styles. This is a cleanup candidate only after direct Admin compatibility ownership is resolved.
- Route CSS declarations that intentionally rely on later `app-shapes.css` overrides (`50%`, `999px`) are technical debt; migrate/remove them gradually instead of treating them as canonical source examples.

## 8. Recommended semantic APIs

Only APIs with clear current reuse are recommended.

### Action card

```css
.app-action-card
.app-action-card-control
.app-action-card-title
.app-action-card-meta
.app-action-card-foot
.app-action-card-chevron
```

The primitive owns material, radius, focus-within, hover/press motion and whole-surface action semantics. F&B retains domain composition/status labels and may remain a compatibility alias initially. Brand should be first direct consumer.

### Disclosure

```css
.app-disclosure
.app-disclosure-trigger
.app-disclosure-panel
.app-disclosure-panel-inner
.app-disclosure-chevron
```

Plus one shared JS controller for one-open groups, ARIA/inert, scroll runway and reduced motion. History/Factsheet keep route-specific inner content classes.

### Field

```css
.app-field
.app-field-label
.app-field-control
.app-field-help
.app-field-status
```

Settings remains source authority; `.settings-field` becomes a compatibility alias during migration. OTP digit groups remain auth-specific.

### Dialog family

```text
shared dialog controller/base
  ├─ centered/settings form dialog
  ├─ centered media/share dialog
  └─ full-card presentation variant
```

Do not force all content into one panel geometry. Centralize only backdrop/open-close/focus/scroll/safe-area contracts that truly match.

### Dense-data wrappers

Do not create one universal table yet. Prefer a small shared scroll/accessibility wrapper plus documented variants:

- factsheet semantic table + sticky first column;
- responsive People/Admin dense list/grid.

## 9. Migration plan

### Phase 1 — inventory + deterministic baseline

- Preserve this audit as the ownership baseline.
- Add a route/component parity contract test.
- Expand browser smoke to 360×800, 390×844 and 768×1024 across Today, F&B, Messages, Brand, History, Factsheet, Settings and CI.
- Add standalone smoke for Login, Account compatibility, Admin compatibility and Business Card where data/auth can be safely stubbed.
- Record screenshots as workflow artifacts rather than committing generated visual noise.
- Add a live-pack hook audit or an explicit Pack 49 selector contract so Supabase CSS cannot silently escape shape/typography rules.

### Phase 2 — generic action-card primitive

- Derive exact interaction/material grammar from approved current F&B card.
- Add semantic shared CSS owner.
- Keep `.fnb-card` as a compatibility alias first.
- Migrate Brand cards to semantic classes first.
- Migrate UI Library card and compatible Settings People card behavior only after Brand validates.
- Do not alter F&B operational content/data access.

### Phase 3 — shared disclosure primitive

- Extract History/Factsheet common controller.
- Keep route-specific templates/content styles.
- Preserve exact 420 ms timing, single-open behavior, ARIA/inert and mobile scroll behavior.

### Phase 4 — shared fields

- Derive `.app-field` from Settings.
- Alias Settings first, then migrate Login presentation and Admin compatibility presentation without modifying authentication/data logic.

### Phase 5 — dialog family

- Generalize the Settings dialog base carefully.
- Bring F&B centered modal onto shared lifecycle/focus/scroll behavior where compatible.
- Treat Business Card full-card presentation as an intentional variant.
- Admin compatibility migration only after direct-page support decision.

### Phase 6 — Today/Messages semantic hooks

- Do not move Pack 49 operational content into GitHub.
- Add stable semantic hooks/classes to future pack markup where practical.
- Keep shared visual rules shell-owned.
- Add automated runtime inspection of live/current pack UI.

### Phase 7 — CI completeness

- Add every missing legitimate specimen and every intentional route-specific exception.
- Update component ownership and compatibility status in registry.
- Replace route-specific canonical code snippets with semantic shared APIs as migration proceeds.

### Phase 8 — drift enforcement

- Source gate for forbidden shapes/fonts/tracking and duplicate shared declarations.
- Browser gate for computed component geometry/motion/focus.
- Route coverage at required mobile/tablet sizes.
- Presentation-pack hook/selector gate.
- Screenshot artifacts for review.

## 10. Risk analysis

### Presentation packs

High drift risk because live CSS is remote and the existing GitHub source audit does not scan Supabase rows. Do not solve this by copying pack content into GitHub. Add remote/runtime checks instead.

### Authentication

Do not change `auth-client`, `auth-shell`, auth worker, RLS or login transaction behavior during style migration. Login visual primitives can be aliased later around existing semantic form controls.

### F&B operational data

Keep Supabase as canonical operational source. Action-card work must not reintroduce hardcoded promotion fixtures or change F&B RPC/data architecture.

### WebGL/weather/rain

No component migration requires modifying weather authority, location, rain, seasonal sky, shaders or environment rendering. CI must continue disabling route-wide overlay surfaces that would obscure atmosphere.

### Settings capability system

The fixed rail and capability manifest are architecture, not styling. Every test must continue to prove identical Account/People/Comms/System geometry for developer and normal employee, blank unauthorized content and gated `/ci` fallback.

### Service worker/cache

Do not modify `sw.js`. New shared CSS/JS must use current cache-busting conventions. Preview testing should use service workers blocked for deterministic UI tests plus a separate served-asset smoke.

### Business-card/public routes

The public renderer and root short-link routing are product contracts. Shared-style work may only change common presentation primitives, not slug resolution, data fetch, sharing or public routing.

### Compatibility Account/Admin

They are not normal in-shell destinations, but they still exist as direct documents. Removing them or their CSS is a separate deprecation decision. Until then, fix serious accessibility drift and prevent developers from copying them as canonical UI.

## 11. Definition of Done

We can say **“Everything in the app matches the CI system”** only when all of the following are true:

1. Every visible production component has a registry entry, shared semantic owner, or explicit route-specific exception with rationale.
2. CI specimens use the same production classes/controllers used by the app; no visual imitation is treated as authority.
3. Generic actionable cards no longer depend on F&B-specific names as the primary API.
4. History and Factsheet disclosures share one controller/style family while keeping route-specific content composition.
5. Generic fields have one semantic family; Login/Admin differences are documented variants rather than accidental copies.
6. Dialog lifecycle/focus/scroll/backdrop behavior comes from one family with approved variants.
7. Today/Messages remain Supabase-owned for content/data but use documented stable semantic hooks where practical.
8. All visible chips/tags/badges are classified as filter, metadata, status, navigation, or legacy; no decorative pill pattern survives.
9. All avatars/UI chrome use approved rounded-corner tokens; natural scene objects remain exempt.
10. Every icon-only control has an accessible name; disclosures expose ARIA state; dialogs trap/restore focus appropriately; keyboard focus is visible.
11. Reduced motion preserves understandable state across every canonical component.
12. Developer and normal-employee authorization tests prove the fixed Settings rail and `/ci` gate.
13. Persistent shell node identity survives every authenticated route transition.
14. 360×800, 390×844 and 768×1024 route tests show no horizontal overflow.
15. Typography and shape source gates pass with zero unresolved findings.
16. Runtime computed-style gates include presentation-pack UI, not only GitHub CSS.
17. Screenshot artifacts cover all key routes and component states and are reviewed before merge.
18. Stale standalone CI/three-footer documentation is removed or explicitly marked superseded.
19. Protected auth, weather/WebGL, service worker, push, F&B data and Business Card routing contracts remain unchanged unless separately approved.
20. A future developer can start at `/ci`, identify owner + semantic API + variants + accessibility + motion + prohibited patterns, and automated CI rejects a new unsupported visual primitive.

## 12. Safe implementation sequence selected from live evidence

The safest preview scope is:

1. Phase 1 parity test expansion and stale architecture-document correction.
2. Phase 2 semantic action-card primitive with Brand as the first direct consumer and F&B retained as compatibility alias.
3. Update CI registry/specimen to show the semantic action-card implementation.
4. Stop for preview approval before disclosure/form/dialog migrations.

This produces high leverage while avoiding auth, Supabase pack writes, operational F&B data, weather/WebGL, service worker, push and Business Card routing/data changes.
