# Architecture: Current State

Last updated: 2026-05-24

## Pipeline

The active frontend is a Next.js App Router application with a mobile-first shell:

1. `src/app/page.tsx` routes users into role-specific flows through `src/domain/session.ts`.
2. `src/components/layout/MobileLayout.tsx` composes the shared `TopBar` and role-aware `BottomTabBar`.
3. Customer discovery reads style cards from `src/mock/styles.ts`, where preview quotes are recomputed from `src/domain/pricing.ts` at read time.
4. Customer style detail combines the card-level view (`findStyleById`) with the underlying mock recognition payload (`getStyleDefinitionById`) so detail UI and pricing stay tied to one shared mock source of truth.

## Key modules

- `src/app/customer/home/page.tsx`: customer discovery entry using the shared mobile shell.
- `src/app/customer/style/[id]/page.tsx`: style detail route backed by shared mock style helpers.
- `src/features/customer/StyleCard.tsx`, `StyleWaterfallGrid.tsx`, `StyleDetailPanel.tsx`: focused customer presentation components.
- `src/mock/styles.ts`: canonical mock style dataset and read helpers for trending cards and style detail lookup.
- `src/domain/pricing.ts`: rule-based quote calculator used by mock style previews and bookings.
- `src/components/layout/*`: shared shell primitives for both customer and merchant role surfaces.
- `docs/architecture/graphify-ingestion-policy.md` and `graphify-out/*`: Graphify collaboration policy and shared orientation artifacts.

## LLM integration

No live product LLM integration exists yet. The current product-facing AI surface is mocked through `src/mock/ai.ts`, which feeds recognition payloads into customer discovery/detail and pricing flows. Graphify semantic extraction remains an intentional maintenance tool rather than a runtime dependency.
