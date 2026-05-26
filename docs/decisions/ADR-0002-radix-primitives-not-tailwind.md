# ADR 0002: Adopt Radix Primitives, defer Tailwind / shadcn

**Status:** Accepted
**Date:** 2026-05-26

## Context

Phase 2 UX audit (`docs/changes/audit-2026-05-26.md`) surfaced multiple findings that benefit from accessible, headless primitives: tooltips for AI confidence labels (UI-E16), modal dialogs for cancellation policy and status changes, dropdown menus for booking status (UI-E21), bottom sheets for filter chips (UI-E22), tabs for booking lifecycle. Hand-rolling each, with focus trap + ARIA + keyboard + reduced-motion correctness, would absorb meaningful time and ship subtle bugs.

shadcn/ui is the de-facto 2024+ React primitives library, but it ships components written in Tailwind utility CSS. Current Nailed-it repo uses semantic CSS in `src/app/globals.css` (~1100 lines, already tokenized via CSS variables for color / spacing / radius / type / motion via `design-tokens.md`). Adopting Tailwind would mean migrating every existing `className` and changing the styling contract project-wide. That cost is not justified at the competition stage.

Radix Primitives — the headless layer that shadcn/ui sits on top of — works without Tailwind. Each primitive ships unstyled markup + behavior. Styling happens via CSS classes consumed by `data-state` attributes and stable class hooks.

## Decision

Adopt **`@radix-ui/react-*`** as the headless component layer. Style with the existing semantic CSS in `globals.css`, reading CSS-variable tokens.

Initial install (2026-05-26):

- `@radix-ui/react-dialog`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-tabs`
- `@radix-ui/react-toast`
- `@radix-ui/react-checkbox`
- `vaul` (mobile drag-to-dismiss bottom sheet; sibling library, no Tailwind dep)

Wrappers live in `src/components/ui/`. Each wrapper is thin (≤ ~30 lines) — Radix Root/Trigger/Content composition + project-specific defaults (delay, side, ARIA labels). Class hooks defined in `globals.css` follow naming convention `.{primitive}-{part}` (e.g. `.dialog-overlay`, `.tooltip-content`).

**Out of scope:** Tailwind, shadcn/ui, CSS-in-JS frameworks (styled-components, emotion).

## Design principles

- **Headless > opinionated.** Behavior, accessibility, and ARIA are hard; visual design is project-specific. Buy the hard part, keep the easy part editable.
- **Semantic CSS already works.** ~1100 lines of `globals.css` are tokenized, contrast-audited, mobile-tuned. Refactoring it to Tailwind buys little for a competition shipping window.
- **Tokens stay in CSS variables.** Radix consumes them through the same class hooks the rest of the app uses. No two sources of truth.
- **Accessibility from primitives, not from hand-rolled markup.** Cuts WCAG AA partial work (see `docs/architecture/ux-rubric.md` § Part 2) for focus management, key handling, ARIA wiring.
- **Thin wrappers only.** Future devs reading `Dialog.tsx` see `RD.Root → RD.Portal → RD.Overlay → RD.Content`, not abstraction layers. Radix API is the contract.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **shadcn/ui + Tailwind** | Requires migrating all `className` in repo from semantic to utility CSS. Estimated 6–10h of grunt rewrite, plus every future patch styles in utilities. Wrong tradeoff before competition ship. |
| **Headless UI (Tailwind Labs)** | Tied to Tailwind in practice; fewer primitives than Radix; smaller community. |
| **Reach UI** | Effectively merged into Radix; deprecated. |
| **Mantine / Chakra** | Opinionated visual design conflicts with already-tokenized aesthetic. Heavier bundle. |
| **Hand-roll every primitive** | Reproduces well-solved accessibility bugs. Time sink. |
| **Defer all primitives until post-competition** | UI-E16, UI-E21, UI-E22 audit findings need Tooltip / DropdownMenu / BottomSheet to implement properly. Without primitives those patches ship with worse accessibility. |

## Consequences

**Positive**

- Tooltip, Dialog, DropdownMenu, Tabs, Toast, Checkbox available immediately for audit patches.
- Accessibility done correctly (focus trap, escape-to-close, ARIA roles, reduced-motion override).
- vaul provides a mobile bottom-sheet matching `edge-cases.md` requirements without bespoke gesture code.
- CSS architecture unchanged — no class rewrites in existing pages.
- Token system (`design-tokens.md`) keeps working; primitives consume the same `var(--color-*)` / `var(--motion-*)` variables.
- ~40KB gzipped bundle add (estimate), within `ux-rubric.md` § Part 3 budget (JS ≤ 200KB initial).

**Negative**

- Lose shadcn/ui's polished default styling. We rebuild the visual layer for each primitive in `globals.css`.
- Two component-library APIs in `src/components/ui/`: legacy semantic (`Button`, `EmptyState`, `BottomSheet`) and Radix-wrapped (`Dialog`, `Tooltip`). Future patches should migrate legacy → Radix where Radix has a primitive (e.g. existing `BottomSheet` → vaul).
- If Tailwind adoption becomes desirable post-competition, we still have a migration ahead. ADR-0002 should be revisited at that point.
- Node engine warning: Radix packages require Node 20+; repo currently runs Node 18.19.1. Node bump is on the upgrade list but not blocking install or runtime today.

## Migration plan (informational, not part of this decision)

1. **Now:** Tooltip + Dialog wrappers + CSS hooks landed.
2. **Batch 1 patches** (UI-E8 → UI-E12): no primitive dependency, ship as-is.
3. **UI-E16 (style detail labels):** wrap "AI confidence" + "Popularity" in Tooltip.
4. **UI-E21 (status chips):** convert to DropdownMenu if interactive, or static badges if labels.
5. **UI-E22 (filter chips → bottom sheet):** vaul drawer.
6. **Existing `BottomSheet.tsx`:** replace with vaul-backed wrapper. Drop manual scrim management.
7. **Existing `Toast.tsx`:** replace with Radix Toast (auto-dismiss, swipe, queue).

## References

- Audit findings driving need: [docs/changes/audit-2026-05-26.md](../changes/audit-2026-05-26.md)
- Design tokens: [docs/architecture/design-tokens.md](../architecture/design-tokens.md)
- Accessibility scope: [docs/architecture/ux-rubric.md](../architecture/ux-rubric.md) § Part 2
- Radix Primitives: https://www.radix-ui.com/primitives
- vaul: https://vaul.emilkowal.ski/
