# Plan: style configuration pipeline + DB favorites + dictionary refresh

Date: 2026-06-06
Status: Phase 0 + Phase 1 done (live `catalog_item` = 109 rows / 37 priced). Phase 2 code complete.
Phase 2.5 authoritative quote bridge is implemented: merchant pricing is DB-backed, configured
custom images and published styles use catalog selections, and the exact technician quote drives
display, availability, and booking creation.
- Finding 1 derived publishing, 2 config pipeline + finding-2 duration allowlist, 3 recognition
  objects, 4 customer/booking wiring, 6 quantity×duration — all built + tested.
- Decisions locked: relational `merchant_style_item` (jsonb breakdown dropped); per_finger/per_piece
  duration scales with quantity.

REMAINING (user/live steps): apply `0012` + `0013` in the Supabase SQL editor (no CLI/exec_sql here),
then `npm run configure:styles` to backfill the 35 live styles' relational breakdown + derived price.

Still open (separate from Phase 2.5): glossary prompt metadata (`src/data/glossary.ts`) still
duplicates the generated catalog, though it no longer owns pricing. Live catalog-id recognizer is not
wired, so the 35 use a default breakdown pending curation (`OVERRIDES`).
Favorites (Phase 4) not started. The canonical `scripts/seed-supabase.ts` is still all-or-nothing —
add per-table flags before relying on it.

## Problem

P6.5 shipped the merchant style **library** (storage + lifecycle) but not the **brain**: a style row
has empty `recognition` / `catalog_breakdown` / `description`, and nothing fills them from an image.
We have ~35 demo images uploaded but unconfigured (no breakdown, no name, no price, no description),
the merchant can only edit title/price at publish (not the breakdown layers), customer "likes" live in
`localStorage` (no trend signal), and the Lark Dictionary changed (so `catalog.ts` + the DB
`catalog_item` rows/constraints are now potentially stale).

## Locked decisions (from brainstorm)

1. **Predefined config = frozen seed.** Run the AI config once on the 35 (+6), curate, commit as seed
   rows. No runtime AI for predefined styles. Deterministic demo.
2. **Favorites = DB-backed**, feeding a merchant-facing popularity/trend signal (the pitch's "trend
   tracking"). No-auth caveat: scoped to the demo customer until auth lands.
3. **Breakdown layers = catalog-item references.** `catalog_breakdown` is `CatalogSelection[]`
   (`{catalogItemId, quantity}`). Price/duration are **derived** (pricing-resolver + quoteService over
   the dictionary/merchant pricing), never hand-edited. The merchant edits *which* items + quantities.
4. **Lark Dictionary is canonical.** Regenerate `src/mock/catalog.ts`, then migrate `catalog_item`
   rows + reconcile the DB CHECK constraints (migration `0002` mirrors the TS unions).

## Sequencing rule

The Dictionary (C) is bedrock — layers and pricing *reference catalog items*. Generating predefined
config (A) before the dictionary is final means redoing it. **C before A.** Favorites (B) is
independent and can run in parallel or last.

## Data-model changes

- `merchant_style`: **add `description text`**. `catalog_breakdown` (jsonb) now holds
  `CatalogSelection[]`. `discovery_facets` carries the hashtags/feature tags (no new field).
  `preview_price_cents` / `preview_duration_min` become **derived snapshots** computed from the layers
  at config/publish time (not independently edited).
- New table `style_favorite (id, customer_name, merchant_style_id, created_at, unique(customer_name,
  merchant_style_id))`. FK → `merchant_style(id) on delete cascade`. RLS + service-role only.
- Migration `0011`: `catalog_item` refresh (from regenerated dictionary) + updated CHECK constraints.
- Migration `0012`: `merchant_style.description` + `style_favorite` table + (optional) a
  `merchant_style_popularity` view counting favorites.

(Exact migration numbers assume nothing else lands first; renumber if so.)

## Phases (each ships green: tsc + tests + build, docs updated)

### Phase 0 — Inputs (blocks everything)
- **Locate the 35**: are they live `needs_review` rows in Supabase, or a local folder of images?
  Determines whether the seed-generation script reads them from Storage or ingests a folder.
- **Pull the Lark Dictionary diff**: what changed vs `src/mock/catalog.ts` (new items / renamed /
  retyped / new categories). Drives Phase 1's migration.

### Phase 1 — Dictionary refresh (C, bedrock)
- Regenerate `src/mock/catalog.ts` from the Lark Dictionary.
- Diff old vs new: new ids, removed ids, changed type/category/parentId/flags.
- Migration `0011`: upsert/patch `catalog_item` rows; update the CHECK constraints in `0002` if the
  type/category/pricing_unit unions changed (additive migration, never edit `0002`).
- Verify: `pricing-resolver` + `quoteService` still resolve; recognition-catalog `aiDetectableCatalogItems`
  subset still valid; no UI references a removed id.
- Verify: catalog/dictionary tests green; add a regression test for any newly-required item.

### Phase 2 — Config pipeline + frozen predefined seed (A1)
- AI config step: extend the glossary breakdown (it already knows the dictionary) to emit
  `{ catalogItemIds[], name, description, facets }` for an image. Validate ids via the existing
  `bucketRecognition` guard; price/duration via `quoteService`.
- One-time generation script: 35 (+6) images → AI config → **human curation** → committed seed
  (`merchant_style` + `media_asset` rows, status `published`/`needs_review` as chosen).
- Migration `0012` part 1: `merchant_style.description`.
- Verify: seed loads; customer discovery/detail render name + description + derived price; a seeded
  style's `catalog_breakdown` round-trips through `quoteService` to its `preview_price`.

### Phase 3 — Manual upload pipeline + merchant edit (A2)
- On manual upload: run the config step → land `needs_review` with prefilled
  recognition/breakdown/name/description (instead of empty).
- Extend the merchant review UI + a `reviewMerchantStyleAction`: edit **title, description, and the
  catalog-item layers** (add/remove items + quantity). Price is shown derived, not editable. Publish
  recomputes `preview_price`/`duration` from the final layers.
- Predefined styles skip this (curated seed; no edit affordance).
- Verify: upload → edit layers → publish path tested; price recomputes from edited layers; predefined
  styles have no editable layers exposed.

### Phase 4 — DB favorites + trend signal (B)
- Migration `0012` part 2: `style_favorite` + popularity view.
- `style_favorite` repo (memory + supabase), `toggleFavoriteAction` / `listFavoritesAction` (demo
  customer scope, server-fixed identity — same no-auth model as bookings).
- Liked tab reads the DB; `StyleCard` toggle writes through the action. Migrate `SavedStylesContext`
  off `localStorage` (or back it with the action).
- Merchant popularity: `popularityScore` derived from favorite counts; surface on the trend/merchant view.
- Verify: like → liked tab (DB) → merchant popularity reflects it; toggle idempotent.

## Risks / watch-items

- **Dictionary migration is the dangerous one.** Changing `catalog_item` types/categories can break the
  `0002` CHECK constraints, seeded rows, `merchant_pricing` FKs, and any `merchant_style.catalog_breakdown`
  referencing a removed id. Phase 1 must diff first and migrate additively.
- **Derived price vs frozen snapshot.** Predefined `preview_price` is frozen at seed time; if the
  dictionary price changes later, frozen styles drift. Acceptable for the demo; note it.
- **No auth.** Favorites + merchant reads are demo-customer scoped; real per-user favorites need auth.
- **AI config curation.** The frozen seed is only as good as the one-time AI run + human pass; budget
  curation time for 35 images.

## Open inputs (need from user)
1. Location/form of the 35 images (live rows vs folder).
2. The Lark Dictionary changes (or confirm I should diff the sheet directly via Lark MCP).
