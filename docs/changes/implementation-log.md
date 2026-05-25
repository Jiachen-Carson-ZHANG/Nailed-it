# Implementation Log

## 2026-05-25 - Customer Journey QA And Message Thread Cleanup

**Context:** Playwright QA showed that the customer inbox exposed other customers' appointment threads, the confirm action could be clicked again after booking, and module-only demo state disappeared on reload. The seeded message content also looked like unrelated fake chat instead of one operational thread per appointment.

**Changes (customer journey/messaging):**
- Added Playwright coverage for the customer inbox, mocked AI upload booking, low-confidence review fallback, direct thread access denial, message-thread handoff, and post-booking profile continuity without calling the live Gemini API.
- Filtered customer conversations to the current demo customer while keeping the merchant inbox shop-wide.
- Simplified seeded message threads to one system event per appointment and kept customer/merchant replies as demo composer actions.
- Locked the confirmation screen after a booking is created so one customer action creates one booking and one message thread.
- Persisted the browser-session operations store in a versioned `localStorage` snapshot so no-backend demo bookings, threads, and sent messages survive reloads in the same browser session.

**Verification:**
- `npm test -- src/mock/operations-store.test.ts src/app/customer/booking/confirm/page.test.tsx src/app/customer/messages/page.test.tsx src/app/customer/messages/[conversationId]/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx`
- `npx playwright test`

**Must remain true:** The message system remains a demo-level browser-session store, not a backend service. Customer role visibility must stay scoped to the active customer identity, merchant visibility must remain shop-wide, and Playwright recognition tests must keep mocking `/api/ai/recognize-nail-style` so they never spend provider tokens.

## Date - Wave

**Context:** 

**Changes ():**

**Verification:**

**Must remain true:**

## 2026-05-25 - Round 2 Technician Auto-Booking

**Context:** Round 1 could recognize a nail image and price the editable attributes, but booking still stopped at a request toast. Merchant screens also lacked technician visibility and messages were static snapshots, so the demo did not yet show the style-to-booking operating loop.

**Changes (auto-booking/operations):**
- Added technician contracts, technician seeds, and pure availability assignment so customer slot choices include staff and avoid same-technician conflicts.
- Added a browser-session operations store for booking snapshots, booking-linked conversation threads, instant booking creation, and demo message sending.
- Changed customer confirmation to auto-confirm normal-confidence bookings and route low-confidence recognition results into `pending_review`.
- Updated merchant calendar, booking detail, manage, and profile surfaces to show technician assignment, workload, and message-thread links.
- Replaced static message route reads with role-aware operations-store conversations and a demo composer for customer and merchant replies.

**Verification:**
- `npm test -- src/domain/availability.test.ts src/app/customer/booking/confirm/page.test.tsx src/mock/operations-store.test.ts src/domain/messaging.test.ts`
- `npm test -- src/app/merchant/manage/page.test.tsx src/app/merchant/profile/page.test.tsx src/app/merchant/calendar/page.test.tsx`
- `npm test -- src/app/customer/messages/page.test.tsx src/app/customer/messages/[conversationId]/page.test.tsx src/app/merchant/messages/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx`
- `npm test -- src/app/merchant/booking/[id]/page.test.tsx`

**Must remain true:** The app remains a no-backend demo; operations-store state is session-local and must not be mistaken for persistence. AI output stays limited to attributes/confidence, while pricing, duration, availability, auto-confirmation, and review fallback remain deterministic app logic. `src/app/globals.css` must stay owned by the frontend design work and was not changed in this round.

## 2026-05-25 - Gemini Recognition Wiring

**Context:** The current main branch had a frontend/mock booking loop but no live product LLM path. The old Sprint 1 backend branch could not be merged directly because it rewrites frontend surfaces and `globals.css`, which is now owned by the frontend design merge.

**Changes (AI recognition/env):**
- Added a server-side Gemini image-recognition adapter using `gemini-2.5-flash-lite` by default.
- Added `/api/ai/recognize-nail-style` so uploaded customer photos can be recognized without exposing the provider key to the browser.
- Wired the current customer booking page to either use a sample mock image or send a real uploaded image to the live API.
- Added `.env.local.example` and a local `.env.local` placeholder for `GEMINI_API_KEY`, plus gitignore coverage for local env files.

**Verification:**
- `npm test -- src/lib/ai/nail-recognition.test.ts src/app/customer/booking/page.test.tsx`

**Must remain true:** The image model returns attributes and confidence only. Pricing, duration, availability, and booking decisions must stay in deterministic app/domain logic, and `src/app/globals.css` remains untouched by this backend-wiring change.

## 2026-05-24 - Messages And Profile Slice

**Context:** Task 8 was the last missing frontend slice in the shared mobile shell. Messages and profile routes were still marked planned in the session contract, so both roles lacked a complete navigation loop and no UI existed yet for conversation continuity or profile-level summaries.

**Changes (messages/profile):**
- Opened customer and merchant `messages` / `profile` routes in `src/domain/session.ts`, including tab visibility, active-match prefixes, and shared path helpers for list/detail routes.
- Added focused shared components for conversation list rows, chat room rendering, customer booking history cards, and merchant analytics cards instead of embedding message/profile logic directly in route pages.
- Implemented six new app routes for customer and merchant message list/detail pages plus profile pages, all reading from existing shared mock conversations and bookings.
- Extended `src/app/globals.css` with message, chat, history, and analytics styles that stay inside the existing mobile-shell design language.
- Added focused route tests for the new pages and updated session/tab coherence tests to lock the navigation contract.

**Verification:**
- `npm test -- src/components/layout/BottomTabBar.test.tsx src/mock/mock-data.test.ts src/app/customer/messages/page.test.tsx src/app/customer/messages/[conversationId]/page.test.tsx src/app/customer/profile/page.test.tsx src/app/merchant/messages/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx src/app/merchant/profile/page.test.tsx`
- `npm test`
- `npm run build`

**Must remain true:** Messages and profile surfaces must keep reading the shared conversation and booking mocks instead of introducing page-local copies; route availability and bottom-tab visibility must continue to derive from the shared session contract.

## 2026-05-24 - Customer Discovery And Style Detail Slice

**Context:** The customer home route was still a placeholder and the style detail route did not exist, so the shared mobile shell and mock style contracts were not yet exercised through a real customer flow.

**Changes (frontend customer slice):**
- Replaced the customer home placeholder with a mobile-shell discovery page backed by `getTrendingStyles()`.
- Added focused customer presentation components for style cards, the discovery grid, and the style detail panel.
- Added `/customer/style/[id]` and wired it to the shared mock style source of truth using both `findStyleById()` and `getStyleDefinitionById()`.
- Extended `src/app/globals.css` with discovery/detail styles that fit the existing shell instead of creating a separate layout system.
- Added route-level tests for customer home and style detail.

**Verification:**
- `npm test -- src/app/customer/home/page.test.tsx src/app/customer/style/[id]/page.test.tsx`
- `npm test`
- `npm run build`

**Must remain true:** Customer discovery/detail must keep using the shared mock style helpers as the source of truth; preview quotes must continue to derive from current pricing rules rather than duplicated page-local data.

## 2026-05-24 - Customer Discovery Quality Follow-up

**Context:** The first discovery/detail slice still duplicated route strings in page/components, mixed marketing and domain labels in one raw tag list, and rendered brittle mobile stats/CTAs when data or downstream flows were unavailable.

**Changes (contract and UI hardening):**
- Moved customer style detail paths and planned-flow placeholders into the shared session model so discovery/detail reuse one navigation source.
- Replaced raw `tags: string[]` with typed discovery facets in the nail/style contracts while keeping the rendered UI lightweight.
- Added a real empty-state path for discovery and removed invalid price-range math for empty style lists.
- Relaxed discovery/detail mobile layout defaults to single-column first, letting later booking flow surfaces reuse the same shell more naturally.

**Verification:**
- `npm test -- src/app/customer/home/page.test.tsx src/app/customer/style/[id]/page.test.tsx src/mock/mock-data.test.ts`
- `npm test`
- `npm run build`

**Must remain true:** Future booking activation should come from the shared session/navigation model; customer discovery tags must stay typed enough to distinguish domain attributes from marketing/lifestyle labels.

## 2026-05-24 - Merchant Calendar And Pricing Slice

**Context:** Merchant routes were still placeholders, so the shared booking snapshots and pricing rules had no merchant-side operational surface.

**Changes (merchant core):**
- Replaced the merchant calendar placeholder with a mobile-shell calendar view backed by shared mock bookings and a day-level bottom sheet.
- Added merchant booking detail and pricing management pages, plus focused merchant components for daily booking cards, calendar interaction, and pricing rule editing.
- Exposed merchant manage and booking detail paths through the shared session/navigation helpers so merchant navigation stays coherent with the existing shell.
- Extended global styles for calendar, booking detail, and pricing rule layouts without introducing a separate merchant-only style system.

**Verification:**
- `npm test -- src/app/merchant/calendar/page.test.tsx src/app/merchant/manage/page.test.tsx src/app/merchant/booking/[id]/page.test.tsx`
- `npm test`
- `npm run build`

**Must remain true:** Merchant scheduling and pricing views must continue to read the same booking snapshots and pricing rules used elsewhere in the app; avoid creating a second merchant-only source of truth for quotes or appointments.

## 2026-05-19 - Graphify Collaboration Refresh

**Context:** Migrated Graphify artifacts described the old BT5151 codebase and included machine-local paths, making agent orientation misleading in the Nailed-it scaffold.

**Changes (Graphify governance):**
- Removed stale raw graph artifacts from the shared commit surface and made them local-only.
- Rebuilt the shared report for the current scaffold with a zero-token AST update.
- Added a report-and-manifest-only collaboration policy, stale-check tooling, CI validation, and an ADR.

**Verification:**
- `graphify update . --force`
- `python scripts/graphify_maintenance.py check-stale`
- `python -m pytest tests/test_graphify_maintenance.py`

**Must remain true:** `GRAPH_REPORT.md` and `manifest.json` are the only committed Graphify outputs; raw graph files remain local-only and semantic extraction is intentional.

## 2026-05-19 - Python Version Contract

**Context:** Collaborators may use different local Python installs; the repo had no declared minimum version.

**Changes (tooling):**
- Added `pyproject.toml` with `requires-python = ">=3.10"`.
- Added `.python-version` (`3.10`) for pyenv/asdf defaults.
- Documented the contract in `graphify-out/README.md`; CI continues to run on 3.10 as the minimum supported version.

**Verification:**
- `python -m pytest tests/test_graphify_maintenance.py`

**Must remain true:** Repository tooling and maintenance scripts target Python 3.10+; CI validates the floor on 3.10.
