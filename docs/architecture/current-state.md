# Architecture: Current State

Last updated: 2026-06-06

## Stack

Next.js App Router, TypeScript, mobile-first shell (`MobileLayout` + `TopBar` + `BottomTabBar`). Operational booking, messaging, pricing, scheduling, and merchant-style data use Supabase behind a repository seam. The booking draft remains in per-tab `sessionStorage`. AI calls are server-side API routes.

## Entry points

| Route | Purpose |
|---|---|
| `/` | Landing page (`src/components/landing/`) or role dispatch via `src/domain/session.ts` |
| `/customer/*` | Customer flows: discovery, style detail, booking, try-on, messages, profile |
| `/merchant/*` | Merchant flows: calendar, booking detail, roster/manage, messages, profile |
| `/merchant/styles` | Merchant-owned style library: upload, review metadata, publish, archive |
| `/privacy` | Public privacy disclosure (no auth required) |
| `/api/integrations/pinterest/callback` | Placeholder Pinterest OAuth redirect URI |
| `/dev` | Internal dev/debug page |

## AI API routes

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/recognize-nail-style` | `google/gemini-3.1-flash-image-preview` with 2.5 being the fallback | Image → nail attributes + confidence for booking |
| `/api/ai/try-on` | `google/gemini-3.1-flash-image-preview` (OpenRouter) | Hand + style images → try-on composite |
| `/api/ai/breakdown` | Uses OpenRouter | Image → catalog selections; effective merchant pricing is loaded server-side before returning the quote |
| `/api/ai/trending-styles` | `qwen/qwen3-235b-a22b` (OpenRouter) | Text → ranked trending style suggestions |

## Persistence layer

A repository seam and a Supabase (Postgres) implementation exist, and the customer + merchant surfaces are **cut over to the DB** (P4c/P4d) through server actions in `src/lib/actions/`:
- **Writes**: catalog-backed custom images and published styles create an interval booking + relational items + linked conversation thread + greeting in **one transaction** (the `create_booking_with_thread` RPC, migration `0010`). The server reloads/validates catalog selections and recomputes price/duration for the selected technician; browser totals are ignored. The legacy flat snapshot action remains only as an explicit compatibility fallback and always enters `pending_review`.
- **Reads**: calendar / merchant profile / booking detail use `listMerchantBookingViewsAction`; customer profile uses `listCustomerBookingViewsAction` (server-filtered to the demo customer — private bookings never reach the browser). Messages use customer/merchant-scoped conversation actions that fix the actor server-side. Catalog-backed confirm availability quotes each technician separately, attaches that exact quote to the offered slot, and uses the same selections + technician at create time.

The only browser-local booking state left is the booking **draft** (`sessionStorage`). **Known gap — no auth:** without a session there is no real server-derived actor, so a direct caller could still invoke the merchant-scoped reads. True cross-account authorization needs the auth system (a future ADR). **ADR-0005's phase table is authoritative for phase numbers and status.**

Repositories live in `src/lib/repositories/` (async interfaces in `types.ts`; in-memory + Supabase impls; `getRepositories()` selects Supabase when env is present and not under test, in-memory otherwise so tests never hit the network):
- **Bookings, conversations/messages, technicians, styles, pricing rules** — P0/P1, the interim flat model.
- **Catalog** (`catalog_item`) — P1.5. Generated from the Lark "Dictionary" sheet into `src/mock/catalog.ts` (109 items) by `scripts/generate-catalog.mjs` (validates enums / parent refs / `affects=yes`→duration and refuses to emit inconsistent data). Platform source of truth for what can be priced + default durations. Each item now carries a platform `defaultPriceCents` (null = merchant must price it); the sheet's allowed-units list was retired, so `allowedPricingUnits` is the single default unit.
- **Merchant pricing** (`merchant`, `merchant_pricing`) — P2 + Phase 2.5. Sparse per-merchant overrides; `src/domain/pricing-resolver.ts` resolves effective pricing in precedence order: merchant override → `merchant`; else the catalog `defaultPriceCents` → `catalog_default`; else a required-price item with no default fails closed (`unresolved`, disabled). Merchant Manage reads/writes this table through server actions, and the breakdown API loads it server-side.
- **Staff availability** (`working_plan`, `blocked_time`) — P3. Reuses `technicians` as the staff/provider entity (no parallel `staff` table); `technicians` carries a `merchant_id` tenant owner (migration `0005`) so availability is scoped per salon. `working_plan` is recurring weekly hours per technician per weekday (0=Sun…6=Sat) with mid-day breaks as a JSONB `{startMin,endMin}` array; `blocked_time` is one-off calendar blocks as absolute instants. The live confirm grid calls the DB-backed availability action, which combines these records with interval-booking occupancy through the pure overlap kernel in `src/domain/scheduling.ts`.
- **Interval bookings** (`booking`, `booking_item`) — P4a/P4c/P4d. `booking` locks a technician over `start_at…end_at` and carries `merchant_id`; `booking_item` is the persisted 积木 quote snapshot. No-double-book is enforced in Postgres by a partial GiST exclusion constraint (`technician_id` + `tstzrange`, excluding cancelled), and creates run through the `create_booking` RPC (booking + items in one transaction). The confirm flow writes here, and calendar/profile/detail surfaces read these rows through scoped server actions.
- **Per-staff durations** (`staff_item_duration`) — P4a. Override table for items whose `duration_config_level='staff_level'`; P4b's quoteService prefers a staff override over the catalog default.
- **Merchant style library** (`media_asset`, `merchant_style`, `merchant_style_item`) — P6.5 + Phase 2. A media asset owns the private original and optional public published Storage object paths; a merchant style owns review/publication state, a `description`, JSONB `discovery_facets`/`recognition`, and a preview price/duration that is **derived, never typed**. The authoritative catalog breakdown is the relational `merchant_style_item` table (FK → `catalog_item`, quantity), not jsonb — so a removed catalog id can't silently rot a style. Publishing takes catalog selections, prices them through `quoteService`, and writes the items + derived snapshots via `set_merchant_style_config`, then flips state via `publish_merchant_style`. Uploads enter `needs_review`; the merchant review form is a catalog-item selection editor (price/time shown auto-calculated). Customer discovery/detail return published records only, including their `catalogBreakdown` so the booking flow can re-quote it. Merchant Me shows a collection preview and `/merchant/styles` provides upload/review/publish/archive controls. The old `styles` table remains temporarily for migration compatibility.

DB access: `src/lib/db/client.ts` is the server-only Supabase client (secret key, bypasses RLS). All app reads go through it; nothing uses the anon key. Migrations: `0001_init.sql` (bookings/messages/etc.), `0002_catalog.sql` (catalog_item + CHECK constraints mirroring the TS unions), `0003_merchant_pricing.sql` (merchant + merchant_pricing, RLS with no anon policies), `0004_staff_availability.sql` (working_plan + blocked_time, FK technicians), `0005_hardening_tenant.sql` (drops anon SELECT from the operational tables — only `styles`/`catalog_item` stay publicly readable — and adds `technicians.merchant_id`), `0006_interval_booking.sql` (booking + booking_item, btree_gist exclusion constraint, `create_booking` RPC; server-only), `0007_staff_item_duration.sql` (per-staff duration overrides; server-only), `0008_booking_tenant_fk.sql` (booking tenant and RPC hardening), `0009_merchant_style_library.sql` (`media_asset` + `merchant_style`, private/public Storage buckets, transactional create/publish RPCs), `0010_booking_thread_rpc.sql` (`create_booking_with_thread` — booking + items + thread + messages in one transaction; server-only), `0011_catalog_default_price.sql` (adds `catalog_item.default_price_cents`; drops the 7 items removed from the dictionary — re-run the seed afterwards to upsert the refreshed rows + 4 new items), `0012_merchant_style_description.sql` (`merchant_style.description` + 9-param `publish_merchant_style`), `0013_merchant_style_item.sql` (relational `merchant_style_item`, drops `merchant_style.catalog_breakdown` jsonb, `set_merchant_style_config` RPC). `scripts/seed-supabase.ts` seeds the relational dependencies; `npm run configure:styles` backfills each live style's relational breakdown + derived price in place.

Media Storage:
- `merchant-style-originals` is private and stores merchant uploads.
- `merchant-style-published` is public customer-showcase content.
- Postgres stores stable object paths; it does not store base64 images or signed URLs.
- Server actions validate image MIME type/size and generate object paths. Publish copies the reviewed original to the public bucket before atomically updating media/style records; failures compensate by removing orphaned Storage objects.
- Melissa's local showcase set is backfilled by `npm run backfill:melissa-assets`: files from `nail_assets/*.jpg` are uploaded to both buckets under `merchant-nailed-it/melissa/...` and inserted as published `media_asset` / `merchant_style` rows with deterministic ids. This is separate from `seed:supabase`, which still preserves the legacy external-image demo rows.

Service layer (`src/lib/services/`, orchestration over repositories):
- `quoteService` — catalog + merchant pricing (+ per-staff duration) → priced, duration-aware quote lines; fails closed on unresolved required pricing and malformed quantities.
- `merchantPricingService` — catalog + effective merchant pricing → merchant edit view; validates and persists overrides through the repository seam.
- `availabilityService` — resolves a merchant-local slot (timezone) and returns the merchant's available technicians via the scheduling kernel.
- `bookingService` — create (quote → resolve slot → transactional create, throws `booking_overlap`), cancel, status lifecycle; enforces the technician-belongs-to-merchant tenant guard. `createBookingWithThreadFromSelections` books validated selections into relational `booking_item` rows + the thread atomically. Published styles and configured custom-image breakdowns use this path; the legacy snapshot path remains only for old/unconfigured drafts.
- `timezone.ts` — merchant wall-clock → weekday + local-minute range + epoch-ms interval. The 5 P4b gates: 2/3/5 in `src/lib/services/*.test.ts`, DB-only 1/4 in `scripts/check-db-gates.ts` (`npx tsx`).

Known gaps:
- **No authentication:** merchant-style and other merchant actions are fixed to the single demo merchant server-side; true cross-merchant authorization needs an authenticated session.
- **Glossary prompt duplication:** `src/data/glossary.ts` still duplicates catalog metadata for the OpenRouter prompt and can lag the generated Lark catalog. It no longer owns pricing: browser localStorage pricing was removed and all returned totals come from server-loaded `merchant_pricing` + `quoteService`.
- **Merchant style AI/catalog review:** publishing now derives price/duration from a relational catalog breakdown (merchants pick items, not prices). But live recognition still does not emit catalog ids, so the 35 seeded styles get a default breakdown (`basic_manicure_service`) pending per-image curation via the `OVERRIDES` map in `scripts/configure-merchant-styles.ts`, and auto-config on manual upload (recognizer → `buildStyleConfig`) is still deferred.
- **Legacy cleanup:** the old `styles` and flat booking/pricing tables remain pending P4e cleanup.

## LLM integration

Gemini calls use `GEMINI_API_KEY` directly. OpenRouter calls use `OPENROUTER_API_KEY` via `src/nail-ai/openrouter.ts`. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

**Recognition → catalog bridge (P6):** `src/domain/recognition-catalog.ts` is the pure layer that turns recognizer-emitted `catalog_item` ids + confidence into a `detected` set and an `uncertain` set the user confirms, then into `CatalogSelection[]` for `quoteService` (`bucketRecognition` / `toCatalogSelections`; the constrained subset is `aiDetectableCatalogItems`). It deliberately validates ids rather than mapping visual attributes. The live recognizer in `src/nail-ai` still emits free-form attributes; wiring it to emit catalog ids is the remaining P6 edge.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — legacy rule-based quote calculator retained for old flat snapshot drafts
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — sessionStorage draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `merchant-style.ts` — merchant media/style lifecycle and customer-safe published-style mapping
- `messaging.ts` — role-aware mapping from repository-backed booking threads to the shared `Conversation` UI contract

## Glossary (`src/data/`)

- `glossary.ts` — static TypeScript embedding of all 100+ entries from `docs/glossary.xlsx`, including `type_zh` translations. Provides `billableComponents`, `aiDetectableComponents`, `serviceModules`, and `glossaryById` lookup.

## Mock data (`src/mock/`)

`styles.ts`, `merchant-styles.ts`, `bookings.ts`, `conversations.ts`, `technicians.ts`, `pricing.ts`, `customers.ts` — seed/demo data.
`ai.ts` — sample image path so booking flow works without a provider key.

## LLM adapters (`src/lib/ai/`)

- `nail-recognition.ts` — Gemini adapter; structured JSON output; normalises to supported nail attributes; logs `[nailed-it:vision-cost]` telemetry when `VISION_COST_LOGGING_ENABLED` is not `false`
- `usage-cost.ts` — Gemini usage metadata parser and USD cost estimator
- `openrouter.ts` — shared fetch wrapper for OpenRouter chat completions (text and image modalities)
- `try-on.ts` — two-image try-on via OpenRouter
- `breakdown.ts` — glossary-driven catalog-id extraction via OpenRouter; the API validates against server-loaded effective merchant pricing and requotes selections through `quoteService`
- `trending-styles.ts` — AI trending style feed via OpenRouter

## Testing

Vitest for unit/integration tests (`.test.ts` / `.test.tsx` colocated with source). Playwright for e2e (`e2e/`). Run with `npm test`.
