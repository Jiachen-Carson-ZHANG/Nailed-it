# Architecture: Current State

Last updated: 2026-06-08

## Stack

Next.js App Router, TypeScript, mobile-first shell (`MobileLayout` + `TopBar` + `BottomTabBar`). Operational booking, messaging, pricing, scheduling, and merchant-style data use Supabase behind a repository seam. The booking draft remains in per-tab `sessionStorage`. AI calls run server-side through API routes or server actions.

## Entry points

| Route | Purpose |
|---|---|
| `/` | Landing page (`src/components/landing/`) or role dispatch via `src/domain/session.ts` |
| `/customer/*` | Customer flows: discovery, style detail, booking, try-on, messages, profile |
| `/merchant/*` | Merchant flows: calendar, booking detail, roster/manage, insights, messages, profile |
| `/merchant/insights` | Merchant demand-intelligence dashboard: snapshot, demand trends, design performance, catalog gap, grounded AI summary |
| `/merchant/styles` | Merchant-owned style collection: one-image upload, preview, archive |
| `/merchant/styles/[id]/review` | Dedicated AI suggestion, catalog configuration, quote preview, save, publish, and archived republish workspace |
| `/privacy` | Public privacy disclosure (no auth required) |
| `/api/integrations/pinterest/callback` | Placeholder Pinterest OAuth redirect URI |
| `/dev` | Internal dev/debug page |

## AI API routes

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/recognize-nail-style` | `google/gemini-3.1-flash-image-preview` with 2.5 being the fallback | Image → nail attributes + confidence for booking |
| `/api/ai/try-on` | `google/gemini-3.1-flash-image-preview` (OpenRouter) | Hand + style images → try-on composite |
| `/api/ai/breakdown` | Uses OpenRouter | Image → strict-schema catalog selections; effective merchant pricing is loaded server-side before returning the quote |
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
- **Intelligence layer** (`customers`, `analytics_events`) — ADR-0006 (migration `0017`). Two real tables; everything else — customer profiles, demand trends, catalog gaps, low-conversion flags, ranking — is **computed on read** from the event log through the catalog adapter (no materialized metric/profile tables). `customers` holds seeded personas (the live demo customer Melissa maps to `cust-melissa`); `analytics_events` is a real behavioural log written by `trackEvent`. See the Intelligence layer section below.
- **Merchant style library** (`media_asset`, `merchant_style`, `merchant_style_item`) — P6.5 + Phase 2. A media asset owns the private original and optional public published Storage object paths; a merchant style owns review/publication state, a `description`, JSONB `discovery_facets`/`recognition`, and a preview price/duration that is **derived, never typed**. The authoritative catalog breakdown is the relational `merchant_style_item` table (FK → `catalog_item`, quantity), not jsonb — so a removed catalog id can't silently rot a style. A single-image upload only stores the private original and creates a `processing` style, then immediately routes to the phone-sized `/merchant/styles/[id]/review` workspace. The merchant explicitly clicks **AI breakdown** there; that action atomically claims the analysis job, downloads the stored original server-side, runs the shared strict-schema AI catalog recognizer, and commits title/description/facets/normalized items/derived preview plus the `needs_review` transition through the atomic `complete_merchant_style_analysis` RPC; failure transitions to an editable manual-review draft. The claim has stale-job recovery and prevents duplicate model calls from concurrent page loads. Save, publish, and archived republish re-derive price/duration through `quoteService`; republish recreates the public Storage copy and clears `archived_at`. Publishing still requires explicit merchant approval. Customer discovery/detail return published records only, including their `catalogBreakdown` so the booking flow can re-quote it. Merchant Me shows a collection preview. The old `styles` table remains temporarily for migration compatibility.

DB access: `src/lib/db/client.ts` is the server-only Supabase client (secret key, bypasses RLS). All app reads go through it; nothing uses the anon key. Migrations: `0001_init.sql` (bookings/messages/etc.), `0002_catalog.sql` (catalog_item + CHECK constraints mirroring the TS unions), `0003_merchant_pricing.sql` (merchant + merchant_pricing, RLS with no anon policies), `0004_staff_availability.sql` (working_plan + blocked_time, FK technicians), `0005_hardening_tenant.sql` (drops anon SELECT from the operational tables — only `styles`/`catalog_item` stay publicly readable — and adds `technicians.merchant_id`), `0006_interval_booking.sql` (booking + booking_item, btree_gist exclusion constraint, `create_booking` RPC; server-only), `0007_staff_item_duration.sql` (per-staff duration overrides; server-only), `0008_booking_tenant_fk.sql` (booking tenant and RPC hardening), `0009_merchant_style_library.sql` (`media_asset` + `merchant_style`, private/public Storage buckets, transactional create/publish RPCs), `0010_booking_thread_rpc.sql` (`create_booking_with_thread` — booking + items + thread + messages in one transaction; server-only), `0011_catalog_default_price.sql` (adds `catalog_item.default_price_cents`; drops the 7 items removed from the dictionary — re-run the seed afterwards to upsert the refreshed rows + 4 new items), `0012_merchant_style_description.sql` (`merchant_style.description` + 9-param `publish_merchant_style`), `0013_merchant_style_item.sql` (relational `merchant_style_item`, drops `merchant_style.catalog_breakdown` jsonb, `set_merchant_style_config` RPC), `0014_merchant_style_integrity.sql` (quantity bounds and atomic config/publish hardening), `0015_per_set_quantity.sql` (rejects direct relational writes whose effective pricing unit is `per_set` but quantity is not one), `0016_merchant_style_analysis_workflow.sql` (stale-recoverable analysis claim plus atomic stored-image analysis completion/failure transitions; server-only), `0017_intelligence_layer.sql` (`customers` + `analytics_events`, text ids, server-only RLS with no anon policies; applied manually in the Supabase SQL editor), and `0018_republish_archived_merchant_styles.sql` (allows explicit archived-style republish through the same reviewed config/publish RPC path). `scripts/seed-supabase.ts` seeds the relational dependencies; `npm run configure:styles` backfills each live style's relational breakdown + derived price in place; `npm run seed:intelligence` writes the demo personas + ~2-week backdated event history (idempotent — replaces only `session_id like 'seed-%'`, preserving live capture).

Media Storage:
- `merchant-style-originals` is private and stores merchant uploads.
- `merchant-style-published` is public customer-showcase content.
- Postgres stores stable object paths; it does not store base64 images or signed URLs.
- Server actions validate image MIME type/size and generate object paths. Publish copies the reviewed original to the public bucket before atomically updating media/style records; failures compensate by removing orphaned Storage objects.
- Melissa's local showcase set is backfilled by `npm run backfill:melissa-assets`: files from `nail_assets/*.jpg` are uploaded to both buckets under `merchant-nailed-it/melissa/...` and inserted as published `media_asset` / `merchant_style` rows with deterministic ids. This is separate from `seed:supabase`, which still preserves the legacy external-image demo rows.

Service layer (`src/lib/services/`, orchestration over repositories):
- `quoteService` — catalog + merchant pricing (+ per-staff duration) → priced, duration-aware quote lines; fails closed on unresolved required pricing and malformed quantities, and normalizes `per_set` quantities to one before price/duration calculation.
- `merchantPricingService` — catalog + effective merchant pricing → merchant edit view; validates and persists overrides through the repository seam.
- `availabilityService` — resolves a merchant-local slot (timezone) and returns the merchant's available technicians via the scheduling kernel.
- `bookingService` — create (quote → resolve slot → transactional create, throws `booking_overlap`), cancel, status lifecycle; enforces the technician-belongs-to-merchant tenant guard. `createBookingWithThreadFromSelections` books validated selections into relational `booking_item` rows + the thread atomically. Published styles and configured custom-image breakdowns use this path; the legacy snapshot path remains only for old/unconfigured drafts.
- `timezone.ts` — merchant wall-clock → weekday + local-minute range + epoch-ms interval. The 5 P4b gates: 2/3/5 in `src/lib/services/*.test.ts`, DB-only 1/4 in `scripts/check-db-gates.ts` (`npx tsx`).

Known gaps:
- **No authentication:** merchant-style and other merchant actions are fixed to the single demo merchant server-side; true cross-merchant authorization needs an authenticated session.
- **Historical style reconciliation:** `0015` prevents new invalid `per_set` quantities after it is applied, and all app writes normalize before pricing/persistence. Existing live style rows created before this rule must be deterministically reconfigured so their relational quantities and preview snapshots are recalculated together.
- **Batch administration:** the existing `npm run configure:styles` script remains an admin workflow; there is intentionally no batch-upload/review UI. Single merchant uploads move `processing` → `needs_review` and remain private until manually published.
- **Deployment:** migrations `0016` and `0018` must be applied before the review route can complete/fail stored-image analysis and republish archived styles against the live Supabase project.
- **Legacy cleanup:** the old `styles` and flat booking/pricing tables remain pending P4e cleanup.

## LLM integration

Gemini calls use `GEMINI_API_KEY` directly. OpenRouter calls use `OPENROUTER_API_KEY` via `src/nail-ai/openrouter.ts`. Breakdown and style-name calls request strict JSON Schema output and validate the parsed result again at runtime; invalid output retries and then leaves the upload for manual review. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

**Recognition → catalog bridge (P6):** `src/domain/recognition-catalog.ts` is the pure layer that turns recognizer-emitted `catalog_item` ids + confidence into a `detected` set and an `uncertain` set the user confirms, then into `CatalogSelection[]` for `quoteService` (`bucketRecognition` / `toCatalogSelections`; the constrained subset is `aiDetectableCatalogItems`). It deliberately validates ids rather than mapping visual attributes. Merchant style uploads use the glossary-driven catalog-id recognizer; the separate customer nail-attribute recognizer still emits free-form attributes.

## Intelligence layer (ADR-0006)

Event-sourced, compute-on-read demand intelligence. Only two tables are stored (`customers`, `analytics_events`, migration `0017`); profiles, trends, gaps, low-conversion flags, and ranking are all derived on read so every number traces to an event.

- **Capture.** `trackEventAction` (`src/lib/actions/analytics-actions.ts`) writes one `analytics_events` row; the fire-and-forget client helper `track()` (`src/features/analytics/track.ts`, per-tab session id) and `TrackOnMount` never break a user flow. Wired surfaces: feed click/save (`StyleCard`), filter search submit/no-result (`StyleWaterfallGridClient` — tag filters are catalog-label intents), style detail view, try-on completion, and `booking_confirmed` server-side in the booking action (carries `style_id` for per-style conversion). `style_impression` (IntersectionObserver) is deferred — the seed supplies impression history.
- **Taxonomy = the catalog.** `src/domain/catalog-tags.ts` (`categoryOf` / `tagsByCategory` / `isServiceModule`) is the single tag→category adapter; the feed filter (`style-facets.ts`) consumes it. No parallel tag tables.
- **Read model.** `src/domain/intelligence/` — pure, `now`-injectable functions: `getCustomerProfile` (weighted, time-decayed tag affinity + budget), `getMerchantInsights` (snapshot, demand trends this-vs-previous period, design performance incl. high-interest/low-conversion, catalog gaps with the ADR ≤1 rule), `rankStyles` (affinity + popularity + freshness, reason-coded — one function, two call sites), `getCustomerIntelligence` (profile + recommendations + appointment context).
- **Surfaces.** `/merchant/insights` (`getMerchantInsightsAction` + grounded `summarizeInsights`, which narrates only pre-computed numbers and falls back to a deterministic summary when the model is unavailable); the customer-intelligence panel in the merchant conversation view (`CustomerIntelPanel` + `getCustomerIntelligenceAction`; "发送" logs `recommended_style_sent`); and the customer feed re-ordered for the demo customer without showing the internal ranking reason chip (`getRankedFeedAction` → `PublishedStyleFeed`).
- **Demo dataset.** `npm run seed:intelligence` writes 6 personas + ~2 weeks of backdated events bound to the real published style ids (gap tag 暗黑 / low-conversion 8284 / top converter 8265). The regression `src/mock/intelligence-seed.test.ts` runs the read model over the generated seed and asserts the demo narrative. Re-seed shortly before a demo to keep the this-week/last-week windows fresh.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — legacy rule-based quote calculator retained for old flat snapshot drafts
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — sessionStorage draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `merchant-style.ts` — merchant media/style lifecycle and customer-safe published-style mapping
- `messaging.ts` — role-aware mapping from repository-backed booking threads to the shared `Conversation` UI contract

## Glossary (`src/data/`)

- `glossary.ts` — prompt-facing glossary views derived from canonical `src/mock/catalog.ts`, including `type_zh` translations. Provides `billableComponents`, `aiDetectableComponents`, `serviceModules`, and `glossaryById` lookup without maintaining a second catalog-id list.

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
