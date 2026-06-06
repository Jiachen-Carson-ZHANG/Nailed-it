# P6.5 Merchant Style Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store merchant-owned style images in Supabase Storage, manage their review/publish lifecycle in Postgres, and wire published styles to customer discovery plus the merchant Me/library surfaces.

**Architecture:** Add `media_asset` and `merchant_style` behind the existing repository seam, with a media-storage adapter for Supabase Storage. Merchant-scoped server actions orchestrate upload/review/publish; customer actions expose published records only. Keep the old `styles` table temporarily while runtime consumers move to the new model.

**Tech Stack:** Next.js App Router server actions, TypeScript, Supabase Postgres + Storage, repository seam, Vitest, Testing Library.

---

### Task 1: Add the relational media and merchant-style contract

**Files:**
- Create: `src/domain/merchant-style.ts`
- Create: `supabase/migrations/0009_merchant_style_library.sql`
- Modify: `docs/decisions/ADR-0005-relational-domain-model.md`

**Steps:**
1. Write domain tests for valid lifecycle transitions and customer-safe published-style mapping.
2. Run the focused test and verify it fails because the domain module does not exist.
3. Add typed `MediaAsset`, `MerchantStyle`, statuses, and pure mapping/transition helpers.
4. Add migration `0009` with `media_asset`, `merchant_style`, checks, tenant FKs, indexes, RLS,
   and idempotent creation of private-original/public-published Storage buckets.
5. Run focused tests and verify they pass.
6. Update ADR-0005 with the approved P6.5 phase.
7. Commit: `feat(styles): add merchant style and media foundation`

### Task 2: Extend the repository seam

**Files:**
- Modify: `src/lib/repositories/types.ts`
- Modify: `src/lib/repositories/index.ts`
- Modify: `src/lib/repositories/supabase/index.ts`
- Create: `src/lib/repositories/memory/merchant-style-repository.ts`
- Create: `src/lib/repositories/supabase/merchant-style-repository.ts`
- Create: `src/mock/merchant-styles.ts`
- Modify: `src/lib/repositories/memory/memory-repositories.test.ts`

**Steps:**
1. Write failing repository tests for merchant listing, published-only listing/get, insert, and
   lifecycle update.
2. Run the focused repository tests and confirm the missing repository failure.
3. Add `MerchantStyleRepository` to `RepositoryBundle`.
4. Implement isolated in-memory behavior seeded from existing mock style definitions.
5. Implement Supabase row mapping and scoped queries.
6. Run focused repository tests.
7. Commit: `feat(styles): add merchant style repository seam`

### Task 3: Add the media-storage adapter and style-library service

**Files:**
- Create: `src/lib/storage/types.ts`
- Create: `src/lib/storage/supabase-style-media-storage.ts`
- Create: `src/lib/services/merchant-style-service.ts`
- Create: `src/lib/services/merchant-style-service.test.ts`

**Steps:**
1. Write failing service tests for unsupported type, oversized upload, generated paths,
   upload-to-needs-review, publish, archive, and publish compensation.
2. Run tests and verify expected failures.
3. Implement a narrow storage interface: upload original, publish copy, remove published, and
   produce public URL.
4. Implement the service with server-side validation and generated ids/paths.
5. Run focused service tests.
6. Commit: `feat(styles): add merchant media upload and publish service`

### Task 4: Add scoped server actions

**Files:**
- Create: `src/lib/actions/merchant-style-actions.ts`
- Create: `src/lib/actions/merchant-style-actions.test.ts`

**Steps:**
1. Write failing action tests proving customer reads return published records only and merchant
   commands are fixed to the demo merchant.
2. Run the focused tests and verify failures.
3. Add actions for customer list/get and merchant list/upload/rename/publish/archive.
4. Ensure customer DTOs contain public URLs only.
5. Run focused action tests.
6. Commit: `feat(styles): expose scoped merchant style actions`

### Task 5: Wire customer discovery and detail

**Files:**
- Modify: `src/app/customer/home/page.tsx`
- Modify: `src/app/customer/home/page.test.tsx`
- Create: `src/features/customer/PublishedStyleFeed.tsx`
- Modify: `src/app/customer/style/[id]/page.tsx`
- Modify: `src/app/customer/style/[id]/page.test.tsx`
- Modify: `src/features/customer/StyleDetailPanel.tsx`

**Steps:**
1. Update page tests first to expect DB-backed published styles and no unpublished styles.
2. Run focused customer tests and verify failures.
3. Add a client feed loader that calls the published-style action and reuses the existing grid.
4. Change style detail to load the published style through the customer action.
5. Preserve booking/try-on links and customer-safe image URLs.
6. Run focused customer tests.
7. Commit: `feat(customer): show published merchant styles`

### Task 6: Add merchant library preview and management page

**Files:**
- Modify: `src/app/merchant/profile/page.tsx`
- Modify: `src/app/merchant/profile/page.test.tsx`
- Create: `src/app/merchant/styles/page.tsx`
- Create: `src/app/merchant/styles/page.test.tsx`
- Create: `src/features/merchant/MerchantStyleLibrary.tsx`
- Modify: `src/app/globals.css`

**Steps:**
1. Write failing tests for the profile collection preview, upload form, status labels, publish, and
   archive controls.
2. Run focused merchant tests and verify failures.
3. Add the Me-page preview and `/merchant/styles` management route.
4. Implement upload with `FormData`, title editing, publish, and archive commands.
5. Add restrained responsive styles using existing visual conventions.
6. Run focused merchant tests.
7. Commit: `feat(merchant): manage style library from Me`

### Task 7: Seed, document, and verify

**Files:**
- Modify: `scripts/seed-supabase.ts`
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`

**Steps:**
1. Extend the seed path to create merchant style/media rows while preserving stable external seed
   images until real files are uploaded.
2. Document the Storage/object-path model, lifecycle, UI consumers, no-auth limitation, and P7
   handoff.
3. Run `npm test`.
4. Run `npx tsc --noEmit`.
5. Run `npm run build`.
6. Review `git diff --check` and ensure the user's unrelated files remain untouched.
7. Commit: `docs(styles): record P6.5 merchant style library`

