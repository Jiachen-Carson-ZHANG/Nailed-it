# Design: Collapsible Trending Panel + Search Bar Above

**Date:** 2026-06-27  
**Branch:** feat/commercialisation

## Summary

Move the search bar above `TrendingStylesPanel` and make the trending panel collapsible. Default state is collapsed. Clicking the entire header row toggles open/closed; a `▶/▼` chevron on the right communicates affordance.

## Layout Change

**Before:**
```
TrendingStylesPanel (always visible)
PublishedStyleFeed
  └── search bar
  └── filter chips
  └── style grid
```

**After:**
```
search bar (lifted to page level)
TrendingStylesPanel (collapsible, default collapsed)
  └── header row (clickable): title + subtitle + [▶/▼]
  └── collapsible body: ranked list
PublishedStyleFeed
  └── filter chips
  └── style grid
```

## Component Changes

### `CustomerHomePage` (`src/app/customer/home/page.tsx`)

- Stays a server component (no changes needed).
- Delegates interactive content to a new `CustomerHomeClient` component.

### `CustomerHomeClient` (`src/features/customer/CustomerHomeClient.tsx`) — new file

- Client component (`'use client'`).
- Holds `searchQuery` state.
- Renders: search bar input → `TrendingStylesPanel` → `PublishedStyleFeed`.
- Passes `searchQuery` and `setSearchQuery` to the relevant children.

### `TrendingStylesPanel` (`src/features/customer/TrendingStylesPanel.tsx`)

- Add `useState(false)` for `expanded` (default: collapsed).
- Wrap `<section>` header in a `<button>` (or add `onClick` + keyboard role to the header `<div>`).
- Header right side: replace the standalone `<Button>Refresh</Button>` with a `▶` (collapsed) / `▼` (expanded) chevron SVG.
- The ranked list is conditionally rendered: `{expanded && <div className="trending-list">…</div>}`.
- No changes to `TrendingRow` or link logic.

> Note: The Refresh button is removed. It currently does nothing (`onClick={() => {}`), so removing it has no functional impact.

### `PublishedStyleFeed` (`src/features/customer/PublishedStyleFeed.tsx`)

- Accept `searchQuery: string` prop.
- Pass it through to `StyleWaterfallGridClient`.

### `StyleWaterfallGridClient` (`src/features/customer/StyleWaterfallGridClient.tsx`)

- Accept `searchQuery: string` prop (replacing internal `useState`).
- Remove internal `searchQuery` state and the search bar JSX block (`<div className="feed-search">…</div>`).
- All existing filtering logic that uses `searchQuery` stays unchanged.

## State Flow

```
CustomerHomePage (server)
  └── <CustomerHomeClient />  (client)
        searchQuery (useState)
        ├── <search bar input>                                         ← new inline input
        ├── <TrendingStylesPanel />                                    ← no search coupling
        └── <PublishedStyleFeed searchQuery={searchQuery} />
              └── <StyleWaterfallGridClient searchQuery={searchQuery} />
```

## Accessibility

- The collapsible header uses `aria-expanded` and `aria-controls` on the clickable element.
- The chevron is `aria-hidden="true"`.

## i18n

No new i18n keys needed. The search bar reuses the existing `feed.searchPlaceholder` key already used in `StyleWaterfallGridClient`.

## Out of Scope

- Persisting collapsed state across sessions.
- Re-wiring the Refresh button (currently a no-op; removed in this change).
- English-language page sync (CLAUDE.md requires both zh and en pages to be updated if a corresponding en page exists — the home page is a single shared route, so no separate en file to update).
