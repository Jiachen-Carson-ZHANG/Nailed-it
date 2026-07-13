# Merchant Agent Team — Per-Agent Design Spec

**Date:** 2026-06-27
**Status:** Draft for review (working doc; not a GitHub deliverable)
**Implements:** ADR-0007. **Companion to:** `2026-06-27-merchant-agent-team.md` (phasing).
**Why this doc:** the Phase 1–3 agents are *thin* (each = one coarse read + a summarize). This spec
redesigns every agent around **fine-grained tools, structured outputs, and real reasoning loops**, and
works out the **trend/opportunity logic** that was previously hand-waved.

---

## 0. What was thin, and the fix

1. **Inputs were internal-only** — every agent read one `get_merchant_insights`. The blueprint's core
   (外部/平台热门 vs 我的款式) had no data. → add trend tools + a dedicated trend agent.
2. **Coarse tool → shallow loop** — one mega-read ⇒ one call ⇒ summarize (a wrapper, not an agent).
   → fine-grained tools so a step makes several targeted calls (richer reasoning + demo transcript).
3. **Free-text hand-offs** — 决策 parsed 数分's prose. → structured output schemas per agent.

---

## 1. The two analytical pillars (the fuzzy part, worked out)

The key realization: **"analyze my data" and "spot trends to act on" are different jobs.** Splitting
them makes each agent's logic tractable.

### 1a. 数分 (data-analyst) — customer-journey funnel, INTERNAL only

Source = tracked events (ADR-0006): `style_viewed`, `try_on_completed`, `favorite`, `booking_confirmed`,
`booking_completed`. Per **style** and per **customer**, compute the funnel:

```
exposure → try-on rate → favorite rate → booking rate (conversion) → completion
```

Outputs (all from computed numbers, never invented):
- **topConverters** — high booking-rate styles (amplify candidates).
- **highInterestLowConversion** — many try-ons/❤, few bookings (price-test candidates; e.g. seed 8284 金属感).
- **dead** — low exposure *and* low conversion over the window (delist candidates).
- **lapsedCustomers / highValueCustomers** — from per-customer booking recency + frequency + spend.
- **anomalies/alerts** — sudden drops/spikes vs the prior window.

This agent does **not** look outside the shop. It answers "what's happening to *my* styles and *my*
customers."

### 1b. 选品/趋势 (trend & opportunity) — the part you were fuzzy on

This is a **pipeline**, and each stage is a tool the agent calls in sequence:

```
(1) COLLECT       (2) DEDUP        (3) MATCH            (4) CLASSIFY        (5) SCORE → RANK
external trends → unify same    → map each trend     → bucket each       → opportunity score →
internal-rising   trend across    to my catalog        item into an         top-N to act,
platform-hot      sources         (tag/name overlap)   action bucket        bottom-N to prune
```

**(1) Collect** — three signal sources:
- **External** = `src/nail-ai/trending-styles.ts` (AI-generated hot styles from Pinterest/小红书/抖音,
  with `name`, `nameCn`, `tags`). Real, already in the repo, currently unused by agents.
- **Internal-rising** = tags/styles whose demand (views+try-ons) grew vs the prior window — derived
  from my own events (this is *trend*, distinct from 1a's *conversion*).
- **Platform-hot** = what's hot on 美团 itself. **Open question — no source yet** (mock list, or skip).

**(2) Dedup** — the same trend appears across sources ("镜面/chrome/金属感" on 3 platforms). Collapse to a
**canonical trend** with a combined `strength` = how many sources + how strong each. Dedup key =
normalized tag set (not raw names, which differ per platform/language).

**(3) Match to catalog** — for each canonical trend, is there a `merchant_style` that fits?
- *Matching method = open question.* v1 = **tag overlap** (Jaccard on the style's `discoveryFacets`
  vs the trend's `tags`); v2 = embedding similarity if we want fuzzy. Tag overlap is cheap + explainable
  → recommend v1 for the demo.
- Output per trend: `matchedStyleIds[]` (possibly empty).

**(4) Classify** — cross the trend-match with 数分's funnel verdict to bucket each item:

| Trend match | My funnel signal | → Action bucket | Agent |
|---|---|---|---|
| matched | high conversion | **Amplify** (invest ad) | 投广 |
| matched | high-interest / low-conversion | **Price-test** (团购券) | 团购 |
| matched | dead / declining | **Prune** (delist) | 运营 |
| **no match** | external demand strong | **Gap → propose 上架** (gated) | 运营 |

**(5) Score + rank** — one number so 决策 acts on the *best* opportunities, not all:
```
opportunityScore = demandStrength × catalogFit × commercialValue
  demandStrength  = normalized trend strength (sources + growth)   [0..1]
  catalogFit      = best tag-overlap of a matched style (0 if gap) [0..1]   (gap uses a fixed gapFit)
  commercialValue = margin/price proxy for the style or category   [0..1]
```
Rank desc → **top-N opportunities** feed 决策; **bottom-N** (dead, no demand) feed 运营 for delist.
*Scoring weights = open question* — start equal-weight, tune on the demo story.

**Output = `TrendReport{ opportunities: Ranked[], gaps: Gap[], prune: StyleId[] }`** — the precise menu
决策 chooses from.

> Worked example (seed anchors): external "金属感/chrome" strong + matches 8284, but 8284 is
> high-interest-low-conversion → **Price-test** bucket (团购券). External "暗黑" strong but **no catalog
> match** → **Gap → propose 上架** (gated). 8265 top converter + on-trend → **Amplify** (ad). Dead styles
> with no demand → **Prune**.

---

## 2. Roster (refined — split 数分 from 选品)

| Agent | Role | Status |
|---|---|---|
| 运营助手 orchestrator | lead | exists (deterministic) |
| **数分 insight** | analyst — journey funnel | re-scope (internal funnel only) |
| **选品 trend** | analyst — trend & opportunity | **NEW** (the pipeline above) |
| 决策 decision | planner | re-scope (acts on TrendReport + Briefing) |
| 投广 ad · 团购 coupon | operators | exist |
| 运营 catalog | operator (list/delist/propose) | exists |
| 用户运营 customer_ops | operator | exists |
| Monitor | reviewer | exists |

---

## 3. Per-agent specs

Each: **reads (tools) · loop · output · guardrail.**

### 运营助手 orchestrator
- **Loop:** deterministic Python (keep — demo-predictable). Sequences: 数分 ∥ 选品 → 决策 → operators → Monitor → re-baseline.
- **Output:** the round plan + run parenting. Not a model agent.

### 数分 insight (re-scoped)
- **Tools:** `get_funnel(range)`, `get_low_conversion()`, `get_dead_styles()`, `get_customer_segments()`.
- **Loop:** funnel → drill into low-conversion + dead + segments → assemble.
- **Output:** `Briefing{ topConverters[], lowConversion[], dead[], lapsedCustomers[], alerts[] }`.
- **Guardrail:** internal numbers only; "数据不足" when thin; no external trends here.

### 选品 trend (NEW)
- **Tools:** `get_external_trends()`, `get_internal_rising()`, `get_platform_hot()`, `match_to_catalog(trend)`, (scoring is in-agent reasoning over tool outputs).
- **Loop:** collect (3 calls) → dedup (reason) → match each (calls) → classify+score (reason) → rank.
- **Output:** `TrendReport{ opportunities[], gaps[], prune[] }`.
- **Guardrail:** dedup before counting; a gap requires a real no-match; never claim a style exists that doesn't.

### 决策 decision (re-scoped)
- **Tools:** `get_style_perf(styleId)` (spot-check only).
- **Loop:** read Briefing + TrendReport → pick the precise actions (which ad/budget, which coupon/price, which list/delist, which message) from the ranked menu.
- **Output:** `Decision{ actions: [{type, styleId|gapTag, params, reason}] }`.
- **Guardrail:** only choose from the ranked menu; every action cites a number.

### 投广 ad / 团购 coupon / 运营 catalog / 用户运营 customer_ops
- As today, but each **validates inputs** (already added) and emits a structured note. catalog keeps the **gated `propose_listing`**. customer_ops **must** call `send_customer_message` (hardened).

### Monitor
- **Tools:** `get_lift(styleIds, beforeWindow, afterWindow)`.
- **Loop:** read before/after → verdict.
- **Output:** `Verdict{ perStyleLift, narrative }`. **Guardrail: never invent %** — baseline + window when no data.

---

## 4. Shared tool catalog (fine-grained)

Read tools (TS endpoints behind the bus, grounded in ADR-0006):
`get_funnel`, `get_low_conversion`, `get_dead_styles`, `get_customer_segments`, `get_internal_rising`,
`get_external_trends`, `get_platform_hot`, `match_to_catalog`, `get_style_perf`, `get_lift`.

Action tools (write `agent_actions`, validated): `place_ad`, `set_group_buy_coupon`, `list_style`,
`delist_style`, `propose_listing` (gated), `send_customer_message`.

> Most read tools are thin wrappers over existing `src/domain/intelligence/*` — the brain already
> exists; we're exposing it at a finer grain + adding the trend-match piece.

---

## 5. Open questions (need your call)

1. **选品 split** — confirm 数分 and 选品 are *separate* agents (recommended), or fold trend into 数分.
2. **Matching method** — tag-overlap (cheap, explainable, recommend) vs embeddings (fuzzy, heavier).
3. **Platform-hot source** — mock list, reuse external-trends as the proxy, or skip platform-hot for now.
4. **Scoring weights** — equal-weight to start, or weight demand/fit/value differently for the demo story.
5. **External-trends call cost** — `trending-styles` is an AI call; cache per round (recommend) vs live each run.

---

## 6. Build order (once decisions land)

1. 数分 re-scope + its fine tools (foundation).
2. 选品 agent + the trend pipeline tools + `match_to_catalog` (the new capability).
3. 决策 re-scope to consume Briefing + TrendReport (structured).
4. Operators: structured notes (small).
5. Monitor: `get_lift` before/after.
