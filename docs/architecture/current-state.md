# Architecture: Current State

Last updated: 2026-06-05

## Stack

Next.js App Router, TypeScript, mobile-first shell (`MobileLayout` + `TopBar` + `BottomTabBar`). Currently there is no backend database, and state lives in mock modules and a versioned `localStorage` operations store. Supabase integration is in progress to replace the mock modules. AI calls are server-side API routes.

## Entry points

| Route | Purpose |
|---|---|
| `/` | Landing page (`src/components/landing/`) or role dispatch via `src/domain/session.ts` |
| `/customer/*` | Customer flows: discovery, style detail, booking, try-on, messages, profile |
| `/merchant/*` | Merchant flows: calendar, booking detail, roster/manage, messages, profile |
| `/privacy` | Public privacy disclosure (no auth required) |
| `/api/integrations/pinterest/callback` | Placeholder Pinterest OAuth redirect URI |
| `/dev` | Internal dev/debug page |

## AI API routes

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/recognize-nail-style` | `google/gemini-3.1-flash-image-preview` with 2.5 being the fallback | Image → nail attributes + confidence for booking |
| `/api/ai/try-on` | `google/gemini-3.1-flash-image-preview` (OpenRouter) | Hand + style images → try-on composite |
| `/api/ai/breakdown` | Uses OpenRouter | Image → structured nail component breakdown with pricing |
| `/api/ai/trending-styles` | `qwen/qwen3-235b-a22b` (OpenRouter) | Text → ranked trending style suggestions |

## Persistence layer (built behind a repository seam — data layer only, not yet wired)

A repository seam and a Supabase (Postgres) implementation exist, and the customer + merchant surfaces are **cut over to the DB** (P4c/P4d) through server actions in `src/lib/actions/`:
- **Writes**: `createBookingAction` creates an interval booking + linked conversation thread. Identity (customer), money (price/duration), and review status are **derived server-side** — recomputed from the recognition via the DB pricing rules + the confidence policy — so the browser cannot book a $0/auto-confirmed appointment. Status changes persist via `setBookingStatusAction`.
- **Reads**: calendar / merchant profile / booking detail use `listMerchantBookingViewsAction`; customer profile uses `listCustomerBookingViewsAction` (server-filtered to the demo customer — private bookings never reach the browser). Messages use customer/merchant-scoped conversation actions that fix the actor server-side. Confirm-page availability uses `listAvailableSlotsAction` (DB occupancy).

The only browser-local state left is the booking **draft** (`sessionStorage`) and the legacy `operations-store` (now dead app-side, pending removal). **Known gap — no auth:** without a session there is no real server-derived actor, so a direct caller could still invoke the merchant-scoped reads. True cross-account authorization needs the auth system (a future ADR). **ADR-0005's phase table is authoritative for phase numbers and status.**

Repositories live in `src/lib/repositories/` (async interfaces in `types.ts`; in-memory + Supabase impls; `getRepositories()` selects Supabase when env is present and not under test, in-memory otherwise so tests never hit the network):
- **Bookings, conversations/messages, technicians, styles, pricing rules** — P0/P1, the interim flat model.
- **Catalog** (`catalog_item`) — P1.5. Generated from the Dictionary sheet into `src/mock/catalog.ts` (112 items). Platform source of truth for what can be priced + default durations.
- **Merchant pricing** (`merchant`, `merchant_pricing`) — P2. Sparse per-merchant overrides; `src/domain/pricing-resolver.ts` merges overrides over catalog defaults into effective pricing (override → `merchant`, else → `catalog_default`).
- **Staff availability** (`working_plan`, `blocked_time`) — P3. Reuses `technicians` as the staff/provider entity (no parallel `staff` table); `technicians` carries a `merchant_id` tenant owner (migration `0005`) so P4 can scope availability per salon. `working_plan` is recurring weekly hours per technician per weekday (0=Sun…6=Sat) with mid-day breaks as a JSONB `{startMin,endMin}` array; `blocked_time` is one-off calendar blocks as absolute instants. The duration-aware overlap kernel lives in `src/domain/scheduling.ts` (`intervalsOverlap` / `isWithinWorkingPlan` / `findAvailableTechnicians`) — pure and timezone-agnostic (the caller resolves a datetime into weekday + local-minute range + epoch-ms interval). As of P4c the live `findTechnicianSlots` is itself duration-aware (interval overlap via `intervalsOverlap`), so the confirm page locks the technician for the booking's full length — but it reads bookings from localStorage, not the DB. The DB-backed `availabilityService` + `findAvailableTechnicians` (with working plans) wire in the DB cutover.
- **Interval bookings** (`booking`, `booking_item`) — P4a. The target booking model: `booking` locks a technician over `start_at…end_at` and carries `merchant_id`; `booking_item` is the persisted 积木 quote snapshot. No-double-book is enforced in Postgres by a partial GiST exclusion constraint (`technician_id` + `tstzrange`, excluding cancelled), and creates run through the `create_booking` RPC (booking + items in one transaction). Repos expose range-scoped reads (`listByTechnicianInRange`) + `listByMerchant`; the in-memory impl mirrors the overlap rejection so both sides honour the same contract. **Write wired** (P4c/P4d): the confirm flow writes interval bookings here via `createBookingAction` (snapshot bridge → one `booking_item`). Reads of these rows by the calendar/profile/detail surfaces are still pending.
- **Per-staff durations** (`staff_item_duration`) — P4a. Override table for items whose `duration_config_level='staff_level'`; P4b's quoteService prefers a staff override over the catalog default.

DB access: `src/lib/db/client.ts` is the server-only Supabase client (secret key, bypasses RLS). All app reads go through it; nothing uses the anon key. Migrations: `0001_init.sql` (bookings/messages/etc.), `0002_catalog.sql` (catalog_item + CHECK constraints mirroring the TS unions), `0003_merchant_pricing.sql` (merchant + merchant_pricing, RLS with no anon policies), `0004_staff_availability.sql` (working_plan + blocked_time, FK technicians), `0005_hardening_tenant.sql` (drops anon SELECT from the operational tables — only `styles`/`catalog_item` stay publicly readable — and adds `technicians.merchant_id`), `0006_interval_booking.sql` (booking + booking_item, btree_gist exclusion constraint, `create_booking` RPC; server-only), `0007_staff_item_duration.sql` (per-staff duration overrides; server-only), `0008_booking_tenant_fk.sql` (composite `(technician_id, merchant_id)` FK so a booking's technician must belong to its merchant; `create_booking` execute revoked from public/anon/authenticated, granted to service_role; positive-duration CHECK). `scripts/seed-supabase.ts` seeds in FK order: merchant → technicians → dependents → booking/booking_item + staff_item_duration.

Service layer (`src/lib/services/`, P4b — orchestration over the repos, not wired to UI):
- `quoteService` — catalog + merchant pricing (+ per-staff duration) → priced, duration-aware quote lines; fails closed on unresolved required pricing.
- `availabilityService` — resolves a merchant-local slot (timezone) and returns the merchant's available technicians via the scheduling kernel.
- `bookingService` — create (quote → resolve slot → transactional create, throws `booking_overlap`), cancel, status lifecycle; enforces the technician-belongs-to-merchant tenant guard.
- `timezone.ts` — merchant wall-clock → weekday + local-minute range + epoch-ms interval. The 5 P4b gates: 2/3/5 in `src/lib/services/*.test.ts`, DB-only 1/4 in `scripts/check-db-gates.ts` (`npx tsx`).

Known gaps still open (each addressed by a later ADR-0005 phase):
- **Availability is duration-aware but localStorage-backed** — the confirm path now blocks a technician for the booking's whole duration (`findTechnicianSlots` uses `intervalsOverlap`, P4c), but reads bookings from the localStorage operations-store, not the DB. The DB-backed `availabilityService` + working-plan filtering wire in the DB cutover (must land with the P4d reads to avoid split-brain).
- **Booking draft is sessionStorage** (`src/domain/booking-draft.ts`, P4c) — per-tab, survives reload, never read on the server. No longer a module-level `let`.
- **The transactional create path is not wired** — the `create_booking` RPC + GiST exclusion constraint exist (P4a) and guarantee no double-book at the DB, but the live write path is still browser `localStorage`; the booking/confirm flow moves onto the RPC + services in P4b/P4c.
- The interim flat `pricing_rules` + date/time-string bookings are superseded by the catalog / interval-booking model as phases land.

## LLM integration

Gemini calls use `GEMINI_API_KEY` directly. OpenRouter calls use `OPENROUTER_API_KEY` via `src/nail-ai/openrouter.ts`. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

**Recognition → catalog bridge (P6):** `src/domain/recognition-catalog.ts` is the pure layer that turns recognizer-emitted `catalog_item` ids + confidence into a `detected` set and an `uncertain` set the user confirms, then into `CatalogSelection[]` for `quoteService` (`bucketRecognition` / `toCatalogSelections`; the constrained subset is `aiDetectableCatalogItems`). It deliberately validates ids rather than mapping visual attributes. The live recognizer in `src/nail-ai` still emits free-form attributes; wiring it to emit catalog ids is the remaining P6 edge.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — rule-based quote calculator used by style previews, booking drafts, and merchant snapshots
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — sessionStorage draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `messaging.ts` — role-aware mapping from operations-store threads to the shared `Conversation` UI contract

## Mock data (`src/mock/`)

`styles.ts`, `bookings.ts`, `conversations.ts`, `technicians.ts`, `pricing.ts` — seed data.
`operations-store.ts` — versioned `localStorage` store for bookings and threads; survives page reloads within a browser session.
`ai.ts` — sample image path so booking flow works without a provider key.

## LLM adapters (`src/lib/ai/`)

- `nail-recognition.ts` — Gemini adapter; structured JSON output; normalises to supported nail attributes; logs `[nailed-it:vision-cost]` telemetry when `VISION_COST_LOGGING_ENABLED` is not `false`
- `usage-cost.ts` — Gemini usage metadata parser and USD cost estimator
- `openrouter.ts` — shared fetch wrapper for OpenRouter chat completions (text and image modalities)
- `try-on.ts` — two-image try-on via OpenRouter
- `breakdown.ts` — component breakdown via OpenRouter; re-uses recognised attribute helpers from `nail-recognition.ts`
- `trending-styles.ts` — AI trending style feed via OpenRouter

## Testing

Vitest for unit/integration tests (`.test.ts` / `.test.tsx` colocated with source). Playwright for e2e (`e2e/`). Run with `npm test`.
