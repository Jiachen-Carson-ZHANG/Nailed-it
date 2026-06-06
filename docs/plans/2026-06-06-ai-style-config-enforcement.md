# AI Style Config Enforcement Implementation Plan

**Goal:** Make AI-generated style configurations structurally valid, normalize `per_set` quantities to one, and expose every price/time-relevant catalog item in the merchant single-upload approval UI.

**Architecture:** OpenRouter receives strict JSON Schema response formats, then the app validates the parsed result again before domain logic uses it. A shared pricing-unit normalizer makes `per_set` quantity one at AI, quote, persistence, and database boundaries. Single uploads remain `needs_review`; the existing batch script keeps its current workflow but reuses the hardened pipeline.

**Tech Stack:** Next.js server actions, TypeScript, Vitest, OpenRouter chat completions, Supabase/Postgres.

---

### Task 1: Enforce AI JSON

**Files:**
- Modify: `src/nail-ai/openrouter.ts`
- Modify: `src/nail-ai/breakdown.ts`
- Modify: `src/nail-ai/style-config-recognition.ts`
- Create: `src/nail-ai/breakdown.test.ts`
- Create: `src/nail-ai/style-config-recognition.test.ts`

1. Add failing tests for missing sections, wrong-shaped items, and malformed naming output.
2. Add strict OpenRouter JSON Schema payloads with response healing.
3. Add runtime validation so syntactically valid but wrong-shaped JSON fails and retries.

### Task 2: Normalize `per_set`

**Files:**
- Create: `src/domain/catalog-selection.ts`
- Create: `src/domain/catalog-selection.test.ts`
- Modify: `src/nail-ai/breakdown.ts`
- Modify: `src/lib/services/quote-service.ts`
- Modify: `src/lib/services/merchant-style-service.ts`
- Modify: `src/lib/services/services.test.ts`
- Modify: `src/lib/services/merchant-style-service.test.ts`
- Create: `supabase/migrations/0015_per_set_quantity.sql`

1. Add failing tests proving `per_set` becomes one while other units remain unchanged.
2. Normalize before quote calculation and before relational style items are persisted.
3. Add a database trigger so direct writes cannot persist `per_set` quantities above one.

### Task 3: Complete Merchant Approval Editor

**Files:**
- Modify: `src/lib/actions/merchant-style-actions.ts`
- Modify: `src/lib/actions/merchant-style-actions.test.ts`
- Modify: `src/features/merchant/MerchantStyleLibrary.tsx`

1. Add a failing action test proving time/price-relevant items without platform default prices are listed.
2. Return price, duration, unit, and enabled state for the editor.
3. Disable quantity editing for `per_set` and display all relevant items.

### Task 4: Document And Verify

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`

1. Document strict JSON enforcement, manual approval, and `per_set` normalization.
2. Run focused tests, full tests, TypeScript, build, and `git diff --check`.
