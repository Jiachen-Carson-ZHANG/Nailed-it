# Implementation Log

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
