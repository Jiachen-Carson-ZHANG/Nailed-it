# Plan: Merchant insights as a data story (funnel-spine + 3 acts)

**Date:** 2026-06-08
**Status:** Approved (brainstorm aligned; build authorized)
**Relates to:** ADR-0006 (intelligence layer), `docs/plans/2026-06-07-merchant-intelligence-layer.md`

## Problem

The merchant insights surface (`/merchant/insights`) and the ops/report messages dump
numbers as siloed text lists. A merchant cannot see the **data story** — where customers
drop in the journey, what they want that we don't sell, which styles leak revenue, and what
to do about it. The analysis engine already finds the right beats; the **presentation** has
no spine, heavy redundancy, and over-claims precision at low volume.

## Decisions (aligned with the user)

- **Chart tech:** hand-rolled SVG/CSS. No charting dependency. Branded, ~0kb added.
- **Scope:** the in-app insights page first, full story. Daily/weekly message cards are a
  second pass that reuses the same chart components.
- **Bar:** story-first **but honest**. Counts primary, rates secondary and gated by sample
  size, explicit unit labels, no fake decimals. Extends ADR-0006 §5.

## Data-integrity finding (verified)

The funnel is the natural spine, but the seed cannot draw one. Verified current-week counts
from `generateSeedEvents` → `getMerchantInsights`:

| 曝光 | 点击 | 详情 | 试戴 | 预约 |
|---|---|---|---|---|
| **0** | 5 | 4 | **35** | 8 |

Zero `style_impression` events exist anywhere; try-ons (35) are 7× clicks (5). Per style
it's worse (鎏金奢华: `imp 0, clk 1, try 29, book 1`). The seed models **outcomes** (try-ons,
bookings, searches) for the four narrative beats but never the **top-of-funnel** that
precedes them. The beats are correct and stay; only the funnel is unbuildable as-is.

### Fix — additive top-funnel seed layer

Keep every existing event untouched (试戴/预约/搜索 narrative unchanged), and **add**
`style_impression` / `style_card_click` / `style_detail_view` events layered above each
try-on beat, monotonic and proportional per style:

- Styles with try-ons get a coherent upstream funnel, e.g. 鎏金奢华
  `imp ~120 → clk ~60 → detail ~35 → try 29 → book 1` (the cliff at booking = the price
  story, now visible). 极光法式碎钻 stays high-conversion all the way down.
- A light baseline of feed impressions for zero-try styles (browsing is represented).
- Deterministic; mostly current-week with ~2-week tail. Additive ⇒ existing
  `intelligence-seed.test.ts` narrative assertions still pass; add monotonicity assertions.

Funnel stages drawn: **曝光 → 点击 → 详情 → 试戴 → 预约**. 收藏 (save) is a side metric, not a
funnel stage (a user can try on without saving).

## Page redesign: one spine, three acts

1. **Headline** — one sentence + AI/规则 badge. Replaces the redundant AI摘要 prose.
   "本周 N 搜索 → N 预约，最大流失在 试戴→预约。"
2. **Spine — funnel hero** (`<FunnelChart>`): stepped bars from `snapshot`, step-to-step %,
   biggest-drop step flagged. Search + active-customers as context chips (search is a
   parallel entry, not a funnel stage).
3. **Act 1 — Demand** (`<TrendBars>` + `<GapBar>`): top-5 movers as paired 本期/上期 bars with
   delta; unit labeled "触达次数". Keep the demand-vs-supply gap bar (top 1–2 gaps).
4. **Act 2 — Conversion** (`<StyleConversionBars>`): styles ranked by try-on volume,
   conversion pill color-coded (green/amber/grey=样本不足), winner + leak callouts. Full
   11-row table kept as a collapsed drill-down.
5. **Act 3 — Action queue** (`<ActionCard>`): each rec = insight + evidence chip + deep-link
   CTA (复查鎏金定价 → editor; 上架暗黑款 → upload). Sourced from `highInterestLowConversion`
   + `catalogGaps`.

## Honest rules (codified in components)

- Counts primary; rates only when denominator ≥ threshold (reuse existing 样本不足).
- No decimals on tiny-N rates. Funnel tagged "样本较小" when stages are small.
- Funnel guard: if upstream < downstream (bad data), clamp display + warn, never draw an
  inverted funnel.

## Reusable components (hand-rolled)

`<FunnelChart>` · `<TrendBars>` · `<GapBar>` · `<StyleConversionBars>` · `<ActionCard>` ·
(`<Sparkline>` in pass 2). All consume the existing read-model types (`InsightsSnapshot`,
`DemandTrend`, `StylePerformance`, `CatalogGap`) — **no new domain compute for v1** beyond
the seed layer. Pass 2 (daily/weekly message cards) adds per-day event bucketing for
sparklines and reuses these components.

## Sequencing (avoids the in-flight collision)

`src/app/merchant/insights/page.tsx` is currently dirty/red from the concurrent
messaging/intel stream. Build order:

1. Seed fix + seed test (clean file). ← conflict-free
2. New chart components (new files). ← conflict-free
3. Swap the insights page to use them — **only once `insights/page.tsx` is committed/clean**.

## Out of scope (this pass)

Daily/weekly message report cards (pass 2), per-day sparklines, customer-intel panel
redesign, any tenant/cron/materialized rollups (still excluded per ADR-0006).
