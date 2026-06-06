# Merchant Style Review Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cramped merchant style-library editor with immediate post-upload navigation to a dedicated full-page AI review workspace.

**Architecture:** Upload/create becomes a fast operation that stores the private original and returns a `processing` style id. The review route downloads that stored original server-side, runs strict AI analysis, and atomically writes the suggestion while transitioning the style to `needs_review`. Deterministic quote preview, draft save, and publish remain server actions over the existing service/repository seams.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Supabase Storage/Postgres RPCs.

---

### Task 1: Stored-Image Analysis Contract

**Files:**
- Modify: `src/lib/storage/types.ts`
- Modify: `src/lib/storage/memory-style-media-storage.ts`
- Modify: `src/lib/storage/supabase-style-media-storage.ts`
- Modify: `src/lib/services/merchant-style-service.ts`
- Modify: `src/lib/repositories/types.ts`
- Modify: `src/lib/repositories/memory/merchant-style-repository.ts`
- Modify: `src/lib/repositories/supabase/merchant-style-repository.ts`
- Create: `supabase/migrations/0016_merchant_style_analysis_workflow.sql`
- Test: `src/lib/services/merchant-style-service.test.ts`
- Test: `src/lib/repositories/memory/merchant-style-repository.test.ts`

1. Write failing tests proving upload creates a `processing` draft and stored private bytes can be
   downloaded.
2. Write failing repository/service tests proving AI completion atomically writes title,
   description, facets, normalized items, derived preview, and `needs_review`.
3. Write a failing test proving analysis failure moves a `processing` draft to `needs_review`
   without publishing it.
4. Add `downloadOriginal` to the Storage seam.
5. Add repository operations for atomic analysis completion and analysis-failure review fallback.
6. Add migration `0016` with server-only RPCs implementing those transitions.
7. Run the focused service/repository tests.

### Task 2: Merchant Review Server Actions

**Files:**
- Modify: `src/lib/actions/merchant-style-actions.ts`
- Modify: `src/lib/actions/merchant-style-actions.test.ts`

1. Write failing action tests proving upload accepts only the image and returns a `processing` draft.
2. Write failing tests for merchant-scoped review fetch, stored-image analysis, deterministic quote
   preview, draft save, and publish.
3. Split `uploadMerchantStyleAction` so it performs no AI call.
4. Add `getMerchantStyleReviewAction(styleId)`.
5. Add `analyzeMerchantStyleAction(styleId)` that downloads the stored original, runs
   `recognizeStyleConfig`, and completes/fails analysis through the service.
6. Add `previewMerchantStyleQuoteAction(selections)` and `saveMerchantStyleDraftAction(input)`.
7. Run the focused action tests.

### Task 3: Collection Page Simplification

**Files:**
- Refactor: `src/features/merchant/MerchantStyleLibrary.tsx`
- Modify: `src/app/merchant/styles/page.test.tsx`

1. Write a failing page test proving there is no title input or embedded review form.
2. Write a failing interaction test proving selecting a file uploads it and routes to
   `/merchant/styles/{id}/review`.
3. Replace the current form with one large upload tile/button matching the customer upload
   interaction.
4. Render collection cards with image, status, title, derived price/duration, and route/archive
   actions only.
5. Run the collection-page tests.

### Task 4: Dedicated Review Workspace

**Files:**
- Create: `src/app/merchant/styles/[id]/review/page.tsx`
- Create: `src/app/merchant/styles/[id]/review/page.test.tsx`
- Create: `src/features/merchant/MerchantStyleReviewWorkspace.tsx`
- Modify: `src/app/globals.css`

1. Write failing page/component tests for processing analysis, editable title/description, selected
   services first, catalog search, quote preview, save draft, and publish.
2. Build the route without bottom tabs.
3. Trigger stored-image analysis once when an unconfigured `processing` draft opens, then refresh
   the review state.
4. Build a focused image-and-metadata header, selected-service editor, searchable add-service list,
   live quote summary, and sticky save/publish actions.
5. Ensure `per_set` quantities render as one and cannot be edited.
6. Run the review-workspace tests.

### Task 5: Source-Of-Truth Documentation And Verification

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`
- Modify: `docs/decisions/ADR-0005-relational-domain-model.md`

1. Record the fast-upload → stored-image analysis → dedicated review workflow.
2. Record migration `0016` and the atomic analysis-completion invariant.
3. Run focused tests.
4. Run `npm run test`.
5. Run `npx tsc --noEmit`.
6. Remove `.next` and run `npm run build`.
7. Run `git diff --check`.
8. Perform browser QA for upload → immediate review route → AI/manual review → publish.
