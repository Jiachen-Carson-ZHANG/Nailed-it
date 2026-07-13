# Collapsible Trending Panel + Search Bar Above Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the search bar above the trending panel, and make the trending panel collapsible (default: collapsed, toggle on header click with ▶/▼ chevron).

**Architecture:** Lift `searchQuery` state from `StyleWaterfallGridClient` up to a new `CustomerHomeClient` wrapper component. The search bar renders at the top of that wrapper. `TrendingStylesPanel` gains its own local `expanded` state. `StyleWaterfallGridClient` drops its internal search state and accepts `searchQuery` as a prop.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Vitest (jsdom), CSS classes in `src/app/globals.css`

---

## File Map

| Action | File |
|--------|------|
| Create | `src/features/customer/CustomerHomeClient.tsx` |
| Modify | `src/app/customer/home/page.tsx` |
| Modify | `src/features/customer/TrendingStylesPanel.tsx` |
| Modify | `src/features/customer/PublishedStyleFeed.tsx` |
| Modify | `src/features/customer/StyleWaterfallGridClient.tsx` |
| Modify | `src/app/globals.css` (add `.trending-panel-toggle` style) |

---

### Task 1: Accept `searchQuery` as a prop in `StyleWaterfallGridClient`

**Files:**
- Modify: `src/features/customer/StyleWaterfallGridClient.tsx`

- [ ] **Step 1: Update the props type and remove internal search state**

Open `src/features/customer/StyleWaterfallGridClient.tsx`. Change the props type and remove the `searchQuery` useState. The diff is:

```tsx
// Before
type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
  reasonByStyleId?: Record<string, string>;
};

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const { t, language } = useLanguage();
  const [showSaved, setShowSaved] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // ...
```

```tsx
// After
type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
  reasonByStyleId?: Record<string, string>;
  searchQuery: string;
};

export function StyleWaterfallGridClient({ styles, searchQuery }: StyleWaterfallGridClientProps) {
  const { t, language } = useLanguage();
  const [showSaved, setShowSaved] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  // (no searchQuery useState)
  // ...
```

- [ ] **Step 2: Remove the search bar JSX from `StyleWaterfallGridClient`**

Delete the `<div className="feed-search">…</div>` block (lines 104–118 in the current file). The `return` should now open directly with `<section className="xhs-feed" …>` followed immediately by the filter block.

The section should look like:

```tsx
  return (
    <section className="xhs-feed" aria-label={t('feed.aria')}>
      {filterGroups.length > 0 ? (
        <div className="feed-filter">
          {/* ... existing filter bar ... */}
        </div>
      ) : null}
      {/* ... rest unchanged ... */}
    </section>
  );
```

- [ ] **Step 3: Run the type-check to confirm no errors**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only about `searchQuery` prop missing in callers (fix in later tasks), not about internal logic.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer/StyleWaterfallGridClient.tsx
git commit -m "refactor: accept searchQuery as prop in StyleWaterfallGridClient"
```

---

### Task 2: Thread `searchQuery` through `PublishedStyleFeed`

**Files:**
- Modify: `src/features/customer/PublishedStyleFeed.tsx`

- [ ] **Step 1: Add `searchQuery` prop and pass it to `StyleWaterfallGridClient`**

Replace the current `PublishedStyleFeed` implementation:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import { getRankedFeedAction } from '@/lib/actions/customer-intel-actions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLanguage } from '@/i18n/context';
import { StyleWaterfallGridClient } from './StyleWaterfallGridClient';

type PublishedStyleFeedProps = {
  searchQuery: string;
};

export function PublishedStyleFeed({ searchQuery }: PublishedStyleFeedProps) {
  const { t } = useLanguage();
  const [styles, setStyles] = useState<PublishedMerchantStyle[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getRankedFeedAction()
      .then((feed) => {
        if (!active) return;
        setStyles(feed.styles);
        setReasons(feed.reasons);
      })
      .catch(() =>
        listCustomerPublishedStylesAction()
          .then((next) => active && setStyles(next))
          .catch(() => active && setFailed(true)),
      );
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <EmptyState title={t('feed.unavailableTitle')} body={t('feed.unavailableBody')} />;
  }
  if (styles === null) {
    return <LoadingState title={t('feed.loadingTitle')} body={t('feed.loadingBody')} />;
  }
  return <StyleWaterfallGridClient styles={styles} reasonByStyleId={reasons} searchQuery={searchQuery} />;
}
```

- [ ] **Step 2: Run type-check**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && npx tsc --noEmit 2>&1 | head -40
```

Expected: error about `PublishedStyleFeed` missing `searchQuery` prop in `page.tsx` only.

- [ ] **Step 3: Commit**

```bash
git add src/features/customer/PublishedStyleFeed.tsx
git commit -m "refactor: thread searchQuery prop through PublishedStyleFeed"
```

---

### Task 3: Make `TrendingStylesPanel` collapsible

**Files:**
- Modify: `src/features/customer/TrendingStylesPanel.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add collapsed state and toggle UI to `TrendingStylesPanel`**

Replace the entire `TrendingStylesPanel` function (keep everything above it unchanged):

```tsx
export function TrendingStylesPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <button
        type="button"
        className="trending-panel-toggle"
        aria-expanded={expanded}
        aria-controls="trending-panel-body"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <h2 id="trending-panel-title" className="trending-panel-title">热门款式</h2>
          <p className="trending-panel-subtitle">AI自动识别抓取近期热门款式</p>
        </div>
        <svg
          className="trending-panel-chevron"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          width="16"
          height="16"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="5,7 10,13 15,7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      {expanded && (
        <div id="trending-panel-body" className="trending-list">
          {STATIC_TRENDING.map((style) => (
            <TrendingRow key={style.rank} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
```

Also update the imports at the top of the file — add `useState`, remove the unused `Button` import:

```tsx
import { useState } from 'react';
import type { AITrendingStyle } from '@/domain/nail';
// Remove: import { Button } from '@/components/ui/Button';
```

- [ ] **Step 2: Add CSS for `.trending-panel-toggle`**

In `src/app/globals.css`, find the `.trending-panel-header` block (around line 5188) and add after `.trending-panel-subtitle` (after line 5206):

```css
.trending-panel-toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
}
```

- [ ] **Step 3: Remove the now-unused `.trending-panel-header` rule**

Find `.trending-panel-header` in `globals.css` (line 5188–5193) and delete those lines entirely — the toggle button takes over that layout role.

- [ ] **Step 4: Run type-check**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/TrendingStylesPanel.tsx src/app/globals.css
git commit -m "feat: make TrendingStylesPanel collapsible, default collapsed"
```

---

### Task 4: Create `CustomerHomeClient` and wire everything together

**Files:**
- Create: `src/features/customer/CustomerHomeClient.tsx`
- Modify: `src/app/customer/home/page.tsx`

- [ ] **Step 1: Create `CustomerHomeClient.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useLanguage } from '@/i18n/context';
import { TrendingStylesPanel } from './TrendingStylesPanel';
import { PublishedStyleFeed } from './PublishedStyleFeed';

export function CustomerHomeClient() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      <div className="feed-search">
        <div className="feed-search-wrap">
          <svg className="feed-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12.5" y1="12.5" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('feed.searchPlaceholder')}
            aria-label={t('feed.searchPlaceholder')}
          />
        </div>
      </div>
      <TrendingStylesPanel />
      <PublishedStyleFeed searchQuery={searchQuery} />
    </>
  );
}
```

- [ ] **Step 2: Update `page.tsx` to use `CustomerHomeClient`**

Replace the full content of `src/app/customer/home/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { CustomerHomeClient } from '@/features/customer/CustomerHomeClient';

export default function CustomerHomePage() {
  return (
    <MobileLayout role="customer" title="Nailed-it">
      <CustomerHomeClient />
    </MobileLayout>
  );
}
```

- [ ] **Step 3: Run type-check — expect clean**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Run unit tests**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && npm test 2>&1 | tail -30
```

Expected: all tests pass (no tests import the removed search bar from `StyleWaterfallGridClient` directly).

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/CustomerHomeClient.tsx src/app/customer/home/page.tsx
git commit -m "feat: lift search bar above trending panel via CustomerHomeClient"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /sapmnt/home/I777626/projects/nailed-it-main/Nailed-it && ./dev
```

- [ ] **Step 2: Verify the layout**

Open the customer home page. Confirm:
1. Search bar appears at the very top of the content area.
2. Below search bar: trending panel header shows "热门款式" + subtitle + `▼` chevron, list is hidden.
3. Clicking the header expands the list (3 ranked rows visible), chevron rotates to point down.
4. Clicking again collapses it.
5. Typing in the search bar filters the style grid below the trending panel.
6. Refresh button is gone (it was a no-op).

- [ ] **Step 3: Stop dev server and commit if any CSS tweaks were needed**

If you made any CSS-only tweaks during smoke test:
```bash
git add src/app/globals.css
git commit -m "fix: adjust trending panel toggle spacing"
```
