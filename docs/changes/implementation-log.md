# Implementation Log

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
