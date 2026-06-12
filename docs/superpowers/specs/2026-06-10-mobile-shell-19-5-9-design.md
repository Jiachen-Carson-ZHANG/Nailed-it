# Mobile Shell 19.5:9 Design

**Date:** 2026-06-10

## Goal

Make non-landing pages render as a phone-like 19.5:9 shell on desktop screens while keeping the landing page unchanged and preserving the current mobile behavior.

The implementation should use the existing `MobileLayout` shell and keep the patch as small as possible by concentrating changes in shared global styles.

## Confirmed Scope Decisions

The following decisions were confirmed during brainstorming and are fixed for implementation:

- Only desktop layouts should simulate a fixed 19.5:9 mobile viewport
- Mobile devices should keep the current full-height responsive behavior
- The landing page must not change
- The desktop shell should prioritize height-based fitting so the full phone frame stays visible
- Long page content should scroll inside the content area rather than stretching the full browser page
- The preferred solution is a shared shell-style update instead of route-level opt-in logic

## Problem Statement

### 1. The Current Shell Is Width-Limited But Not Ratio-Locked

The existing shared shell uses a fixed maximum width together with viewport-height sizing. This makes pages look narrow like a mobile screen, but the height continues to expand with the browser window. On large displays the result feels like a stretched web page rather than a stable phone viewport.

### 2. Content Height Is Coupled To The Browser Viewport

Because the shell itself grows with `100vh` / `100dvh`, long pages are not constrained to a fixed device canvas. The browser page becomes the scroll container, so the visual metaphor of a simulated phone breaks down.

### 3. Floating UI Is Anchored To Shell Width Assumptions

Shared floating elements such as the bottom tab bar and toast use the current shell width variable. If the shell becomes a true device canvas, those elements must continue to align with the same computed width and horizontal position.

## Architecture Approach

This change should stay inside the shared layout styling system instead of introducing new wrapper components or page-specific flags.

Implementation follows four rules:

- Reuse the existing `MobileLayout` structure and update styling behavior rather than changing JSX composition
- Apply the ratio-locking behavior only inside a desktop media query so mobile remains unchanged
- Make the shell the fixed-height device canvas and move scroll responsibility into `.mobile-content`
- Keep all shell-aligned floating surfaces driven by the same shared sizing variables

This approach keeps the patch focused, avoids route churn, and minimizes regression risk across the 18 routes that already consume `MobileLayout`.

## Detailed Design

### 1. Desktop-Only Device Canvas

Desktop screens should treat `.mobile-shell` as a simulated device frame rather than a general page container.

Target behavior:

- On desktop breakpoints, compute a shared shell height from the available viewport height
- Derive shell width from the confirmed `19.5:9` ratio
- Clamp the result so the shell fits within the desktop viewport without clipping
- Keep the shell centered horizontally
- Preserve the existing mobile behavior outside the desktop media query

Implementation principle:

- Introduce desktop-only CSS custom properties for shell height and shell width
- Width should be derived from height first to match the confirmed "fit by height" behavior
- Existing mobile variables can remain the fallback for smaller screens

### 2. Internal Content Scrolling

Once the shell is ratio-locked, the page itself should stop growing with content height. The scrollable region should move into the content area that sits between the top bar and the bottom tab bar.

Target behavior:

- `.mobile-shell` becomes a fixed-height grid container on desktop
- `.mobile-content` gets `overflow-y: auto` on desktop
- The top bar remains pinned at the top of the shell
- The bottom tab bar remains visually attached to the shell width
- Long pages scroll inside the shell without expanding the browser page

Implementation principle:

- Keep the current `grid-template-rows: auto minmax(0, 1fr) auto`
- Ensure the middle track can actually shrink with `min-height: 0`
- Avoid moving scroll to nested feature components unless a later bug proves it necessary

### 3. Shared Width Synchronization For Floating Elements

The shell width can no longer rely on the old fixed max width alone. Desktop floating elements that align to the shell must reference the same computed width.

Target behavior:

- `.bottom-tab-bar` uses the same desktop shell width as `.mobile-shell`
- `.toast` keeps its current inset behavior but respects the new shell width
- Existing mobile sizing remains unchanged

Implementation principle:

- Replace hard-coded width assumptions with the new shared shell-width variable where needed
- Keep one source of truth for shell width to avoid drift between the shell and fixed overlays

### 4. Landing Page Isolation

The landing page currently uses its own layout styles and should not inherit the simulated-device canvas behavior.

Target behavior:

- No landing page selectors or module styles change
- The desktop phone-shell behavior only affects routes that already use `MobileLayout`

Implementation principle:

- Scope the change to shared shell classes already used by non-landing routes
- Do not alter landing-specific layout variables or breakpoints

## Testing Strategy

### Functional Checks

- A desktop browser opening any non-landing page shows a visually stable 19.5:9 shell
- Increasing desktop monitor size no longer stretches the shell vertically
- Long non-landing pages scroll inside the content region
- The top bar remains visible and aligned
- The bottom tab bar remains aligned to the shell width
- Toast positioning still looks correct relative to the shell
- The landing page remains visually unchanged
- Mobile screens still use the current full-height responsive behavior

### Regression Checks

- Customer routes using `MobileLayout` still render and navigate normally
- Merchant routes using `MobileLayout` still render and navigate normally
- Fixed-position overlays continue to align with the centered shell
- Safe-area-related tab padding remains intact on mobile

## Risks And Guardrails

### Risk: Desktop Height Calculation Can Over-Constrain Short Windows

If the desktop shell height is too aggressive, shorter laptop windows may feel cramped or clip important UI.

Guardrail:

- Use clamped desktop shell sizing with viewport-aware limits
- Prefer "fit inside viewport" over preserving a larger nominal device size

### Risk: Internal Scroll Can Expose Hidden Overflow Bugs

Some pages may currently depend on document scrolling rather than content-region scrolling. Locking the shell can reveal components that need `min-height: 0` or overflow fixes.

Guardrail:

- Make `.mobile-content` the first and only new scroll owner
- Validate representative customer and merchant pages after the style change

### Risk: Width Drift Between Shell And Fixed Overlays

If the tab bar or toast keeps using old width assumptions, the shell and floating elements will visually misalign on desktop.

Guardrail:

- Route all shell-aligned widths through the same shared custom property

## Acceptance Criteria

This change is complete only when all of the following are true:

- Desktop non-landing pages render inside a simulated 19.5:9 mobile shell
- The shell size is driven by height-first fitting on desktop
- The landing page remains unchanged
- Mobile behavior remains unchanged
- Long page content scrolls inside `.mobile-content` instead of stretching the full browser page
- The bottom tab bar stays aligned with the shell
- Toast width and placement remain visually aligned with the shell
- The shared solution is implemented without route-by-route JSX changes
