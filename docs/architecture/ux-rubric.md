# UX Rubric — Nailed-it

Date: 2026-05-26
Owner: Carson (final say) · Claude (drafts) · Melissa (visual consult)

Central DoD for every UX/UI patch. If a patch can't tick the boxes that apply, it doesn't ship.

Companion docs:
- [`personas.md`](personas.md) — who we serve
- [`content-style.md`](content-style.md) — voice/tone/banned words
- [`design-tokens.md`](design-tokens.md) — colors/spacing/type
- [`edge-cases.md`](edge-cases.md) — required states per page
- [`event-taxonomy.md`](event-taxonomy.md) — analytics events
- [`audit-exit-criteria.md`](audit-exit-criteria.md) — when audits end

---

## Part 1 — Patch Definition of Done

A patch is **not done** until ALL applicable boxes are ticked.

### Mandatory for every patch

- [ ] **Persona served.** Patch names which persona (Yuki / Mira / Linlin / Auntie Wang). If none, patch is rejected as feature creep.
- [ ] **JTBD advanced.** Patch cites which job-to-be-done from [personas.md](personas.md) is moved forward.
- [ ] **Claim type declared.**
  - **Compliance** (binary): pass/fail criterion, no baseline needed.
  - **Delta** (lift): requires baseline (see Part 4).
- [ ] **Source lens cited.** Spec / Nielsen # / persona JTBD / trust signal / competitor pattern.
- [ ] **Tests updated** if logic changed. All tests green.
- [ ] **Banned-word lint passes.** See [content-style.md](content-style.md).
- [ ] **Patch logged** in PATCHES.md with frozen ID + Before/After screenshot for visual changes.

### Mandatory if patch touches a button / interactive element

- [ ] **Tap target ≥ 44 × 44 px** (Apple HIG). Measure in DevTools.
- [ ] **Disabled state has helper text** explaining how to enable. Never a dead button.
- [ ] **Focus indicator visible** on keyboard navigation (WCAG AA partial).
- [ ] **Press feedback** within 100ms (visual change on `:active`).

### Mandatory if patch touches text

- [ ] **Contrast ≥ 4.5:1** for body text, ≥ 3:1 for large text (≥ 18pt or 14pt bold). Use WebAIM contrast checker against [design-tokens.md](design-tokens.md).
- [ ] **Sentence ≤ 14 words** per [content-style.md](content-style.md) cap.
- [ ] **2-second comprehension test.** Read aloud to non-team person. They understand in 2 sec or rewrite.
- [ ] **No engineering terms.** See banned list in [content-style.md](content-style.md).

### Mandatory if patch touches layout

- [ ] **No horizontal scroll at 360px viewport width** (Android low-end baseline).
- [ ] **Tested at 390px** (iPhone 13) — primary target.
- [ ] **Fixed bars don't cover content** (bottom nav, top bar, fixed CTAs).
- [ ] **Safe areas respected** on iOS notch (env-padding or equivalent).

### Mandatory if patch touches a flow (multi-screen path)

- [ ] **Back path works** at every step. No dead ends.
- [ ] **Progress visible** if flow > 3 steps (breadcrumb / step indicator / page title clarity).
- [ ] **State preserved** if user backs out mid-flow and returns.
- [ ] **Loading state** if any step has perceived wait > 200ms.
- [ ] **Empty state** has next-step CTA, not just "no data".
- [ ] **Error state** has recovery action ("Retry", "Use sample", "Contact us").

### Mandatory if patch touches a CTA or conversion point

- [ ] **Primary CTA exists** on the screen (Yuki should know the next tap).
- [ ] **Price visible** on every screen leading to commit (Linlin trust requirement).
- [ ] **Trust signal nearby** if commit involves payment or commitment (review count, photos, cancellation policy, technician credential).

### Mandatory if patch claims visual change

- [ ] **Lark async review thread** opened, @melissa tagged, 48h response window.
- [ ] **Before/after screenshots** at 390px in PATCHES.md entry.

### Mandatory if patch claims flow change

- [ ] **Explicit @carson approval** in thread before merge. No auto-approve.

---

## Part 2 — Accessibility scope

Locked decision (see `decisions/`): **WCAG AA partial**.

**In scope:**
- Color contrast (4.5:1 body, 3:1 large).
- Tap targets (44 × 44px).
- Alt text on all `<img>` and decorative icons (`alt=""` if decorative).
- Form labels (`<label>` or `aria-label` on every input).
- Focus indicator visible on interactive elements.
- No info conveyed by color alone (icon + color, not color alone).
- Reduced motion respected (`prefers-reduced-motion`).

**Out of scope for v1:**
- Full keyboard navigation (mobile-first app).
- Screen reader optimization beyond labels (defer).
- 200% zoom support (mobile only — defer until web responsive).

Re-evaluate at v1 launch.

---

## Part 3 — Performance budget

Locked targets per page:

| Metric | Target | Where to measure |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s on mid-tier Android 4G | Lighthouse mobile |
| FID / INP | ≤ 200ms | Lighthouse / RUM |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | Lighthouse |
| Total JS payload | ≤ 200KB gzipped initial route | `next build` output |
| Image cap | ≤ 200KB per image at 2x device pixel ratio | manual check |
| Custom font | None loaded (system stack only) | check `globals.css` |

Patch fails budget → defer until trimmed.

---

## Part 4 — Baseline requirement (when patch claims delta)

Compliance patches: skip this section.

Delta patches (e.g. "faster booking", "clearer copy increases comprehension") require baseline.

**Cheapest valid baseline:**
1. Pick 3 humans outside team.
2. Give each task: "Book a nail set you like, then change the time." Don't speak.
3. Screen-record at 390px viewport on real phone.
4. Log: time-on-task, tap count, confusion points (where eye darts), verbatim utterances ("what does this mean?").
5. Write `docs/baselines/YYYY-MM-DD-{patch-id}.md` with: persona-equivalent of testers, raw timings, top 3 confusion quotes.

**After patch ships:** re-test with 3 different humans, compare delta.

**Sample size limits:** 3 is enough to falsify, not enough to prove. Treat lift > 30% as signal; < 30% as noise unless n ≥ 5.

---

## Part 5 — Five-lens audit (used in Phase 2, not per-patch)

These run during audit sweeps, populate BACKLOG.md. Per-patch checklist (Part 1) is downstream of these.

### Lens A — Spec compliance

Walk every page against:
- [`docs/superpowers/specs/2026-05-23-nailed-it-frontend-design.md`](../superpowers/specs/2026-05-23-nailed-it-frontend-design.md) § Visual Direction, § Error and Empty States, § Customer/Merchant Workflow.
- [`personas.md`](personas.md) JTBDs.
- [`design-tokens.md`](design-tokens.md) declared values.

Flag every drift.

### Lens B — Nielsen 10, mobile-tuned

Per screen, score each 1–5:

1. **Visibility of system status** — loading, success, error visible?
2. **Match real world** — no jargon (Yuki's vocabulary, not engineer's).
3. **User control** — back / undo / exit reachable?
4. **Consistency** — same word, same icon, same meaning across screens?
5. **Error prevention** — disabled CTA when invalid? confirm before destructive?
6. **Recognition over recall** — user doesn't memorize from prior screen?
7. **Flexibility** — shortcut for repeat users (Mira's "repeat last booking")?
8. **Aesthetic & minimalist** — no info noise?
9. **Help recover from error** — error → next-step guidance, not blame?
10. **Help & documentation** — privacy, terms, support reachable in ≤ 2 taps?

Score < 3 on any item → finding logged.

### Lens C — Persona walkthrough

For each customer persona (Yuki priority):
- Land → role pick → discovery → upload → quote → confirm.
- Time each step. Compare to targets (Part 6).
- Tap-count vs target.
- Note every "what does this do?" moment.

For Auntie Wang:
- Open app → today's bookings → block a slot → add walk-in → save.
- Compare to merchant targets (Part 6).

### Lens D — Trust signals

Per screen leading to commit, check:
- Reviews / ratings visible?
- Technician credential visible (license, years experience)?
- Photos of past work visible?
- Cancellation / reschedule policy visible?
- Payment safety language visible at commit?

Each missing where it should be → finding.

### Lens E — Competitor delta

From [`competitor-teardown.md`](competitor-teardown.md), "Steal" list:

For each "Steal P0/P1" pattern → check if present on relevant Nailed-it screen. If absent → finding.

---

## Part 6 — Measurable flow targets

Customer booking:
- **Time-to-first-quote** ≤ 30 sec from landing.
- **Taps-to-quote** ≤ 5.
- **Taps-to-confirm** ≤ 8.
- **Comprehension** ≥ 4/5 testers describe each screen unprompted.
- **Drop-off** < 20% per step (post-launch metric).
- **Error recovery present** — every dead end has back/edit/restart.

Merchant calendar:
- **Today-visible in ≤ 2 sec** from app open.
- **Edit-pricing roundtrip** ≤ 4 taps.
- **No data loss** on accidental tab switch.

Targets pre-measurement: best-effort. Targets post-instrument: enforced.

---

## Part 7 — Prioritization (RICE)

Every BACKLOG row gets:

| Factor | 0–10 scale | Notes |
|---|---|---|
| Reach | how many users hit it per visit | Yuki + Mira + Linlin homepage = 10; merchant-only = 3 |
| Impact | how much does it move the JTBD | dead-end = 10; minor copy = 2 |
| Confidence | how sure are we (0–1.0) | persona + heuristic + competitor pattern aligned = 0.9; lone guess = 0.3 |
| Effort | dev hours | 1 = trivial; 10 = multi-day |

**RICE score = (Reach × Impact × Confidence) / Effort**

Sort BACKLOG descending. Ship top-N first.

---

## Part 8 — Retro loop

After every shipped batch (≥ 5 patches):

- 30-min retro doc in `docs/changes/retro-YYYY-MM-DD.md`.
- For each shipped patch: did the RICE score predict the win?
- Kill patterns that didn't move metrics (or kill the metric if measurement is wrong).
- Update this rubric if a check turned out useless or a missing check let a bad patch ship.

This file is not frozen. Iterate it.
