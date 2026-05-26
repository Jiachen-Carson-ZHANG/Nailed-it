# Gemini Cost Monitor And Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side Gemini usage/cost logging and harden agreed domain edge cases.

**Architecture:** Parse Gemini `usageMetadata` in the provider, calculate estimated USD with centralized model pricing, and log only from the server API route. Move low-confidence review policy into domain code and add regression tests for edge behavior.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Gemini GenerateContent REST API.

---

### Task 1: Domain Review Policy

**Files:**
- Modify: `src/domain/nail.ts`
- Modify: `src/mock/operations-store.ts`
- Test: `src/mock/operations-store.test.ts`

**Steps:**
1. Add failing tests for threshold confidence and `NaN` confidence.
2. Add exported `confidenceReviewThreshold` and `requiresMerchantReview()`.
3. Use the helper in `createBookingFromDraft`.
4. Run `npm test -- src/mock/operations-store.test.ts`.

### Task 2: Domain Edge Tests

**Files:**
- Modify: `src/domain/pricing.test.ts`
- Modify: `src/domain/availability.test.ts`
- Modify: `src/lib/ai/nail-recognition.test.ts`

**Steps:**
1. Add tests for empty pricing rules and no active technicians.
2. Add tests for `NaN`, negative, and over-one confidence normalization.
3. Run focused tests and confirm existing implementation covers expected behavior.

### Task 3: Gemini Usage And Cost Monitoring

**Files:**
- Create: `src/lib/ai/usage-cost.ts`
- Create: `src/lib/ai/usage-cost.test.ts`
- Modify: `src/lib/ai/nail-recognition.ts`
- Modify: `src/lib/ai/nail-recognition.test.ts`
- Modify: `src/app/api/ai/recognize-nail-style/route.ts`

**Steps:**
1. Add failing tests for cost calculation and provider usage extraction.
2. Implement usage metadata parsing and cost calculation.
3. Log a compact server-side cost event in the API route.
4. Run focused tests.

### Task 4: Documentation And Verification

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`
- Modify: `.env.local.example`

**Steps:**
1. Document server-only cost logging and env overrides.
2. Run `npm test`, `npx tsc --noEmit --pretty false`, and `npm run build`.
3. Commit and push if this should redeploy to Vercel.
