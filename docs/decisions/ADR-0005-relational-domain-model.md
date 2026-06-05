# ADR-0005: Relational domain model (catalog · merchant pricing · interval bookings)

**Status:** Accepted (target architecture; rolled out in phases P1.5–P7)
**Date:** 2026-06-05
**Builds on:** ADR-0004 (Supabase persistence + repository seam)
**Supersedes:** the interim flat schema from P1 (`pricing_rules` + date/time-string bookings) — retired as phases land.

---

## Context

ADR-0004 introduced a repository seam and a first Supabase schema that mirrored the existing mock types (flat `pricing_rules`, bookings keyed on `date`+`time` strings). That was deliberate scaffolding to prove the Supabase path. Since then three inputs converged:

1. **Melissa's quote taxonomy** (the `config页面设计wip` doc + the "Disctionary" sheet): a 6-type catalog with block-composition pricing and explicit `affects_booking_duration` / `duration_config_level` fields.
2. **The PRD**: 智能预约 must "根据款式制作时长锁定对应美甲师的预约时间" (lock the technician's time by the style's duration). The current `findTechnicianSlots` keys occupancy on `date+time+technicianId` and ignores duration — a live bug (a 135-min booking does not block an overlapping later slot).
3. **Mature references** (Easy!Appointments, Cal.com): the domain spine and service boundaries a real appointment system needs.

The flat schema cannot express duration-based booking, per-merchant pricing, staff working hours, or the catalog. This ADR defines the target relational model and a phased path to it.

## Decision

Adopt one relational model on Supabase Postgres, behind the existing repository seam, with a Cal-style service layer over pure domain logic.

### Data model

- **Catalog (platform):** `catalog_item` (1:1 with the Dictionary sheet — `type`, `category`, `parent_id`, `affects_booking_duration`, `default_duration_min`, `duration_config_level`, `merchant_price_required`, `quantity_supported`, `ai_detectable`, …). Allowed pricing units are stored as a **JSONB array** on `catalog_item` for P1.5 (read-only catalog, tiny arrays, one table, with a `allowed_pricing_units ? default_pricing_unit` CHECK). Normalizing into a `catalog_item_allowed_unit` table is deferred to when units need to be independently queryable.
- **Merchant config:** `merchant` + `merchant_pricing` (merchant × catalog_item → price/duration/unit/enabled; falls back to catalog defaults). Replaces the merchant manage page's non-persisting "save".
- **Staff / availability:** `staff`, `working_plan` (weekday hours), `blocked_time`, `staff_item_duration` (per-staff overrides for `duration_config_level=staff_level`).
- **Booking (interval-based):** `booking` (`start_at`/`end_at`/`duration_min`, `status` incl. `in_progress`, `cancelled_at`/`rescheduled_at`, reserved nullable `payment_status`) + `booking_item` (the persisted 积木 decomposition = quote snapshot + duration source).
- **Keep:** `conversation_thread`/`message`, `style`. `customer` gains `preferred_slots`.

### Service layer (`src/lib/services/`)

- `quoteService` — catalog ids + quantities + merchant_pricing → price + duration (supersedes flat `calculateEstimate`).
- `availabilityService` — working_plan + blocked_time + bookings + requested duration → free intervals via overlap (`newStart < existingEnd && newEnd > existingStart`).
- `bookingService` — transactional create (re-check overlap inside the txn), status lifecycle, reschedule, cancel.

### AI integration

The recognizer returns a constrained JSON schema of **catalog_item ids** (only `ai_detectable` items) + per-item confidence; weak/low-confidence items route to an `uncertain_items` bucket the user confirms. No fuzzy visual-attribute→billable mapping table.

## Design principles

- Catalog (what *can* be priced) is separate from merchant pricing (the *values*).
- Bookings are time intervals, never slot strings; duration is the sum of `booking_item`s where `affects_booking_duration`.
- Pure `src/domain/*`; persistence in repositories; orchestration in services.
- Additive evolution behind the seam — new tables land before the flat schema is retired; tests stay green on the in-memory impl throughout.

## Alternatives considered

- **Prisma + Postgres (Cal.com style):** typed migrations, but a second client and the loss of supabase-js realtime; rejected — the seam already hides the ORM and realtime is a demo differentiator.
- **Copy Easy!Appointments schema verbatim:** rejected — adopt concepts (Working Plan, Blocked Time, Service/Provider, lifecycle), not its PHP-era tables, calendar-sync, or booking-rule engine.
- **Keep the flat schema:** rejected — cannot express duration locking, per-merchant pricing, or the catalog the PRD/Dictionary require.
- **Payment tables:** rejected for now — off-spec per PRD/competition; a nullable `payment_status` is reserved only.

## Consequences

**Positive:** quote + duration are accurate and merchant-configurable; bookings lock real technician time (satisfies the PRD); availability respects working hours + blocks; cross-actor demo becomes real once wired; clean architecture story for judges.

**Negative:** materially more tables than the flat model; the P4 client→server cutover touches ~9 consumers; staff working-plan/availability is new surface to seed and test.

## Phase reconciliation (supersedes ADR-0004's phase numbers)

ADR-0004 numbered phases for the flat schema. This ADR renumbers them. Follow this table, not ADR-0004's list:

| Original (ADR-0004) | Now (ADR-0005) | State |
|---|---|---|
| P0 repository seam | P0 | done |
| P1 Supabase flat schema + seed | P1 | done — interim, superseded by the catalog/relational model |
| — | **P1.5 catalog foundation** (`catalog_item` + invariants + seed + repo) | done (this work); not wired to runtime |
| P4 merchant-persisted pricing | **P2 merchant pricing** (`merchant` + `merchant_pricing` over `catalog_item`) | pending |
| — | **P3 interval availability** (`staff` + `working_plan` + `blocked_time` + interval booking checks) | pending |
| P2 wire consumers (localStorage→server) | **P4 consumer wiring** (Server Components / Actions) | pending |
| P3 realtime | **P5 realtime** | pending |
| — | **P6 AI catalog schema** (recognizer emits catalog ids + `uncertain_items`) | pending |
| — | **P7 款式跟踪** (completed-order photos → tagged catalog/style library) | pending |

Do not wire UI to the DB before P2/P3 land, or the flat tables get migrated twice.

## References

- `docs/decisions/ADR-0004-supabase-persistence-repository-seam.md`
- Dictionary sheet ("Disctionary") + `config页面设计wip` (Lark) — catalog source of truth.
- Easy!Appointments (domain spine), Cal.com (service separation, transactional booking) — concept references, not schema templates.
- Phases: P1.5 catalog · P2 merchant pricing · P3 interval bookings + availability · P4 wire consumers · P5 realtime · P6 recognition→catalog schema · P7 款式跟踪.
