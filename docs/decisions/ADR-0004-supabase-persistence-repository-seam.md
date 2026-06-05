# ADR-0004: Database-backed persistence via a repository seam (Supabase)

**Status:** Accepted (P0–P1 implemented; P2–P4 pending). Refined by ADR-0005 (relational domain model).
**Date:** 2026-06-04
**Supersedes:** —
**Superseded by:** —

---

## Context

All operational state lived in the browser, not a backend:

- Bookings and conversation threads were stored in `window.localStorage` via `src/mock/operations-store.ts`.
- Merchant pricing edits (`/merchant/manage`) persisted nowhere — the "All changes saved" toast was cosmetic; edits reset on reload.
- Technicians and styles were code-level constants.

Consequence: customer and merchant never shared state. A booking made in one browser was invisible to the other actor's browser. The core platform pitch — customer style → booking → merchant fulfilment — could not be demonstrated across two devices. State also died on cache clear and could not survive a redeploy.

The `/api/ai/*` routes are stateless Gemini proxies and are unaffected by this decision.

## Decision

Introduce one shared source of truth, accessed through a **repository seam**, and back it with **Supabase (hosted Postgres + realtime)**.

- **Repository interfaces** (`src/lib/repositories/types.ts`): `BookingRepository`, `ConversationRepository`, `PricingRepository`, `TechnicianRepository`, `StyleRepository`, plus a `RepositoryBundle`. All methods are **async** so consumers are DB-ready regardless of backend. Repositories are pure persistence (CRUD) — no domain orchestration.
- **Two implementations** behind each interface: an in-memory impl (`src/lib/repositories/memory/`) for tests and local fallback, and a Supabase-backed impl (later phase). The factory in `src/lib/repositories/index.ts` selects the impl; it will switch to Supabase by environment variable in P1.
- **`src/domain/*` stays unchanged** — pure logic (availability, pricing math, messaging, booking-draft, types) depends on no storage.
- **Client → server boundary moves** (P2): reads become async Server Components, writes become Server Actions. The Supabase service-role key never reaches the browser. This is the correct Next 15 App Router shape; the localStorage store was the workaround.
- **Realtime** (P3): Supabase channel subscriptions on `bookings` and `messages` push live updates to the merchant calendar and both message views.
- **Scope:** all operational data migrates — bookings, conversation threads + messages, pricing rules, technicians, styles.

### Phasing

- **P0 (done):** repository interfaces + in-memory impls + tests. Additive; no behavior change.
- **P1 (done):** Supabase project, schema migrations, seed, DB-backed impls. Verified against the live project.
- **P1.5+ (ADR-0005):** the interim flat schema here is superseded by the catalog / merchant_pricing / interval-booking model. See ADR-0005.
- **P2:** wire consumers (reads → Server Components, writes → Server Actions); retire the localStorage path.
- **P3:** realtime subscriptions (bookings + messages).
- **P4:** pricing / technicians / styles editable + persisted by the merchant.

## Design principles

- Explicit contracts over implicit shared state — consumers depend on an interface, never on a storage mechanism.
- Async-first interfaces so the client/server migration is wiring, not redesign.
- Repositories do persistence only; domain orchestration (ID generation, status decisions, thread creation) stays in the service/server layer.
- Deep-clone on read and write in the in-memory impl to prevent shared-reference mutation (mirrors the prior store's clone discipline; covered by tests).

## Alternatives considered

- **Neon / Vercel Postgres + Drizzle:** typed migrations, smaller dependency surface, but no built-in realtime — merchant would poll or refresh. Rejected for the demo because live cross-actor updates are the strongest moment for judges.
- **Local SQLite file:** zero external infra, but Vercel serverless has an ephemeral filesystem, so a SQLite file does not persist in production. Viable for local-only, not for the deployed demo.
- **Keep localStorage:** rejected — it cannot share state across actors, which defeats the platform's core flow.

## Consequences

**Positive**

- Customer and merchant share one source of truth; the end-to-end booking flow is demonstrable across devices.
- Persistence survives reload, device change, and redeploy.
- Merchant pricing edits become real saves (P4).
- Cleaner architecture story: pure domain + repository seam + correct Next 15 server boundary.

**Negative**

- New external dependency (Supabase) and credential management (`.env.local`, Vercel env).
- The P2 client → server migration touches every store consumer (≈9 files).
- A realtime path adds a subscription lifecycle to maintain.

## References

- `src/lib/repositories/` — interfaces + in-memory impls (P0).
- `src/mock/operations-store.ts` — the localStorage store being replaced (retired in P2).
- ADR-0001 (Gemini vision), ADR-0003 (expanded AI capabilities) — the AI routes that remain stateless.
- `docs/changes/implementation-log.md` — P0 entry.
