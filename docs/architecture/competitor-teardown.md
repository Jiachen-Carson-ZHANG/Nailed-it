# Competitor Teardown — Nail Booking Apps

Date: 2026-05-26
Owner: Carson + Claude
Status: **draft from product knowledge — needs verification with real app screenshots before locking patterns**.

Three apps reverse-engineered. Goal: steal proven patterns, identify our differentiation gap.

---

## How to read this doc

For each competitor, scored against the journey our app cares about:

**Discovery → Quote → Time-select → Confirm → Post-book**

Each step rated:
- **What they do** — observed pattern.
- **Why it works (or doesn't)** — design rationale.
- **Steal / skip / improve** — verdict for Nailed-it.

---

## C1 — 美团 (Meituan) beauty/nail vertical

**Why study:** market leader, sets user expectation for booking flow in China. Our 美团 competition entry will be judged against their existing UX.

### Discovery
- **What:** category cards on home → "美甲" tile → list view of salons in radius, sortable by distance / rating / price. Salon card shows hero photo, name, rating, review count, distance, price range.
- **Why works:** maps onto user mental model (pick salon first, then style). Low cognitive load.
- **Our gap:** we discover by **style first**, salon second. Different model. Bet: style-first wins for Yuki persona who already has a Xiaohongshu screenshot. Loses for Mira persona who wants "my usual salon".
- **Verdict:** **keep style-first as differentiation**, but offer "near me" salon list as secondary entry point.

### Quote
- **What:** quotes come from menu items in each salon listing. User reads menu, picks "Gel 单色", sees ¥158. No personalized quote.
- **Why doesn't work:** generic price doesn't account for length, extensions, art complexity. User often pays more in-chair.
- **Our gap:** we do personalized quote from photo. **Major differentiation**. Lean into it.
- **Verdict:** **defend the AI quote as core moat**. Show it within 30s or kill the moat.

### Time-select
- **What:** time slots shown as horizontal scrollable strip per day, 30-min increments. Greyed if booked. Selecting slot opens confirm sheet.
- **Why works:** dense, scannable, mobile-native.
- **Verdict:** **steal pattern directly**. Current Nailed-it slot UI is comparable.

### Confirm
- **What:** confirm sheet shows: service, price, time, salon address, "立即预约" button. Sometimes asks for deposit (¥20–50).
- **Why works:** all info on one screen, no scroll, single button.
- **Our gap:** we don't charge deposit. Cancel-no-show risk for merchant.
- **Verdict:** **defer deposit for v1**. Add after merchant retention data.

### Post-book
- **What:** confirmation page + push notification + WeChat mini-program message + SMS T-1h before slot.
- **Why works:** redundancy across channels Chinese users actually check.
- **Our gap:** we have nothing.
- **Verdict:** **must build pre-launch**. P1 backlog.

### Trust signals
- Review count, photos, "实拍" (real-shot) badge, "回头客X%" (return-customer %).
- **Steal:** review count + photos. Return-customer % requires data we don't have yet.

---

## C2 — 河狸家 (Helijia) — mobile-tech beauty marketplace

**Why study:** technician-first model (book Mei Chen, not "Salon X"). Closer to our merchant persona (independent operator).

### Discovery
- **What:** Top-level filter: "技师" (technician) vs "门店" (shop). Technician profile front and center: photo, name, years experience, specialty tags, follower count, recent works gallery.
- **Why works:** humanizes service. Trust transfers from individual, not brand.
- **Verdict:** **steal for v2**. Currently we surface salons + AI. Adding technician profile increases trust for Mira persona (relationship-driven).

### Quote
- **What:** flat menu pricing per technician.
- **Verdict:** weaker than our AI quote. Skip.

### Time-select
- **What:** calendar grid per technician, weekly view. Less mobile-friendly than 美团's strip.
- **Verdict:** skip.

### Confirm
- Standard. Steal nothing.

### Post-book
- **What:** technician sends WeChat confirmation 30 min after booking. Manual touch.
- **Why works:** feels personal, builds rapport.
- **Verdict:** **steal — but automate**. Trigger a templated message from technician's pre-written templates.

### Trust signals
- Portfolio gallery per technician (most powerful).
- Certification badges (manicurist license, hours trained).
- **Steal both**. Major gap in current Nailed-it.

---

## C3 — 小红书 (Xiaohongshu) — discovery-only, not booking

**Why study:** this is where Yuki persona discovers styles. We are not competing — we are downstream. Goal: understand the upstream so we can capture intent.

### Discovery
- **What:** infinite-scroll waterfall of nail posts. Each post = photo + caption + comments. Tap → full-screen viewer, swipe up for more posts.
- **Why works:** zero friction. Pure visual scroll. Algorithm tuned.
- **Verdict:** our `StyleWaterfallGrid` borrows the model. **Currently too short**: only ~6 styles. Needs more, plus infinite scroll, plus tap → detail with similar styles.

### Bridge to booking
- **What:** Xiaohongshu doesn't book. User screenshots → opens 美团 → searches.
- **Our gap:** **this is the gap we exploit**. User comes to us with a screenshot. We must accept screenshot-as-input within the first screen.
- **Verdict:** **homepage CTA "Upload a style you saw on Xiaohongshu" → straight to upload**. Already partially built (UI-F1). Strengthen with Xiaohongshu-aware copy.

### Trust signals
- Likes, saves, comments — social proof, not transactional.
- **Skip** — our trust model is transactional (will you show up, will price be fair).

---

## Cross-cutting patterns to steal (priority order)

| Priority | Pattern | Source | Maps to |
|---|---|---|---|
| **P0** | Show price visibly at every step | 美团 | Yuki, Linlin |
| **P0** | "Upload from Xiaohongshu" first-screen CTA | XHS bridge | Yuki |
| **P1** | T-1h SMS/push reminder | 美团 | Mira (no-show fear) |
| **P1** | Technician portfolio + license | 河狸家 | Linlin, Mira |
| **P1** | Reviews with photos | 美团 | Linlin |
| **P2** | "Repeat last booking" shortcut | Implied gap | Mira |
| **P2** | Style-similar suggestions after upload | XHS algo | Yuki |
| **P3** | Group-booking invite link | Implied gap | Linlin |

---

## Our differentiation — defendable claims

1. **Photo → personalized quote in < 30s**. No competitor does this with AI; closest is human-quote-via-WeChat (slow, opaque).
2. **Style-first discovery, not salon-first**. Matches Yuki mental model.
3. **Transparent estimate before commit**. Pricing rules surfaced rather than hidden.

**Things we must not lose to competitors:**

- 美团's slot UX density (we currently match).
- 河狸家's technician trust signals (we currently lack — gap).
- Xiaohongshu's visual scroll quality (we lack volume — gap).

---

## Verification TODO

This doc is drafted from product memory. Before locking any patterns:

- [ ] Capture 30 screenshots per app of the journey above (Carson runs on phone, Claude annotates).
- [ ] Time each journey end-to-end on real device. Compare to our targets.
- [ ] Mark any pattern I described that's wrong / outdated.
- [ ] Re-rank steal/skip table.

Until verified, **no Nailed-it patch may cite this doc as sole justification**. Use personas + heuristics + spec as primary; competitor doc as supporting.

---

## Open questions

- Do we attempt to mirror 美团's category-card entry as a secondary path, or commit fully to style-first?
- Technician portfolio: priority for v1 or v2? Affects merchant onboarding scope.
- Reminder channel: SMS, push, WeChat mini-program message, or all three?
