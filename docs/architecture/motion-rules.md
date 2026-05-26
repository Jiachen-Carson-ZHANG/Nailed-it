# Motion Rules — Nailed-it

Date: 2026-05-26
Owner: Melissa (visual final say) · Claude (drafts)

Companion to [`design-tokens.md`](design-tokens.md). Defines **when** to animate, **how long**, **what easing**, and **what to never animate**.

Goal: native-feeling, calm, predictable. Motion is feedback, not entertainment.

---

## Principles

1. **Motion exists to communicate state change.** Not for decoration.
2. **Predictable beats novel.** Same action, same animation, every time.
3. **Fast > pretty.** If user perceives wait, motion is failing.
4. **Honor `prefers-reduced-motion`.** Always. No exceptions.

---

## Motion tokens (from design-tokens.md)

| Token | Duration | Use |
|---|---|---|
| `--motion-fast` | 120ms | Button press, hover, chip tap |
| `--motion-base` | 200ms | Card lift, chip select state, focus ring |
| `--motion-slow` | 320ms | Bottom sheet open, page transition, modal |

Easing:

| Token | Curve | Use |
|---|---|---|
| `--motion-ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Default — most transitions |
| `--motion-ease-in` | `cubic-bezier(0.55, 0, 0.7, 0.2)` | Exits — element leaving screen |
| `--motion-ease-out` | `cubic-bezier(0.16, 0.84, 0.44, 1)` | Entries — element arriving |

---

## Animation catalog

### Button press

- **Trigger:** `:active` or `aria-pressed="true"`.
- **Properties:** `transform: scale(0.98)`, `opacity: 0.92`.
- **Duration:** `--motion-fast`.
- **Easing:** `--motion-ease`.

```css
.button:active {
  transform: scale(0.98);
  opacity: 0.92;
  transition: transform var(--motion-fast) var(--motion-ease),
              opacity var(--motion-fast) var(--motion-ease);
}
```

### Chip select

- **Trigger:** chip becomes selected.
- **Properties:** `background-color`, `color`.
- **Duration:** `--motion-base`.
- **Easing:** `--motion-ease`.

### Card tap

- **Trigger:** card tapped on touch device.
- **Properties:** `transform: scale(0.98)`, `box-shadow` lift.
- **Duration:** `--motion-fast`.
- **No hover state** — mobile only. (Hover on touch device causes sticky state bugs.)

### Bottom sheet open

- **Trigger:** sheet opens.
- **Properties:** `transform: translateY(100% → 0)`, `opacity: 0 → 1` on scrim.
- **Duration:** `--motion-slow`.
- **Easing:** `--motion-ease-out`.
- **Reverse:** same duration, `--motion-ease-in`.

### Bottom sheet close

- **Trigger:** scrim tap, swipe down, X tap.
- **Mirror of open.**
- **Swipe-down threshold:** > 30% sheet height OR > 500 px/sec velocity → close, else snap back.

### Toast in / out

- **In:** slide from bottom + fade in, `--motion-base`, `--motion-ease-out`.
- **Out:** fade only, `--motion-fast`, `--motion-ease-in`.
- **Position:** bottom, above bottom tab bar.

### Page transition (route change)

- **Trigger:** any client-side route push.
- **Properties:** `opacity` fade only (no slide for v1 — slides feel laggy on mid-Android).
- **Duration:** `--motion-fast` out, `--motion-base` in.
- **No transition on browser back/forward** — keep native behavior.

### Skeleton shimmer

- **Trigger:** loading state.
- **Properties:** gradient background sweep.
- **Duration:** 1200ms loop, linear.
- **Stops** the instant data arrives. Hard cut, no fade — fading skeletons confuse "is this still loading?"

### Focus ring (keyboard)

- **Trigger:** `:focus-visible`.
- **Properties:** `box-shadow: 0 0 0 3px rgba(236, 93, 123, 0.4)`.
- **Duration:** `--motion-fast` fade in.
- **Never animate `outline`** — `box-shadow` is hardware-accelerated; outline is not.

### Status change (e.g. booking confirmed)

- **Properties:** background color shift on the row + icon scale punch (1.0 → 1.15 → 1.0).
- **Duration:** `--motion-base`.
- **One-shot, not loop.**

### Error shake (form validation)

- **Trigger:** invalid submit attempt.
- **Properties:** `transform: translateX(-8px → 8px → -4px → 4px → 0)`.
- **Duration:** `--motion-slow` total.
- **Use sparingly** — only on hard validation fails, never on every keystroke.

---

## Banned animations

- **Parallax scroll.** Performance-bad on mid-Android, motion-sickness risk.
- **Auto-rotating hero carousels.** User control lost.
- **Bouncing CTAs.** Trying too hard.
- **Tilt-on-scroll cards.** Trendy 2 years ago, dated now.
- **Animated emoji.** Off-brand.
- **Page slide transitions.** See note above.
- **Infinite spin loaders > 2 seconds.** If wait is real, switch to skeleton + progress hint, not endless spinner.

---

## `prefers-reduced-motion` override

Hard rule: when the OS reports reduced motion, all decorative animation duration → 0ms. State-change animations keep their *visual* end-state (background color, position) but reach it instantly.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Test:
- iOS: Settings → Accessibility → Motion → Reduce Motion.
- Android: Settings → Accessibility → Remove animations.
- DevTools: Rendering pane → Emulate CSS media feature → prefers-reduced-motion.

---

## Performance budget

- **All animations on `transform` or `opacity` only.** Anything else (width, height, top, left) triggers layout thrash on mid-Android.
- **Use `will-change` sparingly** — only on elements that are actively animating, removed after.
- **No JS-driven animation loops.** Use CSS transitions or Web Animations API.
- **Frame budget:** must stay 60fps on mid-tier Android. Measure with Chrome DevTools Performance tab.

If an animation drops frames → cut it.

---

## Open questions

- Bottom sheet swipe-to-close: ship in v1 or v2? Adds gesture complexity.
- Haptic feedback on confirm: defer (web vibration API patchy on iOS).
- Confetti on first successful booking: tempting, off-brand for v1 (calm > celebration). Defer.
