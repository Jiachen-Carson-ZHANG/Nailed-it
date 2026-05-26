# Pinterest Privacy Approval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public privacy-policy page and product links so Pinterest Trial access reviewers have a direct URL.

**Architecture:** Use a static Next.js App Router page at `/privacy`. Keep profile links as normal `next/link` anchors and avoid changing shared CSS or app state.

**Tech Stack:** Next.js App Router, React Testing Library, Vitest.

---

### Task 1: Public Privacy Route

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/privacy/page.test.tsx`

**Steps:**
1. Add a static privacy page with explicit Pinterest OAuth, data-use, retention, disconnect, and contact language.
2. Add a route-level test that verifies the page has a Privacy Policy heading, says Pinterest is optional, and links back home.
3. Run `npm test -- src/app/privacy/page.test.tsx`.

### Task 2: Account Links

**Files:**
- Modify: `src/app/customer/profile/page.tsx`
- Modify: `src/app/customer/profile/page.test.tsx`
- Modify: `src/app/merchant/profile/page.tsx`
- Modify: `src/app/merchant/profile/page.test.tsx`

**Steps:**
1. Add a `/privacy` link from both profile pages.
2. Update existing profile tests to assert the link is present.
3. Run the affected profile tests.

### Task 3: Documentation And Verification

**Files:**
- Modify: `docs/changes/implementation-log.md`
- Optionally modify: `docs/architecture/current-state.md` if the public route should be listed as an app surface.

**Steps:**
1. Append a concise implementation-log entry.
2. Run `npm test`, `npx tsc --noEmit --pretty false`, and `npm run build`.
3. Commit and push to `main` for Vercel import/deployment.
