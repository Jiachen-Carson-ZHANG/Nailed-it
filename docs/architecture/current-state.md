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
| `/api/ai/breakdown` | Uses OpenRouter | Image + merchant settings → glossary-driven component breakdown (replaces former standard/free modes) |
| `/api/ai/trending-styles` | `qwen/qwen3-235b-a22b` (OpenRouter) | Text → ranked trending style suggestions |

## Persistence layer

A repository seam and a Supabase (Postgres) implementation exist, and the customer + merchant surfaces are **cut over to the DB** (P4c/P4d) through server actions in `src/lib/actions/`:
- **Writes**: `createBookingAction` creates an interval booking + its linked conversation thread + greeting in **one transaction** (the `create_booking_with_thread` RPC, migration `0010`) — no compensating cancel, no orphan booking, no empty thread. Identity (customer) and money (price/duration) are **derived server-side** (price/duration recomputed from the recognition via the DB pricing rules). Because client recognition is itself untrusted, the snapshot bridge **never auto-confirms**: status is forced to `pending_review` until server-issued recognition/catalog selections exist (live P6). Availability is **enforced at write time** — the chosen technician is re-checked against the scheduling kernel for the exact slot + duration, so a tampered request cannot book during a break, blocked time, or outside working hours (the DB exclusion constraint only stops booking-vs-booking overlap). Status changes persist via `setBookingStatusAction`.
- **Reads**: calendar / merchant profile / booking detail use `listMerchantBookingViewsAction`; customer profile uses `listCustomerBookingViewsAction` (server-filtered to the demo customer — private bookings never reach the browser). Messages use customer/merchant-scoped conversation actions that fix the actor server-side. Confirm-page availability uses `listAvailableSlotsAction` (DB occupancy).

The only browser-local booking state left is the booking **draft** (`sessionStorage`). **Known gap — no auth:** without a session there is no real server-derived actor, so a direct caller could still invoke the merchant-scoped reads. True cross-account authorization needs the auth system (a future ADR). **ADR-0005's phase table is authoritative for phase numbers and status.**

Repositories live in `src/lib/repositories/` (async interfaces in `types.ts`; in-memory + Supabase impls; `getRepositories()` selects Supabase when env is present and not under test, in-memory otherwise so tests never hit the network):
- **Bookings, conversations/messages, technicians, styles, pricing rules** — P0/P1, the interim flat model.
- **Catalog** (`catalog_item`) — P1.5. Generated from the Dictionary sheet into `src/mock/catalog.ts` (112 items). Platform source of truth for what can be priced + default durations.
- **Merchant pricing** (`merchant`, `merchant_pricing`) — P2. Sparse per-merchant overrides; `src/domain/pricing-resolver.ts` merges overrides over catalog defaults into effective pricing (override → `merchant`, else → `catalog_default`).
- **Staff availability** (`working_plan`, `blocked_time`) — P3. Reuses `technicians` as the staff/provider entity (no parallel `staff` table); `technicians` carries a `merchant_id` tenant owner (migration `0005`) so availability is scoped per salon. `working_plan` is recurring weekly hours per technician per weekday (0=Sun…6=Sat) with mid-day breaks as a JSONB `{startMin,endMin}` array; `blocked_time` is one-off calendar blocks as absolute instants. The live confirm grid calls the DB-backed availability action, which combines these records with interval-booking occupancy through the pure overlap kernel in `src/domain/scheduling.ts`.
- **Interval bookings** (`booking`, `booking_item`) — P4a/P4c/P4d. `booking` locks a technician over `start_at…end_at` and carries `merchant_id`; `booking_item` is the persisted 积木 quote snapshot. No-double-book is enforced in Postgres by a partial GiST exclusion constraint (`technician_id` + `tstzrange`, excluding cancelled), and creates run through the `create_booking` RPC (booking + items in one transaction). The confirm flow writes here, and calendar/profile/detail surfaces read these rows through scoped server actions.
- **Per-staff durations** (`staff_item_duration`) — P4a. Override table for items whose `duration_config_level='staff_level'`; P4b's quoteService prefers a staff override over the catalog default.
- **Merchant style library** (`media_asset`, `merchant_style`) — P6.5. A media asset owns the private original and optional public published Storage object paths; a merchant style owns review/publication state plus JSONB discovery/recognition/catalog metadata and a reviewed preview price/duration. Uploads enter `needs_review`; publish copies the original into the public bucket and updates both rows through `publish_merchant_style`. Customer discovery/detail actions return published records only. Merchant Me shows a collection preview and `/merchant/styles` provides upload/review/publish/archive controls. The old `styles` table remains temporarily for migration compatibility.

DB access: `src/lib/db/client.ts` is the server-only Supabase client (secret key, bypasses RLS). All app reads go through it; nothing uses the anon key. Migrations: `0001_init.sql` (bookings/messages/etc.), `0002_catalog.sql` (catalog_item + CHECK constraints mirroring the TS unions), `0003_merchant_pricing.sql` (merchant + merchant_pricing, RLS with no anon policies), `0004_staff_availability.sql` (working_plan + blocked_time, FK technicians), `0005_hardening_tenant.sql` (drops anon SELECT from the operational tables — only `styles`/`catalog_item` stay publicly readable — and adds `technicians.merchant_id`), `0006_interval_booking.sql` (booking + booking_item, btree_gist exclusion constraint, `create_booking` RPC; server-only), `0007_staff_item_duration.sql` (per-staff duration overrides; server-only), `0008_booking_tenant_fk.sql` (booking tenant and RPC hardening), `0009_merchant_style_library.sql` (`media_asset` + `merchant_style`, private/public Storage buckets, transactional create/publish RPCs), `0010_booking_thread_rpc.sql` (`create_booking_with_thread` — booking + items + thread + messages in one transaction; server-only). `scripts/seed-supabase.ts` seeds the relational dependencies and legacy external-image merchant-style rows.

Media Storage:
- `merchant-style-originals` is private and stores merchant uploads.
- `merchant-style-published` is public customer-showcase content.
- Postgres stores stable object paths; it does not store base64 images or signed URLs.
- Server actions validate image MIME type/size and generate object paths. Publish copies the reviewed original to the public bucket before atomically updating media/style records; failures compensate by removing orphaned Storage objects.
- Melissa's local showcase set is backfilled by `npm run backfill:melissa-assets`: files from `nail_assets/*.jpg` are uploaded to both buckets under `merchant-nailed-it/melissa/...` and inserted as published `media_asset` / `merchant_style` rows with deterministic ids. This is separate from `seed:supabase`, which still preserves the legacy external-image demo rows.

Service layer (`src/lib/services/`, orchestration over repositories):
- `quoteService` — catalog + merchant pricing (+ per-staff duration) → priced, duration-aware quote lines; fails closed on unresolved required pricing.
- `availabilityService` — resolves a merchant-local slot (timezone) and returns the merchant's available technicians via the scheduling kernel.
- `bookingService` — create (quote → resolve slot → transactional create, throws `booking_overlap`), cancel, status lifecycle; enforces the technician-belongs-to-merchant tenant guard.
- `timezone.ts` — merchant wall-clock → weekday + local-minute range + epoch-ms interval. The 5 P4b gates: 2/3/5 in `src/lib/services/*.test.ts`, DB-only 1/4 in `scripts/check-db-gates.ts` (`npx tsx`).

Known gaps:
- **No authentication:** merchant-style and other merchant actions are fixed to the single demo merchant server-side; true cross-merchant authorization needs an authenticated session.
- **Glossary pricing fork:** the newly added merchant glossary settings UI persists prices/durations in browser `localStorage` and sends them to the breakdown API. This is not an authoritative pricing path and conflicts with ADR-0005's `catalog_item` + `merchant_pricing` model. The breakdown API must load effective merchant pricing server-side before this path can affect quotes/bookings.
- **Merchant style AI/catalog review:** P6.5 persists the reviewable JSONB contract and reviewed preview price/duration, but live recognition still does not emit catalog ids. Until P6 completes, merchants enter the reviewed preview values before publishing.
- **Legacy cleanup:** the old `styles` and flat booking/pricing tables remain pending P4e cleanup.

## LLM integration

Gemini calls use `GEMINI_API_KEY` directly. OpenRouter calls use `OPENROUTER_API_KEY` via `src/nail-ai/openrouter.ts`. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

**Recognition → catalog bridge (P6):** `src/domain/recognition-catalog.ts` is the pure layer that turns recognizer-emitted `catalog_item` ids + confidence into a `detected` set and an `uncertain` set the user confirms, then into `CatalogSelection[]` for `quoteService` (`bucketRecognition` / `toCatalogSelections`; the constrained subset is `aiDetectableCatalogItems`). It deliberately validates ids rather than mapping visual attributes. The live recognizer in `src/nail-ai` still emits free-form attributes; wiring it to emit catalog ids is the remaining P6 edge.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — rule-based quote calculator used by style previews, booking drafts, and merchant snapshots
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — sessionStorage draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `merchant-style.ts` — merchant media/style lifecycle and customer-safe published-style mapping
- `messaging.ts` — role-aware mapping from repository-backed booking threads to the shared `Conversation` UI contract

## Glossary (`src/data/`)

- `glossary.ts` — static TypeScript embedding of all 100+ entries from `docs/glossary.xlsx`, including `type_zh` translations. Provides `billableComponents`, `aiDetectableComponents`, `serviceModules`, and `glossaryById` lookup.
- `glossary-settings-store.ts` — localStorage CRUD (`nailed-it.glossary-settings.v1`) for merchant price/duration settings per `billable_component`. Defaults load from `default_duration_min`; prices default to 0.

## Mock data (`src/mock/`)

`styles.ts`, `merchant-styles.ts`, `bookings.ts`, `conversations.ts`, `technicians.ts`, `pricing.ts`, `customers.ts` — seed/demo data.
`ai.ts` — sample image path so booking flow works without a provider key.

## LLM adapters (`src/lib/ai/`)

- `nail-recognition.ts` — Gemini adapter; structured JSON output; normalises to supported nail attributes; logs `[nailed-it:vision-cost]` telemetry when `VISION_COST_LOGGING_ENABLED` is not `false`
- `usage-cost.ts` — Gemini usage metadata parser and USD cost estimator
- `openrouter.ts` — shared fetch wrapper for OpenRouter chat completions (text and image modalities)
- `try-on.ts` — two-image try-on via OpenRouter
- `breakdown.ts` — glossary-driven component breakdown via OpenRouter; AI detects glossary `billable_component` items and quantities; prices/durations from merchant's localStorage settings
- `trending-styles.ts` — AI trending style feed via OpenRouter

## Testing

Vitest for unit/integration tests (`.test.ts` / `.test.tsx` colocated with source). Playwright for e2e (`e2e/`). Run with `npm test`.
