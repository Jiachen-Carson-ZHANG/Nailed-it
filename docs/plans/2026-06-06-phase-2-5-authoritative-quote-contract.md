# Phase 2.5: Authoritative quote contract

Date: 2026-06-06
Status: Implemented and verified (`242` tests, `tsc`, production build)

## Why this bridge phase exists

Phase 2 established the catalog, merchant pricing, quote service, interval availability, and
relational booking items. The latest Phase 3-facing UI work connected published styles to those
services, but three different quote contracts still reached the customer flow:

- published-style preview snapshots;
- browser-priced glossary breakdowns backed by `localStorage`;
- the legacy flat recognition estimate used by booking creation.

Continuing Phase 3 on top of those paths would make the UI look complete while display,
availability, and persisted booking duration could disagree.

## Invariant

For every catalog-backed booking:

> The displayed quote, offered technician slot, and persisted booking are derived server-side from
> the same validated catalog selections.

The browser may choose catalog ids and quantities, but it cannot supply authoritative price,
duration, status, merchant identity, or customer identity.

## Contract

### Published style

1. The draft carries the published `styleId`.
2. The server reloads the published style and its curated `CatalogSelection[]`.
3. Availability quotes those selections for each technician, including staff duration overrides.
4. Each offered slot carries its exact server-derived quote.
5. Creation reloads and requotes the same style selections for the selected technician.

Published styles do not rerun image recognition during booking.

### Custom image

1. AI breakdown emits catalog ids and quantities only.
2. The breakdown API loads effective merchant pricing server-side.
3. The draft carries validated `CatalogSelection[]` plus a non-authoritative display snapshot.
4. Availability and creation requote those selections server-side.

The legacy flat snapshot path remains only as an explicit compatibility fallback for drafts that
predate catalog selections. It always enters `pending_review`.

### Merchant pricing

The merchant manage page reads and writes `merchant_pricing` through server actions. Browser
`localStorage` pricing is removed from the authoritative path. The breakdown API never accepts
browser-supplied prices or durations.

## Implementation slices

1. Add quantity validation to `quoteService`.
2. Add selection-aware quote, availability, and custom create actions.
3. Attach the technician-specific quote to offered slots and display it after selection.
4. Carry custom catalog selections in the booking draft.
5. Load/save merchant pricing through the repository seam and remove client pricing from the AI
   breakdown request.
6. Update tests and persistent architecture documentation.

## Verification gates

- A staff duration override changes both the offered slot quote and the persisted booking duration.
- Tampered browser totals do not affect the created booking.
- Invalid/negative/non-finite quantities fail closed.
- Published-style booking creates relational catalog booking items.
- Merchant pricing survives repository reload and is used by the breakdown API.
- `tsc`, targeted tests, full tests, and production build are clean.

## Deferred

- True customer/merchant authorization remains blocked on authentication.
- AI recognition quality and human curation of the predefined style set remain Phase 3 work.
- Retiring the legacy flat tables and snapshot create action remains P4e cleanup after all callers
  are catalog-backed.
