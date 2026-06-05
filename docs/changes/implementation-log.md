# Implementation Log

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
