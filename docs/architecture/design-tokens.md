# Design Tokens — Nailed-it

Date: 2026-05-26
Owner: Melissa (final say) · Claude (audit)

Single source of truth for color, spacing, radius, type, motion. Anything in `globals.css` should match the values declared here.

Drift = bug. Catch in code review.

---

## Current state — audit of `globals.css` as of 2026-05-26

### Color tokens (declared ✓)

Already tokenized in `:root`:

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#fff8f7` | Page background. Warm white. |
| `--color-surface` | `rgba(255,255,255,0.88)` | Card surface. Translucent over bg. |
| `--color-surface-strong` | `#ffffff` | Solid card. |
| `--color-border` | `rgba(46,31,43,0.08)` | Hairline borders. |
| `--color-text` | `#24181f` | Body text. |
| `--color-muted` | `#6c5a65` | Secondary text. |
| `--color-accent` | `#ec5d7b` | Primary action / brand. Rose. |
| `--color-accent-strong` | `#c73963` | Strong accent / pressed state. |
| `--color-accent-soft` | `#ffe4eb` | Soft accent / chip selected bg. |
| `--color-overlay` | `rgba(34,25,28,0.26)` | Modal scrim. |

**Contrast check (WCAG AA, 4.5:1 body):**

| Pair | Ratio | Pass? |
|---|---|---|
| `--color-text` on `--color-bg` | ~13.6 : 1 | ✓ pass |
| `--color-muted` on `--color-bg` | ~5.1 : 1 | ✓ pass body |
| `--color-accent` on `--color-bg` | ~3.7 : 1 | ✗ fails 4.5:1 body. Use only for large text or icons. |
| `--color-accent-strong` on `--color-bg` | ~5.6 : 1 | ✓ pass |
| `--color-accent-soft` on `--color-accent-strong` | ~4.9 : 1 | ✓ pass |
| White on `--color-accent` | ~3.0 : 1 | ✓ pass large only — primary button text must be `font-weight ≥ 600 font-size ≥ 14px` |

**Action items from color audit:**
- Body copy in `--color-accent` is forbidden. Verify no source uses it for prose.
- Primary button white text already at weight 700 in `.button` — passes large-text threshold.
- Add `--color-success` (green) + `--color-warning` (amber) + `--color-danger` (deeper than accent). Currently missing → confirm/cancel states reuse accent which is brand-ambiguous.

**Recommend adding:**
```css
--color-success: #2e8b6c;
--color-warning: #d97706;
--color-danger:  #b91c1c;
```

### Spacing — NOT tokenized (drift)

Audit of `globals.css` found these distinct rem values used as `padding` / `gap`:

```
0.2 0.25 0.45 0.55 0.65 0.75 0.85 0.9 0.95 1 1.25 1.5 2
```

13 distinct values for spacing → drift. Should collapse to a scale.

**Proposed 4pt scale** (1rem = 16px):

| Token | rem | px | Use |
|---|---|---|---|
| `--space-1` | `0.25rem` | 4 | Tightest gap (icon ↔ label inside chip) |
| `--space-2` | `0.5rem` | 8 | Small gap, padding compact button |
| `--space-3` | `0.75rem` | 12 | Default gap |
| `--space-4` | `1rem` | 16 | Card padding, section gap |
| `--space-5` | `1.5rem` | 24 | Section vertical rhythm |
| `--space-6` | `2rem` | 32 | Page top/bottom |
| `--space-7` | `3rem` | 48 | Hero spacing |

Anything not on this scale → drift. Lint rule to flag.

### Radius — partially drifted

Spec says "8px radius or less unless component needs a different convention". Current usage:

| Found | Where | Verdict |
|---|---|---|
| `0.5rem` (8px) | most cards, buttons | ✓ spec-compliant |
| `0.75rem` (12px) | top bar variant | ✗ drift |
| `1.25rem` (20px) | bottom sheet top | ✓ exception per spec (different convention) |
| `999px` | chips, avatar | ✓ exception (pill shape) |

**Proposed radius tokens:**

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `0.25rem` (4px) | Tags, micro-controls |
| `--radius-md` | `0.5rem` (8px) | **Default** — cards, buttons, inputs |
| `--radius-lg` | `1.25rem` (20px) | Bottom sheet, modal, hero cards |
| `--radius-pill` | `999px` | Chip, avatar |

Convert `0.75rem` instance to `--radius-md` (collapse drift).

### Type scale — NOT tokenized (drift)

Font sizes found:
```
0.72 0.75 0.78 0.8 0.82 0.92 0.95 1 1.1 1.35 + clamp(2.2vw, 7vw, 3.4rem)
```

10+ distinct values → drift. Collapse to scale.

**Proposed type scale:**

| Token | Size | Line | Weight | Use |
|---|---|---|---|---|
| `--text-xs` | `0.75rem` (12px) | 1.4 | 600 | Eyebrow, micro labels |
| `--text-sm` | `0.875rem` (14px) | 1.45 | 500 | Body small, helper |
| `--text-base` | `1rem` (16px) | 1.5 | 500 | Body |
| `--text-md` | `1.125rem` (18px) | 1.4 | 600 | Card title |
| `--text-lg` | `1.375rem` (22px) | 1.3 | 700 | Page subtitle |
| `--text-xl` | `1.75rem` (28px) | 1.25 | 800 | Page title (mobile) |
| `--text-hero` | `clamp(2rem, 7vw, 3rem)` | 1.15 | 800 | Hero / landing |

Weights: only 500, 600, 700, 800. No 400 (looks weak on mobile). No 900 (too heavy).

### Shadows

Currently 1 token:

```css
--shadow-soft: 0 16px 40px rgba(74, 39, 55, 0.08);
```

**Propose adding:**

| Token | Value | Use |
|---|---|---|
| `--shadow-soft` | (existing) | Card resting |
| `--shadow-raised` | `0 8px 20px rgba(74,39,55,0.12)` | Card hover / lifted |
| `--shadow-overlay` | `0 24px 60px rgba(74,39,55,0.18)` | Bottom sheet, modal |

### Motion — UNDEFINED (gap)

No motion tokens in `globals.css`. All transitions currently use raw or default values → inconsistent feel.

**Propose:**

```css
--motion-fast:   120ms;  /* button press, hover */
--motion-base:   200ms;  /* card transitions, chip select */
--motion-slow:   320ms;  /* bottom sheet, page transition */
--motion-ease:   cubic-bezier(0.22, 0.61, 0.36, 1);  /* default ease */
--motion-ease-in: cubic-bezier(0.55, 0, 0.7, 0.2);
--motion-ease-out: cubic-bezier(0.16, 0.84, 0.44, 1);
```

Reduced motion override:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0ms;
    --motion-base: 0ms;
    --motion-slow: 0ms;
  }
}
```

### Layout constants (already tokenized ✓)

| Token | Value | Use |
|---|---|---|
| `--page-max-width` | `32rem` | Outer content cap |
| `--shell-max-width` | `26.875rem` | Mobile shell |
| `--top-bar-height` | `4.5rem` | TopBar fixed height |
| `--tab-bar-height` | `5.25rem` | BottomTabBar fixed height |

Keep. Document already-correct usage.

---

## Drift action plan (separate patches, prioritized)

| # | Action | Effort | RICE |
|---|---|---|---|
| 1 | Add `--space-*`, `--radius-*`, `--text-*`, `--motion-*` token block at top of `globals.css` | 1h | High |
| 2 | Add `--color-success`, `--color-warning`, `--color-danger` | 0.5h | High |
| 3 | Refactor existing rules to use new tokens (file-by-file, low-risk swaps) | 4–6h | Medium |
| 4 | Add Stylelint rule rejecting raw rem/px in `padding`, `gap`, `font-size`, `border-radius` | 1h | Medium |
| 5 | Document motion usage rules in [`motion-rules.md`](motion-rules.md) | (separate doc) | — |

Patches land one at a time. Each refactor patch must screenshot-diff before/after.

---

## Hard rules for any new CSS

- **No raw color hex outside this file.** Use `var(--color-*)`.
- **No raw rem/px outside this file for spacing, radius, type, motion.** Use tokens.
- **No `!important`** except inside print stylesheets.
- **No inline `style=` on JSX** for layout / color (Tailwind utility classes allowed if introduced in future).
- **Custom font-family is banned for v1** (system font stack only). Re-evaluate at launch.

Violations → reject in code review.

---

## Open questions

- Do we adopt Tailwind in v2 or stay with hand-rolled CSS? Affects token implementation.
- Dark mode: in scope or skip? Not in scope for v1 per current decision.
- Brand evolution: is `--color-accent` (rose `#ec5d7b`) final? Melissa to confirm before lint locks it.
