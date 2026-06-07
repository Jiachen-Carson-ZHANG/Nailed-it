# Implementation Log

## 2026-06-07 — Discovery facets re-bucketed by catalog category (grouped filter + multi-tag cards)

What changed:
- The AI stores discovery facets with an unreliable `kind` (almost everything lands in `style`, including colors, lengths, and even the container service-module names). New `src/features/customer/style-facets.ts` re-buckets each facet **by its catalog category** (the labels are catalog item names): service modules (颜色与效果服务 / 美术设计服务 …) and uncategorizable labels are dropped; the rest map to filter sections 甲形 / 颜色 / 效果 / 美术 / 装饰 / 建构 / 风格.
- Home feed filter is now **grouped by section** (one labelled, horizontally-scrollable row per category) instead of a single mixed row, and no longer offers service-module containers as filters.
- Feed cards show **several category tags** (shape + color + effect …, up to 3) as pills instead of just the shape; each still toggles the matching filter.

Why:
- The filter was surfacing 颜色与效果服务 / 美术设计服务 (containers) and mixing all tags into one row; the card only showed the shape. Re-bucketing by catalog category gives a clean, sorted filter and informative cards without trusting the AI's `kind`.

## 2026-06-07 — Customer quote $0 fix, container modules hidden, step-2 stream, status lifecycle

What changed:
- **$0 quote bug fixed.** The base manicure is `ai_detectable='no'`, so the breakdown model never returns it — the customer own-photo quote was missing the $28/51-min floor and read $0 (e.g. a single included color). `parseBreakdownModelOutput` now injects the base manicure (from merchant settings, prep-duration summed from glossary children) into both `items` and `catalogSelections`, mirroring the merchant-side `withBaseManicure`. Regression test added.
- Container service modules (颜色与效果服务 / 美术设计服务 / 卸甲服务 …) are hidden everywhere they were leaking as line items: customer `StyleDetailPanel` + `ComponentBreakdownPanel` now drop `service_module` rows except the base manicure (type-based, not the old 0/0 heuristic, since some containers carry a duration), and `listConfigurableCatalogAction` drops them from the merchant "Add services" list (base kept so the selected list can render it).
- Booking step 2 now opens immediately on "Analyze my photo": the photo shows at once and the description + breakdown stream in there (`LoadingState` for the description while recognition runs), instead of holding the user on step 1 behind a spinner.
- Feed cards show the nail **shape** as a single pill (杏仁形 …) instead of multiple hashtags; the pill still toggles the facet filter.
- Merchant booking status is now a **lifecycle**, not arbitrary: pending_review → Confirm / Cancel; confirmed → Mark completed / Cancel; completed & cancelled are terminal (no jumping straight to completed or back to pending).
- Merchant "Manage collection" pill made smaller; library main action (Review/View/Edit) unified to the secondary style so Processing matches Archived.

## 2026-06-07 — Feed hashtags + facet filter (discovery)

What changed:
- Customer feed cards drop the description line and instead show up to 3 hashtags built from the style's `discoveryFacets`, prioritized style → addon → shape → mood → lifestyle (`styleHashtags` in `StyleCard`). Same vocabulary as the detail page's 风格标签.
- Home feed gained a facet filter bar (`StyleWaterfallGridClient`): a horizontal chip row of the distinct facet labels present in the loaded styles, OR-matched (a style stays if it carries any selected tag), client-side only — no backend change. Tapping a card hashtag toggles the same filter, so the hashtags and the filter share one vocabulary. Empty-result and clear states included.
- `HASHTAG_KIND_ORDER` exported from `StyleCard` so the filter bar orders chips the same way the card hashtags do; `NailStyleCard.description` (added earlier for the card blurb) removed as now unused.

Note: the customer style detail route only compiles on first navigation in dev; on WSL2/Node18 a concurrent-compile choke could leave it spinning ("can't click into the picture"). A clean `.next` restart resolves it — not a code issue (route returns 200 once compiled, and prod is prebuilt).

## 2026-06-07 — Upload/try-on flow, trending cache, workload grouping, library + review polish

What changed:
- Customer upload step: no-image state shows [Upload or take photo] + [Try with example]; once an image exists it shows [Change photo] + [Try on this look] with a full-width [Analyze my photo] below. "Change photo" now resets to a clean upload state instead of opening the picker in place. The ＋ drop-zone is only a picker while empty (a static preview afterward). Page-heading spacing tightened (eyebrow→title→content).
- "Try on this look" is the standalone entry into `/customer/try-on`; the try-on panel gained a top "← Back" (router.back) so there is a way out.
- Trending (热门款式) is a live web search and now caches at module level: it runs once per session and reuses the result when the customer returns to home; Refresh still forces a new fetch (`resetTrendingCacheForTests` clears it in tests).
- Technician workload (`TechnicianRosterCard`) regrouped: each technician's active bookings collapse by day (native `<details>`, soonest day open), and each booking expands to status + customer + quote + a link to the full booking — mirrors the customer Me-tab pattern and stays readable across a long horizon.
- Merchant profile "Manage collection" is now a pink pill with an arrow on the Showcase line (was an unstyled link that wrapped under the title).
- Merchant review (published edit): "Save changes" is disabled until something actually changes (title/description/selection baseline diff), with a "← Back" beside it. Per-set items (incl. the base manicure) keep their quantity locked by design.
- Style library: back affordance restyled into a pill (no raw "←" glyph), upload tile enlarged, Delete added to the Archived tab (hard-delete any non-published style), subtitle now says designs are published "for customers to discover".

## 2026-06-07 — Customer upload UX + merchant catalog grouping + breakdown noise cleanup

What changed:
- Merchant review "Add services" list is now grouped by catalog category (基础护理 / 建构延长 / 颜色与效果 / 美术设计 / 装饰 / 卸甲 / 其他) instead of one flat list. `ConfigurableCatalogItem` carries `category`; the workspace renders non-empty sections with a small heading. Search still filters before grouping.
- Customer breakdown panels (`StyleDetailPanel` 款式构成, `ComponentBreakdownPanel`) now hide container service-module rows that carry neither price nor time (e.g. 颜色与效果服务 / 建构服务) so they stop showing "— —" noise. The priced base manicure and zero-price billable colors stay.
- Feed cards (`StyleCard`) show a 2-line merchant description under the title (`NailStyleCard.description` optional; published styles already carry it).
- Customer own-photo upload (`ImageUploader` + booking step 1) reworked: the drop-zone/＋ is itself a file picker; CTAs sit on one row; "Analyze my photo" only appears once a reference exists (paired on one row with "Change photo"); page title pinned to the design-system page-title scale (was UA 2em, oversized/wrapping).
- "Try with example" replaced by "Try on this look", which is the standalone entry into the existing `/customer/try-on` flow (your own photo is just as valid a look to preview). The now-unreachable sample-recognition path (`getSampleRecognition`) was removed; the upload step always uses the live recognizer.
- Booking step 3 (quote) now puts "← Back" and "Next: choose time" on one row (`.booking-step-actions` is a 2-col grid); previously the back action sat on its own row above and prefill had no back at all (prefill back now returns to the style detail).

Why:
- The flat catalog and the always-present disabled "Analyze" button were the two biggest mobile-fit/scannability complaints; grouping borrows the Manage tab's structure without porting the glossary chip UI (keeps the correct server-derived pricing untouched).
- The "— —" parent rows were grouping containers leaking into a customer-facing table.

Tradeoff:
- Category→section mapping is a curated allowlist in the workspace (unknown categories fall to 其他), mirroring the existing `durationAggregatingPackageIds` allowlist pattern until the Dictionary carries a section column.



What changed:
- `/merchant/styles` no longer asks for a title or embeds the full catalog editor inside collection
  cards. It exposes one image upload tile and routes to `/merchant/styles/[id]/review` immediately
  after the private original and `processing` row are stored.
- The dedicated phone-sized review workspace shows the stored image and exposes an explicit
  **AI breakdown** action. That action runs strict stored-image AI analysis to suggest the
  title/description and every billable price/time catalog selection, then the merchant edits and
  approves before publication. Quote preview, Save Draft, and Publish all use deterministic server
  actions.
- The storage seam can download private originals. Migration `0016` adds an atomic, stale-recoverable
  analysis claim so concurrent page loads do not spend duplicate model calls, plus server-only RPCs
  that atomically commit the normalized AI suggestion and `processing` → `needs_review` transition,
  or move a failed analysis into editable manual review.

Why:
- Inline AI made upload navigation slow, while the card-embedded editor cramped a large approval
  task into the collection page. Separating upload from review gives immediate feedback, and making
  AI an explicit button keeps the merchant in control before suggestions alter the draft.

Tradeoff and deployment:
- Apply `supabase/migrations/0016_merchant_style_analysis_workflow.sql` before using this workflow
  against live Supabase. There is still intentionally no batch-upload/review UI.

Aligned assumptions:
- Stored private media is the analysis input; browser-provided recognition, price, duration, and
  status are never authoritative.
- The relational `merchant_style_item` set and derived preview remain one atomic configuration.

## 2026-06-06 — Manual merchant review of the 35 backfilled styles (data correction)

The 35 demo styles were AI-configured before the per_set / JSON enforcement landed and there is no
merchant to approve them, so I acted as the reviewer: viewed every image against its breakdown and
corrected the data (no code change; rewrote rows via `set_merchant_style_config`, preserving each
style's AI title / description / discovery_facets).

Errors found and fixed (28 of 35 styles; 7 were already correct):
- **per_set qty > 1 (14 styles):** french_tip / glitter / cat_eye / chrome_powder / aurora_powder
  carried qty up to 10. Forced to 1. This also un-inflated price: the old `deriveSnapshot`
  multiplied price by qty for ALL units, so e.g. 8256 was `$178` (base + french×10) and is now `$43`,
  8259 `$508 -> $118`.
- **per_finger counted as pieces:** `rhinestone_small` is priced per finger but the model emitted
  raw stone counts (×22, ×30). Capped to the visible finger count (e.g. 8276 ×22 -> ×2, 8259 ×30 -> ×8).
  This was the main driver of the 6–8 hour durations.
- **absurd per_piece:** 8274 `metal_charm ×21 -> ×5`.
- **missing base manicure:** 8286 had no `basic_manicure_service` (the JSON-parse straggler);
  injected it (`$20/15min -> $48/66min`). Every set now has the manicure floor.
- **false positives dropped / under-config fixed:** removed elements absent from the photo
  (e.g. metal_charm on a flat-painted nail), and enriched two base-only-but-decorated styles
  (8257 bejeweled, 8278 cloud + stars).

Verified: 0 per_set>1, 0 missing base, 0 per_finger>10, 0 piece>15 across all 35.

Note: a few elaborate styles still derive long durations (8280 259min, 8279 196min). Those are the
catalog's per-finger paint times (hand_paint 30min, pattern_art 45min per finger), not quantity
errors — the counts are now image-accurate. Tightening the per-finger duration model is a separate
catalog-level decision.

Root-cause analysis + improvement plan: [style-config-recognition-error-analysis.md](style-config-recognition-error-analysis.md).

## 2026-06-06 — Customer style detail reads the published merchant config

What changed:
- `StyleDetailPanel` now renders the published merchant config instead of the legacy
  `recognition` shape (which is null for AI-configured styles, so the detail box showed nothing
  useful). It wires three things from `PublishedMerchantStyle`: the AI `description` as the style
  brief, `catalogBreakdown` as a 款式构成 layer list (catalog name + type badge + quantity, no
  price), and `discoveryFacets` as grouped 风格标签 tags.
- The "Your quote" pricing section is intentionally left untouched (owned by the in-flight quote
  UI work). The breakdown here is composition-only; price/duration stay in the quote section.
- Brief falls back `description -> recognition.otherNotes -> placeholder`, so the seeded mock
  fixtures (empty description) still render.

Why: the merchant upload pipeline already produces a relational catalog breakdown + AI name +
description, but the customer detail page ignored all of it. This makes the configured content
visible when a customer opens a merchant picture.

Tests: `src/app/customer/style/[id]/page.test.tsx` gains a case asserting 款式构成 + the base
layer + 风格标签 + facet tags render. Full suite 256 green, tsc clean.

## 2026-06-06 — Strict merchant-style AI config + per-set quantity enforcement

What changed:
- Single-upload breakdown and style-name calls now request strict OpenRouter JSON Schema output and
  validate the parsed result again at runtime. Missing sections, wrong section ids, malformed item
  fields, duplicate ids, and extra naming fields fail and retry instead of silently becoming an
  empty or partial configuration.
- Added one shared `per_set` quantity rule. AI parsing, `quoteService`, merchant-style snapshot
  persistence, the review UI, and migration `0015` now agree that a per-set line has quantity one.
- The merchant review editor now lists every billable price/time review item, including
  merchant-priced/no-default items. It displays effective price, duration, and unit; unavailable
  items remain visible but disabled. Single uploads still require explicit merchant publication.

Why:
- AI JSON is untrusted even when it parses syntactically. Wrong-shaped output must never enter
  deterministic pricing, and a per-set model quantity must not multiply a whole-set service.

Tradeoff:
- Applying `0015` stops future invalid relational writes but does not rewrite historical rows.
  Existing invalid per-set style items and their derived previews require a separate deterministic
  reconciliation so items and snapshots change together.
- Batch configuration stays an admin script; no batch-upload/review UI was added.

Aligned assumptions:
- AI proposes catalog ids; the merchant approves the single-upload draft; server services derive
  price/duration and persist the normalized selections.
- Runtime validation remains authoritative even when the provider claims schema compliance.

## 2026-06-06 — Live catalog-id recognizer (reuse the breakdown) + glossary unification

The merchant style "brain": instead of a parallel recognizer, the existing customer breakdown is
reused — it already turns an image into catalog selections.
- **Glossary unified onto the catalog.** `src/data/glossary.ts` no longer hand-lists entries; it
  derives them from `src/mock/catalog.ts` (109 ids). The breakdown prompt can now only ever name valid
  catalog ids — the 114-vs-109 drift (7 dead ids the model could emit, e.g. `extension_short`; 4
  missing new ids) is structurally gone. Only `breakdown.ts` consumes the glossary; behaviour
  unchanged, ids corrected.
- **`recognizeStyleConfig` (`src/nail-ai/style-config-recognition.ts`).** image → `runGlossaryBreakdown`
  (catalog-id detection) → `buildStyleConfig` (validated split: priced→selections, descriptive→facets)
  + one naming call → `{ catalogSelections, discoveryFacets, name, description }`. Same vision pipeline
  as the customer side; no second recognizer.
- **`npm run configure:styles --ai`.** Backfills the 35 live styles from their Storage images: real
  per-image breakdown, AI name, AI description, derived price. Validated live on one row →
  `奶油香槟金箔钻`, `gradient×5 + rhinestone_large + foil_piece×2 + chain_charm`, $45 / 125 min (vs the
  $28 default). `--limit=N` caps the run; without `--ai` it falls back to the curatable default.
- **AI-suggest is the default on merchant upload.** `uploadMerchantStyleAction` runs `recognizeStyleConfig`
  after the upload and applies it (best-effort: a missing key / model error / no priceable items leaves
  the draft in `needs_review` for manual config). The merchant review form already reads the style's
  `catalogBreakdown` / `description` / `title` into editable fields, so the merchant edits the AI
  suggestion before publishing. `set_merchant_style_config` now also sets the title (the AI name),
  added to migration `0014` (`p_title`, empty preserves the existing title); `service.applyConfig`
  derives the preview from the selections and persists items + facets + description + name.

Note: upload AI runs inline (two model calls, ~seconds) so the upload request blocks until config
returns; acceptable for the demo. Naming/description quality depends on the model run.

## 2026-06-06 — Merchant style integrity hardening (migration 0014, audit follow-up)

Pure-SQL follow-up to the second Phase 2 audit (0013 already applied, so fixes land in `0014`; RPC
signatures unchanged → no application code changes):
- `merchant_style_item` quantity gains an upper bound (`<= 100`) to match quoteService's accepted range.
- `set_merchant_style_config` now validates `p_items` / `p_discovery_facets` are JSONB arrays and refuses to edit an archived style (it previously checked only id + merchant). Items + derived preview are still written in one transaction so they can't diverge.
- `publish_merchant_style` now requires ≥ 1 relational item and **no longer writes the preview snapshot** — `set_merchant_style_config` is the sole atomic writer of items + preview, so a concurrent reconfigure can't leave items from B with a price from A (audit finding 3). Signature unchanged (preview params accepted but ignored); the publishable CHECK still guarantees a non-null preview at publish.
- Fixed `scripts/backfill-melissa-assets.ts`: stopped sending the dropped `catalog_breakdown` column (rerun would otherwise fail after uploading assets).
- ADR-0005 P6.5 row updated: migrations `0009`–`0014` are live; the relational breakdown is authoritative.

Apply: run `0014` in the Supabase SQL editor.

Still open from the audit (next): the live catalog-id recognizer (reuse `runGlossaryBreakdown`, which already emits `catalogSelections`) + glossary→catalog prompt unification (the breakdown prompt is built from `src/data/glossary.ts`, 114 ids vs the catalog's 109, so the model can name dead ids); auth (no authenticated identities; service-role bypasses RLS).

## 2026-06-06 — Phase 2.5 authoritative quote contract

What changed:
- Catalog selections now drive the entire configured booking path. Availability quotes each
  technician separately (including `staff_item_duration`), attaches that exact quote to the offered
  slot, and creation requotes the same selections + technician before the atomic write.
- Published styles open directly on their frozen merchant-reviewed quote and no longer rerun image
  recognition during booking.
- Custom-image breakdowns return catalog selections. The breakdown API loads effective merchant
  pricing server-side and requotes through `quoteService`; browser-supplied prices/durations were
  removed.
- Merchant Manage now reads/writes `merchant_pricing` through server actions and renders the
  generated catalog. The obsolete `glossary-settings-store.ts` localStorage path was deleted.
- `quoteService` rejects non-integer, non-finite, zero/negative, and excessive quantities.

Why:
- Displayed totals, offered duration, and persisted booking duration could previously come from
  three different contracts. This bridge makes one server-derived catalog quote authoritative
  before Phase 3 adds more AI/configuration behavior.

Tradeoff:
- The legacy flat snapshot action remains as a compatibility fallback for old or unconfigured
  drafts. It always enters `pending_review`.
- `src/data/glossary.ts` still duplicates prompt metadata from the generated catalog; it no longer
  controls pricing but should be unified during the remaining live recognizer work.

Aligned assumptions:
- Browser catalog ids/quantities are choices, not price/duration authority.
- Published styles use curated relational `merchant_style_item` selections and do not rerun AI.
- See `docs/plans/2026-06-06-phase-2-5-authoritative-quote-contract.md`.

Verification:
- `242` Vitest tests passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

## 2026-06-06 — Style config pipeline, server-derived pricing, relational breakdown (Phase 2)

Resolves the second Phase 2 audit (server-derived publishing, config persistence, customer/booking
wiring, quantity-aware duration, relational breakdown). Earlier in the day this section overstated a
`description`-field-plus-orphaned-helper as "Phase 2"; the entry below is the real, wired state.

Pricing + duration are now DERIVED, never client-supplied:
- Duration-aggregation policy made explicit (`durationAggregatingPackageIds` allowlist in `catalog.ts`). The old "aggregate any parent with billable='no' children" heuristic silently changed `color_effect_service` (20→24) and `finish_service` (15→51); now only `basic_manicure_service` (30→51) aggregates. (Audit finding 2.)
- `quoteService` scales booking duration by quantity for `per_finger`/`per_piece` (5 painted nails = 5× one nail), counted once for `per_set`/`fixed`/`included`/`tag_only`. `QuoteLine.durationMin` is now the line total. (Finding 6.)
- Merchant `publish` no longer accepts price/duration. It takes catalog `selections`, runs them through `quoteService`, and persists the derived snapshots. The merchant form is now a catalog-item selection editor (price/time shown as auto-calculated). (Finding 1.)

Config pipeline + relational model:
- `buildStyleConfig(recognized: RecognizedCatalogItem[], catalog, confirmedUncertainIds?)` now flows through `bucketRecognition` + `toCatalogSelections` (validates ids, drops unknown/non-detectable, preserves quantity), then splits: priced billable → `catalogBreakdown`; descriptive/containers → `discoveryFacets`. (Finding 3.)
- New relational table `merchant_style_item` (FK → `catalog_item`, quantity) is the authoritative breakdown; `merchant_style.catalog_breakdown` jsonb is dropped. `recognition` stays jsonb. `MerchantStyle.catalogBreakdown` is now `CatalogSelection[]`, read by join. New `set_merchant_style_config` RPC writes items + facets + description + derived snapshots in place, preserving status/media (finding 7). (Migration `0013`.)
- `scripts/configure-merchant-styles.ts` (`npm run configure:styles`) backfills the 35 live styles in place: each gets a curatable breakdown (default `basic_manicure_service`; per-id `OVERRIDES`), derives price/duration, writes via the RPC. Replaces the fake flat $88/90 snapshot with a real derived $28/51. Idempotent.

Customer/booking consumption (finding 4):
- A published style booking now books its CURATED `catalogBreakdown` → `quoteService` → relational `booking_item` rows, via `createBookingWithThreadFromSelections` (booking-service) + `createBookingFromStyleAction`. The customer draft carries `styleId`; the confirm step branches to the style action (else the legacy recognition snapshot). Same server guards (forced `pending_review`, availability enforced for the derived duration).
- The booking quote + detail show the style's derived price + `description` for a prefilled style instead of the flat rule-based estimate.

Migrations to apply (manual SQL editor — no CLI/exec_sql here), in order:
- `0012_merchant_style_description.sql`: `merchant_style.description` + 9-param `publish_merchant_style`.
- `0013_merchant_style_item.sql`: `merchant_style_item` table, drop `catalog_breakdown`, `create_merchant_style` (now carries description, no breakdown), `set_merchant_style_config`.
Then `npm run configure:styles` to backfill the 35.

Known gaps: the live catalog-id vision recognizer is still not wired, so the 35 get a default breakdown pending per-image curation (`OVERRIDES` in the script). Auto-config on manual upload (recognizer → buildStyleConfig at upload) is deferred; merchants configure via the publish selection editor.

## 2026-06-06 — Catalog dictionary refresh + platform default price (Phase 1)

What changed:
- New generator `scripts/generate-catalog.mjs`: parses the Lark "Dictionary" CSV export → `src/mock/catalog.ts`, validating enums, parent refs, units, and `affects=yes`→duration. It refuses to emit data the integrity test / DB CHECKs would reject (caught real issues: `na` sentinels for non-timed tags, the dropped allowed-units column).
- Regenerated `catalog.ts`: 112 → 109 items (−7 `extension_*`/`magnetic_special_effect`/`removal_short_extension`/`texture_cat_eye_light`, +4 `removal_short_origin`/`dual_color`/`aurora_powder`/`pearl_powder`). The sheet dropped its allowed-units list, so `allowedPricingUnits` is now the single default unit.
- New `CatalogItem.defaultPriceCents` (null = no platform default). `pricing-resolver` precedence is now override → `defaultPriceCents` → (required ? unresolved : free). This closes the "$0 catalog quote" gap (`catalog_default` used to always return price 0).
- Migration `0011_catalog_default_price.sql`: adds `catalog_item.default_price_cents`, drops the 7 removed items (all leaves; no FK refs). `scripts/seed-supabase.ts` now writes `default_price_cents`; re-run it after applying `0011`.

Pricing/time model (confirmed with product):
- `basic_manicure_service` is the only priced *parent* (a $28/per_set package); its 5 children are `billable=no`, time-only. Other parents are unpriced containers; their priced leaf children are à la carte add-ons.
- Base-package booking time = **sum of its child steps**, not the parent's stored duration (decided 2026-06-06). The aggregation lives in the quote/breakdown layer (Phase 2); `catalog.ts` stays a faithful mirror.

Apply: run `0011` in Supabase, then `npx tsx scripts/seed-supabase.ts`.

Known follow-up: `src/data/glossary.ts` is a hand-maintained second copy of the dictionary (consumed only by the breakdown route, not yet wired into the config pipeline). It still lists the 7 removed ids and lacks the 4 new ones. Reconcile it in Phase 2 (ideally unify it with the generated catalog rather than maintain two copies).

## 2026-06-06 — Remove obsolete localStorage operations store

What changed:
- Deleted `src/mock/operations-store.ts` and its legacy localStorage behavior/tests.
- Moved the remaining demo customer identity into `src/mock/customers.ts`.
- Removed the obsolete operations-store reset from the confirm-page test.

Why:
- Booking, availability, conversation, and message runtime consumers are DB-backed. Keeping a
  second localStorage implementation suggested a valid fallback path and made the persistence
  architecture harder to understand.

Aligned assumptions:
- The booking draft remains intentionally browser-local in `sessionStorage`.
- Mock booking/conversation records remain as deterministic in-memory repository seeds for tests.

## 2026-06-06 — Melissa live style asset backfill

What changed:
- Added `scripts/backfill-melissa-assets.ts` and `npm run backfill:melissa-assets`.
- The script uploads `nail_assets/*.jpg` into `merchant-style-originals` and
  `merchant-style-published`, then upserts deterministic `media_asset` and published
  `merchant_style` rows for `merchant-nailed-it`.
- Live Supabase now has 35 Melissa media rows, 35 published style rows, 35 private originals,
  and 35 public published objects. The first public object returns HTTP 200.
- Fixed the merchant calendar's hardcoded May 2026 month. It now derives the displayed month from
  the selected/default booking date, so today's live cross-actor QA booking appears on the calendar.

Why:
- P6.5 had the database/storage/UI wiring, but the live project still had empty style buckets and
  empty `media_asset` / `merchant_style` tables. Customer discovery and Merchant Me need real
  merchant-owned resources, not only external mock URLs.

Tradeoff:
- The backfill uses reviewed collection-level preview values (`$88`, `90 min`) and leaves
  recognition/catalog JSON empty. This avoids fabricating AI/catalog review evidence before live
  P6 emits catalog ids.

Aligned assumptions:
- The script is idempotent for the Melissa set because ids and object paths are deterministic.
- Future merchant uploads still go through the server action review/publish lifecycle.

## 2026-06-06 — P4d: atomic booking + thread create (closes the deferred RPC gap)

What changed:
- New migration `0010_booking_thread_rpc.sql`: `create_booking_with_thread(p_booking, p_items, p_thread, p_messages)` calls `create_booking` (same transaction, reuses the GiST overlap handling) then inserts the conversation thread + its messages. Booking + items + thread + greeting now commit in **one transaction**. Server-only (revoked from public/anon/authenticated, granted service_role).
- `IntervalBookingRepository.createWithThread(booking, items, thread)` added. Supabase impl calls the RPC; the in-memory impl writes the booking then the thread (via an injected conversations repo) and rolls the booking back if the thread insert fails, so both sides honour the same atomic contract.
- `bookingService.createBookingWithThreadFromSnapshot(input, buildThread)` builds the snapshot booking + item (shared `buildSnapshot` helper) and does the single atomic write; `buildThread(booking)` lets the caller derive the thread from the server-generated booking id.
- `createBookingAction` now uses it and **deletes the two-step insert + compensating-cancel** block. No orphan booking and no empty thread are possible anymore.

Why:
- This was the last residual gap from the hardening audit (finding #5). The previous compensating cancel covered booking↔thread but not thread↔message (an empty thread could survive a message-insert failure). A single RPC removes the partial-state surface entirely instead of chaining more compensation.

Apply: run `0010` in Supabase (after `0009`).

## 2026-06-06 — P4d create-path hardening: untrusted recognition + availability at write time

What changed (`src/lib/actions/booking-actions.ts`):
- **Client recognition is untrusted, so the snapshot bridge never auto-confirms.** Status is no longer derived from the client-supplied confidence (`requiresMerchantReview` dropped from this path) — it is forced to `pending_review`. A booking only leaves review once the recognition/catalog selections are issued server-side (live P6). Price/duration are still recomputed server-side from the recognition.
- **Availability is enforced at write time, not just displayed.** Before the create, `createAvailabilityService(repos).findAvailable` re-derives the available technicians for the exact slot + server-recomputed duration; if the chosen technician is not among them the action throws `technician_unavailable`. The DB GiST exclusion constraint only blocks booking-vs-booking overlap — it does not stop bookings during breaks, blocked time, or outside working hours. This closes that gap.

Why:
- The two residual trust holes after the first hardening slice: (1) a tampered high-confidence recognition could auto-confirm, and (2) a hand-crafted request could book a technician during a break or off-hours (only the grid filtered those, and the grid is advisory).

Tests:
- The three seed tests (calendar / customer profile / merchant booking-detail) booked `tech-anna` at `10:00`, but Anna opens `11:00` — the old create path silently accepted it. Moved those seeds to `11:00` (valid). The confirm-page test now asserts a high-confidence booking still lands in `pending_review` (the regression guard for "do not trust client confidence"); the old low-confidence variant was removed because confidence no longer gates status.

Still deferred (unchanged): booking + thread + initial message is not one transaction. The booking↔thread orphan is handled by the compensating cancel; a single combined Postgres RPC remains the ideal final mechanism (needs a migration).

## 2026-06-06 — P6.5 merchant style library + media foundation

What changed:
- Added `media_asset` + `merchant_style` and private-original/public-published Supabase Storage
  buckets in migration `0009`. Transactional RPCs create the paired DB rows and publish the media
  path + style state.
- Added the merchant-style repository seam, in-memory/Supabase implementations, Storage adapter,
  upload/publish service, and scoped customer/merchant server actions.
- Customer home and style detail now read published merchant styles. Merchant Me shows the
  collection preview; `/merchant/styles` supports upload, reviewed price/duration, publish, and
  archive.

Why:
- Merchant-owned showcase images are a core customer acquisition surface and the foundation for
  P7 completed-work tracking. Image bytes belong in object storage; ownership, lifecycle, and
  reviewable metadata belong in Postgres.

Tradeoff:
- New uploads require the merchant to enter reviewed preview price/duration before publishing.
  Live recognition-to-catalog remains P6 work; P6.5 does not auto-publish or treat AI output as
  pricing authority.
- There is still no auth system. Actions are fixed to the demo merchant, and real tenant
  authorization must be added with authentication.

Aligned assumptions:
- Customer actions expose published styles and public image URLs only.
- Private originals and generated object paths never come from browser-controlled values.
- P7 completed-order photos create draft records through this same media/style foundation.

## 2026-06-06 — P4d security/correctness hardening (pre-cleanup audit)

What changed:
- Server-derive everything that matters: `createBookingAction` takes the recognition + slot, not price/status/customer. customerName is fixed to the demo customer server-side, price/duration are recomputed from the recognition via the DB pricing rules, and review status from the confidence policy. A browser can no longer book a $0/auto-confirmed appointment.
- Scoped reads: `listMerchantBookingViewsAction` (calendar, booking detail) vs `listCustomerBookingViewsAction` (profile, server-filtered to the demo customer). Conversation actions split into customer/merchant-scoped, set `authorRole` server-side, and authorize before appending.
- Merchant profile reads bookings/conversations from the DB (was localStorage); booking-detail status persists via `setBookingStatusAction`.
- `listAvailableSlotsAction` replaced the legacy fixed-date helper with `findAvailableTechnicians` over the next 7 days from today, honouring working_plan + blocked_time + DB bookings.
- Privacy copy + current-state corrected (data lives in the DB).

Why:
- The cutover server actions are the trust boundary now; the browser was supplying identity, money, status, and role. These move authority to the server as far as is possible without auth.

Tradeoff / known gaps:
- No auth system, so there is no real server-derived actor: a direct caller could still hit the merchant-scoped reads. True cross-account authorization needs auth (future ADR).
- Booking + thread + message creation is not one transaction. The booking↔thread case is handled by a compensating cancel; the residual gap (thread inserted, its first message insert fails → thread with no greeting) is benign and deferred. A single combined Postgres RPC is the ideal final mechanism.

## 2026-06-05 — P4c/P4d write cutover: confirm flow books to the DB (8bba335)

What changed:
- `src/lib/services/booking-service.ts` gained `createBookingFromSnapshot`: the current flat estimate → one synthetic `booking_item` (catalogItemId null) → the same transactional interval create + tenant guard + exclusion constraint.
- `src/lib/services/booking-adapter.ts` maps an interval booking + items back to the flat UI `Booking` shape (date/time via merchant tz, quote = Σ item prices, in_progress→confirmed, neutral placeholder recognition); `timezone.instantToZonedParts` is the reverse of `resolveSlot`.
- `IntervalBookingRepository.listByMerchant` added for the reader surfaces.
- `src/lib/actions/booking-actions.ts` (`createBookingAction`, server action): creates the interval booking + linked conversation thread, returns the flat UI Booking. If the thread insert fails it compensates by cancelling the booking (frees the slot; no orphan confirmed booking).
- The customer confirm page calls the action instead of the localStorage `createBookingFromDraft`.

Why:
- Begins the real DB cutover on the interval model (decision B), using the snapshot bridge so it does not block on live P6 catalog ids.

Verified live:
- Booking through the confirm page created the row in Postgres (tech-anna, 10:00 SGT → 02:00Z, 90 min, confirmed), a null-catalog snapshot `booking_item` ($120 → 12000 cents), and the linked `conversation_thread`.

Tradeoff / status:
- Write only so far. The reader surfaces (calendar/profile/detail/messages) still read localStorage; the branch is mid-cutover and must not merge until reads land (no shipped split-brain).

## 2026-06-05 — P6 (partial): recognition → catalog bridge

What changed:
- New pure domain layer `src/domain/recognition-catalog.ts`: `aiDetectableCatalogItems` (the constrained subset the model may emit — everything except `aiDetectable='no'`), `bucketRecognition` (validates ids, routes `weak`/`user_confirmed`/low/non-finite-confidence to an `uncertain` bucket, rest to `detected`), and `toCatalogSelections` (detected + user-confirmed uncertain → `CatalogSelection[]`, merging quantities).
- `CatalogSelection` is now defined once in `src/domain/catalog.ts`; `quoteService`'s `QuoteSelection` aliases it (removes a duplicate type, keeps the domain off `lib/`).
- Deterministic mock recognizer output `src/mock/catalog-recognition.ts` for tests and the no-key demo path.

Why:
- This is the bridge the DB cutover needs: it turns recognizer output into the catalog selections `quoteService`/`bookingService` consume, so a booking can be quoted from real catalog items instead of the flat estimate.
- It validates ids rather than mapping visual attributes, per ADR-0005 (no fuzzy attribute→billable table).

Tradeoff:
- Only the pure bridge + a mock recognizer ship. The live LLM in `src/nail-ai` still emits free-form attributes; wiring it to emit catalog ids is deferred (it is main's contested AI area and needs keys to validate).

Aligned assumptions:
- The DB cutover (rest of P4c + P4d) will feed `toCatalogSelections(...)` into `bookingService.createBooking`.
- The live recognizer change should reuse this contract rather than introduce a parallel mapping.

## 2026-06-05 — P4c safe slice: duration-aware local availability + sessionStorage draft

What changed:
- `findTechnicianSlots` now models existing bookings and requested slots as intervals and uses `intervalsOverlap`, so a long booking blocks every overlapping later start.
- The local availability wrapper falls back to 60 minutes when malformed draft or stored booking durations would otherwise create zero-length intervals.
- The confirm page threads the draft estimate duration into the localStorage-backed operations store availability query.
- `booking-draft.ts` now stores the customer draft in per-tab `sessionStorage` instead of module memory, with guarded snapshot consumption for the confirm page.

Why:
- This fixes the live PRD bug: technician time is locked for the style's full duration.
- This removes server/shared module state from the customer booking draft without cutting the UI over to the DB before all read surfaces are ready.

Tradeoff:
- The live path is still localStorage-backed. This is intentional to avoid DB/localStorage split-brain before the booking write and reader surfaces are switched together.

Aligned assumptions:
- P4a/P4b DB tables, RPC, and services remain the target architecture.
- P4d must move the related reader surfaces with the DB write path, or customer/merchant views can disagree.
- P6 catalog recognition is still needed for a clean quote-to-booking item mapping.
