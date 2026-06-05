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
- **Staff / availability:** `working_plan` (weekday hours + breaks), `blocked_time` (one-off blocks). **P3 reuses the existing `technicians` table as the staff/provider entity** rather than adding a parallel `staff` table — we already have the entity, so a duplicate would only add a migration of the same data. `staff_item_duration` (per-staff overrides for `duration_config_level=staff_level`) is deferred to P4, where `quoteService` first needs it.
- **Booking (interval-based):** `booking` (`start_at`/`end_at`/`duration_min`, `status` incl. `in_progress`, `cancelled_at`/`rescheduled_at`, reserved nullable `payment_status`) + `booking_item` (the persisted 积木 decomposition = quote snapshot + duration source). These tables + the transactional `bookingService` land in **P4** (alongside consumer wiring), since they only earn their keep once booking writes actually go through the DB; P3 ships the pure overlap kernel that P4's create path will call.
- **Keep:** `conversation_thread`/`message`, `style`. `customer` gains `preferred_slots`.

### Service layer (`src/lib/services/`)

- `quoteService` — catalog ids + quantities + merchant_pricing → price + duration (supersedes flat `calculateEstimate`).
- `availabilityService` — working_plan + blocked_time + bookings + requested duration → free intervals via overlap (`newStart < existingEnd && newEnd > existingStart`).
- `bookingService` — transactional create, status lifecycle, reschedule, cancel. **The no-double-book guarantee is enforced in Postgres, not in app code:** a GiST exclusion constraint on `booking` — `EXCLUDE USING gist (technician_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status <> 'cancelled')` — makes two overlapping live bookings for one technician physically impossible. Creation is a single Postgres RPC (function) that inserts inside one transaction and lets the constraint reject conflicts, so separate supabase-js calls can never interleave past the availability check. Cancelling frees the interval (the `WHERE` clause excludes cancelled rows).

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
| — | **P1.5 catalog foundation** (`catalog_item` + invariants + seed + repo) | **done**; data layer only, not wired to runtime |
| P4 merchant-persisted pricing | **P2 merchant pricing** (`merchant` + `merchant_pricing` + effective-pricing resolver) | **done**; data layer only, not wired to runtime |
| — | **P3 interval availability** (`working_plan` + `blocked_time` on `technicians` + pure interval-overlap kernel `src/domain/scheduling.ts`) | **done**; data layer + kernel only, not wired |
| P2 wire consumers (localStorage→server) | **P4a backend contract** (interval `booking`/`booking_item` with `merchant_id` + GiST exclusion constraint; `create_booking` RPC; range-scoped scheduling/booking queries; `staff_item_duration`) | **done**; data layer + RPC only, not wired |
| — | **P4b services** (`quoteService` / `availabilityService` / `bookingService` over the repos; merchant-timezone resolution; Postgres integration tests for the gates below) | **next** |
| — | **P4c booking flow** (booking + confirm pages onto the services; swap `findTechnicianSlots`→`scheduling`; booking draft → DB/session) | pending |
| — | **P4d read/write surfaces** (calendar, profile, messages reads + writes) | pending |
| — | **P4e cleanup** (remove the localStorage path + retire the flat tables) | pending |
| P3 realtime | **P5 realtime** | pending |
| — | **P6 AI catalog schema** (recognizer emits catalog ids + `uncertain_items`) | pending |
| — | **P7 款式跟踪** (completed-order photos → tagged catalog/style library) | pending |

Do not wire UI to the DB before P2/P3 land, or the flat tables get migrated twice.

### P4 entry gates (from the pre-P4 audit)

P4a + P4b must land the transactional, tenant-scoped backend before any UI is switched. These integration tests (against a real Postgres) are the gate to start P4c:

1. Two concurrent create requests for the same technician/interval cannot both succeed (exclusion constraint holds).
2. Merchant A cannot read or book Merchant B's staff (tenant scoping).
3. A booking referencing a merchant-required item with no price fails closed (`source:'unresolved'` is not bookable).
4. Cancelling a booking releases its interval for rebooking.
5. Merchant-timezone conversion yields consistent local-minute and absolute-ms intervals for the same slot.

## References

- `docs/decisions/ADR-0004-supabase-persistence-repository-seam.md`
- Dictionary sheet ("Disctionary") + `config页面设计wip` (Lark) — catalog source of truth.
- Easy!Appointments (domain spine), Cal.com (service separation, transactional booking) — concept references, not schema templates.
- Phases: P1.5 catalog · P2 merchant pricing · P3 interval bookings + availability · P4 wire consumers · P5 realtime · P6 recognition→catalog schema · P7 款式跟踪.
