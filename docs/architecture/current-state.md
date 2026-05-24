# Architecture: Current State

Last updated: 2026-05-24

## Pipeline

The active frontend is a Next.js App Router application with a mobile-first shell:

1. `src/app/page.tsx` routes users into role-specific flows through `src/domain/session.ts`.
2. `src/components/layout/MobileLayout.tsx` composes the shared `TopBar` and role-aware `BottomTabBar`.
3. `src/domain/session.ts` is the shared route-intent surface for role home paths, available tabs, customer and merchant messages/profile routes, and detail-path helpers.
4. Customer discovery reads style cards from `src/mock/styles.ts`, where preview quotes are recomputed from `src/domain/pricing.ts` at read time and discovery facets are typed instead of carried as raw string tags.
5. Customer booking carries an in-memory draft across `/customer/booking` and `/customer/booking/confirm` through an explicit draft boundary in `src/domain/booking-draft.ts`.
6. Customer and merchant message list/detail pages read from `src/mock/conversations.ts` through focused shared message components instead of role-specific duplicated chat UIs.
7. Merchant calendar, booking detail, rule management, and profile analytics read from the shared booking and pricing mocks rather than maintaining a second merchant-only data model.

## Key modules

- `src/app/customer/home/page.tsx`: customer discovery entry using the shared mobile shell.
- `src/app/customer/style/[id]/page.tsx`: style detail route backed by shared mock style helpers.
- `src/app/customer/booking/page.tsx` and `src/app/customer/booking/confirm/page.tsx`: booking flow backed by an explicit in-memory draft contract.
- `src/app/customer/messages/page.tsx`, `src/app/customer/messages/[conversationId]/page.tsx`, `src/app/customer/profile/page.tsx`: customer inbox, thread detail, and profile surfaces backed by shared mock conversations and bookings.
- `src/app/merchant/calendar/page.tsx`, `src/app/merchant/booking/[id]/page.tsx`, `src/app/merchant/manage/page.tsx`, `src/app/merchant/messages/page.tsx`, `src/app/merchant/messages/[conversationId]/page.tsx`, `src/app/merchant/profile/page.tsx`: merchant scheduling, pricing, inbox, and operational profile surfaces on the shared shell.
- `src/features/customer/StyleCard.tsx`, `StyleWaterfallGrid.tsx`, `StyleDetailPanel.tsx`: focused customer presentation components.
- `src/features/customer/BookingHistoryCard.tsx`: customer booking-history summary card reused by the profile surface.
- `src/features/merchant/*`: merchant calendar, day sheet, booking card, and pricing rule components.
- `src/features/messages/*`: shared conversation list and chat-room components used by both roles.
- `src/mock/styles.ts`: canonical mock style dataset and read helpers for trending cards and style detail lookup, including typed discovery facets.
- `src/mock/bookings.ts`, `src/mock/conversations.ts`, and `src/mock/pricing.ts`: shared merchant/customer mock sources for booking snapshots, inbox threads, availability, and editable pricing rules.
- `src/domain/pricing.ts`: rule-based quote calculator used by mock style previews, booking drafts, and merchant booking snapshots.
- `src/domain/session.ts`: shared session/navigation contract for route intents, tab visibility, home paths, and customer/merchant detail links.
- `src/domain/booking-draft.ts`: lightweight in-memory draft boundary for the current no-backend customer booking flow.
- `src/components/layout/*`: shared shell primitives for both customer and merchant role surfaces.
- `docs/architecture/graphify-ingestion-policy.md` and `graphify-out/*`: Graphify collaboration policy and shared orientation artifacts.

## LLM integration

No live product LLM integration exists yet. The current product-facing AI surface is mocked through `src/mock/ai.ts`, which feeds recognition payloads into customer discovery/detail and booking flows. Customer and merchant messaging currently reuse static conversation snapshots from `src/mock/conversations.ts` rather than a live message service. Graphify semantic extraction remains an intentional maintenance tool rather than a runtime dependency.

