# Synthetic Demo Data — Narrative, Methodology & Generator Spec

**Date:** 2026-06-27 · **Implementation status updated:** 2026-07-02
**Status:** **IMPLEMENTED** — the plan below shipped. This doc is the original plan + methodology; the
deltas between it and what actually runs are in **§0.5** (read that first). Local-only.
**Purpose:** one engineered dataset that makes the platform demoable 100% — multi-merchant feed + ads,
the per-merchant agent loop (数分 / 选品 / decisions / Monitor), and personalized 用户运营 — while keeping
**agent decisions live at runtime**, not scripted.

---

## 0.5 Implementation status & deltas (2026-07-02) — READ FIRST

This plan is **built**. Shipped: `src/mock/prng.ts` (mulberry32 + samplers), `style-latents.ts`,
`filler-merchant-styles.ts` (4 fillers), `intelligence-seed.ts` (sampled funnel), `external-trends.ts`;
scripts `npm run backfill:fillers` + `npm run preflight`. **Where reality now differs from the plan text below:**

- **暗黑 = 0 库存（total gap），不是 "≈1"。** 库内没有任何 published 暗黑 款、也没有 planted `8281`；缺口 = 纯
  "无款" + 外部 暗黑 趋势 + 搜索需求。→ §3 / §7 中 "thin supply (≈1 style)" 与 `8281` 行**已作废**。
- **实际 planted scenarios**（`style-latents.ts`）：winner 8265 · low-conversion 8284 · declining-star 8282 ·
  vanity-trap 8273 · metallic-bg 8274 · under-exposed-gem 8275 · near-tie 8249/8266 · dead 8277/8261。
  （原计划的 "暗黑 gap-supply" 已不作为 planted 款——改为 0 库存缺口。）
- **平台热门（pop style）信号 = TBD。** 现 `get_platform_hot` = 跨店**标签覆盖度**（styleCount + merchantCount），
  是**占位实现**。真正的热门信号应更**精细**——**既不是原始 booking/click，也不是标签计数**；**待设计（TBD）**。
  （§4 把它写成 "booking/click popularity" 也不准确。）
- **匹配已升级（ADR-0008）。** 选品 trend→catalog 匹配新增 `MATCH_MODE=concept` 路径（VLM 概念 + Google embed
  + Cohere rerank），超越 §4 的 tag-overlap；见 trend-matching 评测报告 + ADR-0008。

---

## 0. Principles

- **Two different determinisms — keep one, kill the other:**
  - **Data determinism (keep):** same dataset every run, via a *seeded* PRNG → stable, reproducible demo.
  - **Decision determinism (kill):** we do **NOT** hardcode nail→action. Insight diagnosis, ranking,
    place_ad/coupon, list/delist all happen in the **agent runtime**. We design *situations*; the agent
    reasons; we watch (and may disagree).
- **Sample, don't hand-pick.** Numbers come from a generative behavior model (distributions), not round
  constants — so the data is **organic and not obvious**. Edges are fuzzy; most styles are unremarkable.
- **Pics are swappable.** Nails are `imageUrl`; placeholders now, swap the 100 real pics later. Tags are
  authored now. **Nothing here is blocked by the missing pictures.**
- **1 hero + 4 fillers.** Deep-demo one merchant's loop. Fillers populate the feed/ads **and** give the
  real **平台热门** signal (aggregate cross-merchant popularity) — 选品's external comparison isn't mocked.
- **Build on what exists.** Hero + its narrative + named personas already exist; we add a seeded PRNG +
  sampling + fillers. Extend, don't rebuild.

---

## 1. Merchants (5)

| id | name | role | styles | fidelity |
|---|---|---|---|---|
| `merchant-nailed-it` | Nailed-it Studio (Melissa) | **HERO** — agent loop demos here | ~30 (existing) | rich sampled funnel + named customers |
| `merchant-gloss-lab` | Gloss Lab | filler | ~18 | light popularity (platform-hot + feed) |
| `merchant-aurora-nails` | Aurora Nail Bar | filler | ~18 | light popularity |
| `merchant-velvet-tips` | Velvet Tips | filler | ~18 | light popularity |
| `merchant-mond-studio` | MöND Studio | filler | ~18 | light popularity |

Filler styles = placeholder `imageUrl` + authored facets + `published` + a price. Deliberate tag overlap
with the hero so platform-hot matching has signal.

---

## 2. Synthetic-data methodology (the generative model)

**Mental model: model user behavior, then sample it.** The funnel is a chain of conditional
probabilities. Each style `s` has *latent* (hidden) quality params; we sample the funnel from them.

```
latent per style s:
  λ_s    exposure volume          (how often shown)
  ctr_s  P(click | impression)
  try_s  P(try-on | click)
  cvr_s  P(booking | try-on)      ← the core "quality"
  sav_s  P(save | click)          (used for the vanity-metric trap)

sample (seeded PRNG):
  impressions ~ Poisson(λ_s)
  clicks      ~ Binomial(impressions, ctr_s)
  try-ons     ~ Binomial(clicks,      try_s)
  bookings    ~ Binomial(try-ons,     cvr_s)
  saves       ~ Binomial(clicks,      sav_s)
```

**Choosing the distributions (the craft):**

- **Rates ~ Beta(α, β)** — bounded 0–1, ideal for probabilities. Tune mean + spread so **most styles
  cluster middling, a few great, a few poor.** Base priors:
  - `ctr ~ Beta(2.5, 9)` → mean ≈ 0.22
  - `try ~ Beta(2.5, 7)` → mean ≈ 0.26
  - `cvr ~ Beta(2, 8)`  → mean ≈ 0.20
  - `sav ~ Beta(2, 12)` → mean ≈ 0.14
  Binomial sampling **on top of** Beta rates blurs the edges — this is what stops the data being obvious.
- **Exposure ~ Poisson(λ)**, with per-style `λ` drawn from a popularity prior (range ~20–110) so some
  gems are under-exposed and some duds are over-exposed.
- **Customer taste = a latent affinity vector** over tags. Event probability ∝ `taste · styleTags`, so
  per-user journeys are coherent (Melissa skews 法式/裸色) and personalization is real.
- **Trends = time-varying rates.** Over the 14-day window, a rising tag's effective `ctr`/search rate
  **ramps** (e.g. ×1 → ×1.8). The "rising" signal *emerges* from timestamps — no `isRising` flag.

**Reproducible but organic:** a **seeded PRNG** (`mulberry32(SEED)`) → identical dataset each run, yet
fully *sampled* (natural variance). (Repo currently uses a no-randomness `spread()` + bans `Math.random`
in spots — we add a small seeded PRNG + samplers: `uniform`, `poisson`, `beta`, `binomial`, `weighted`.)

---

## 3. Data scenarios (situations, NOT verdicts)

We plant a handful of deliberately *ambiguous* situations on the hero, surrounded by the random middle
mass. **The agent decides what to do — these are what we hope it reasons about, and what we observe.**

| Scenario (planted on a style/tag) | The situation in the data | What we'll *watch* the agent do (its call) |
|---|---|---|
| **Clear winner** (8265 极光法式碎钻) | high across the whole funnel, on a rising tag | likely amplify (ad) — sanity check |
| **High-interest, low-conversion** (8284 鎏金奢华) | clicks/try-ons high, bookings ≈1 → cvr ~4% | price-test? or fit issue? *ambiguous cause* |
| **Under-exposed gem** | low λ, but high cvr when seen | spot it + amplify? easy to miss |
| **External trend, no stock** (暗黑) | 暗黑 external trend + search demand, **库内 0 款在售**（无 planted 8281；总缺口，见 §0.5）| gap → propose 上架 (gated) |
| **Declining star** | strong early window, ramps down late | revive, delist, or watch? genuinely hard |
| **Vanity trap** | high saves, low cvr | resist over-investing on a vanity metric |
| **Near-tie pair** | two similar styles, one slightly better | ranking tie-break |
| **The middle mass** (~20 styles) | unremarkable sampled funnels | background; should mostly be left alone |

Note: nothing in the data is *labeled* "winner/gap" — those are emergent from the numbers. If the agent
reasons poorly, we tune the **data or the prompt**, not a hardcoded path (this doubles as an eval loop).

---

## 4. Trends (选品 inputs)

- **Internal rising** — `金属感` ramped up over the window (from events).
- **External trends** — authored fixture `src/mock/external-trends.ts` (swap to live `trending-styles`
  later): e.g. `金属感/chrome` (matches 8284), `暗黑/dark` (no good match → gap), `镜面猫眼` (matches a hero
  style → amplify). 3–5 `ExternalTrend{label,tags}`.
- **Platform-hot** — **[SIGNAL TBD — see §0.5]** current `get_platform_hot` = cross-merchant **tag reach**
  (styleCount + merchantCount) as a *placeholder*. The real popularity signal should be more sophisticated —
  **not** raw booking/click, **not** raw tag-count — to be designed. Beat (unchanged): `镜面` hot across
  fillers, hero under-stocks → opportunity.
- Pipeline = the built `getTrendOpportunities` (collect → dedup → match tag-overlap → classify → rank).

---

## 5. Named users (rich journeys → personalization + 用户运营)

Latent taste vector each; events sampled from `taste · styleTags`. One designated **lapsed** for the
re-engagement demo.

| id · name | taste vector (weights) | budget | recency | role |
|---|---|---|---|---|
| `cust-melissa` Melissa Tan | 法式 .4, 裸色 .3, 清冷感 .3 | ~80 | **active** | personalized feed |
| `cust-amy` Amy Lim | 金属感 .5, 辣妹风 .3, 贵气 .2 | ~110 | mid | secondary |
| `cust-rachel` Rachel Goh | 甜美 .4, 可爱 .4, 韩系 .2 | ~70 | **lapsed (35+ d)** | **用户运营 target** |

---

## 6. Volume cohort (mass → per-nail aggregates)

~40 anonymous `vol(i)` customers, no names/threads, mild random taste. Jobs: realize the sampled hero
funnel, drive the `金属感` ramp + `暗黑` `search_no_result` surge, and light events on filler styles for
platform-hot.

---

## 7. Latent params — hero styles (priors + scenario overrides)

The base population samples from the §2 priors. The scenario styles **override** their latent params;
the generator then *samples* the funnel from these (so even planted cases have natural variance):

| style | λ (exposure) | ctr | try | cvr | sav | note |
|---|---|---|---|---|---|---|
| 8265 winner | ~120 | Beta(6,8)≈.43 | Beta(5,7)≈.42 | Beta(8,8)≈.50 | base | on rising tag |
| 8284 low-conv | ~110 | Beta(6,9)≈.40 | Beta(7,8)≈.47 | **Beta(1,18)≈.05** | high | price suspect |
| under-exposed gem | **~25** | base | base | **Beta(7,5)≈.58** | base | easy to miss |
| ~~8281 暗黑 (gap)~~ | — | — | — | — | — | **DROPPED (see §0.5): 暗黑 is a 0-stock gap, not a planted style** |
| declining star | ~90 | time-ramp **down** | base | starts .4 → .15 | base | hard call |
| vanity trap | ~80 | Beta(6,7) | base | **Beta(1,15)≈.06** | **Beta(8,6)≈.57** | high saves, low cvr |
| dead ×2 | ~15 | Beta(1,15) | Beta(1,10) | Beta(1,20) | low | delist candidates |
| middle ~20 | Poisson(50) | priors | priors | priors | priors | the realistic mass |

(α,β illustrative — tune so rankings are *plausible*, not trivially separable.)

---

## 8. Mock-now vs swap-later

| Item | Now | Later |
|---|---|---|
| Nail images | placeholder `imageUrl` | swap in 100 real pics |
| Hero tags | real (Phase-0 audit) | — |
| Filler tags | authored | optionally refine via breakdown AI on real pics |
| Merchants / styles / events / users / funnel / trends | **fully mocked now** | — |

---

## 9. Generator spec (the build)

Deterministic, distributional, seedable to memory + Supabase. Files:

1. **`src/mock/prng.ts`** (NEW) — `mulberry32(seed)` + samplers: `uniform()`, `poisson(λ)` (Knuth),
   `beta(α,β)` (two Gamma draws / Marsaglia), `binomial(n,p)`, `weighted(choices)`. Pure, seeded.
2. **`src/mock/merchants.ts`** — +4 filler merchants.
3. **`src/mock/filler-merchant-styles.ts`** (NEW) — ~18 published styles/filler, placeholder pics,
   authored facets (overlapping the hero), prices.
4. **`src/mock/style-latents.ts`** (NEW) — the §7 table: per-hero-style latent params; everything else
   draws from the §2 priors. The single knob for the demo scenarios.
5. **`src/mock/intelligence-seed.ts`** — rewrite the event emission to **sample** the funnel from latents
   via the PRNG (replacing fixed `spread()` counts): per style, draw impressions→clicks→try-ons→bookings
   →saves over the 14-day window with the trend ramp; attribute to volume + named users by taste; emit
   `search_submitted`/`search_no_result` for the 暗黑 surge; light events for fillers.
6. **`src/mock/external-trends.ts`** (NEW) — the 选品 external-trend fixture.
7. **platform-hot read** — aggregate popularity by tag across all merchants (for `get_platform_hot`).
8. **`scripts/seed-*.ts`** — Supabase parity once the memory version reads right.

Verification: keep `intelligence-seed.test.ts` green by asserting **bands** (e.g. 8284 cvr < 0.15, 8265
cvr > 0.35), not exact counts — because the data is now sampled. The SEED constant guarantees the bands
hold every run.

---

## 9b. Capacity — rolling next-7-day bookings (ADR-0012, added 2026-07-06)

**Why.** The funnel above emits `booking_confirmed` *events* (a conversion count). The decision brain's
capacity gate ("下周能不能接住") needs real *interval bookings* in the **next 7 days** — two different
things. `mockIntervalBookings` are historical (`2026-05-23/24`), so a live test read the salon as 100% idle
and the agent over-recommended discounts into a week that could actually be full. This is the missing half
of the synthetic data.

**What.** `src/mock/capacity-booking-seed.ts` → `generateRollingBookings({ dates, technicianIds, merchantId,
styles })`: pure, seeded PRNG. Fills `today..+6` (rolling from seed time, so it never goes stale) with a
realistic **partial** load — per-tech fill varies (0.55x–1.05x) so utilization lands in normal/near_full and
**fragment gaps differ** (a 150-min style won't fit every tech's week). Guarantees: inside working hours,
never across the 13:00–14:00 break, **no per-technician overlap** (so the DB `booking_no_overlap` GiST
constraint accepts them), reproducible ids (`capseed-N`). Durations come from the published styles.

**One command.** Folded into `npm run seed:intelligence` — it now seeds **funnel + capacity together**
(customers + `analytics_events` + rolling `booking` rows), cleared/reinserted each run by the `capseed-%`
id prefix. Run after `seed:supabase` (technicians/merchant must exist). Tested by
`src/mock/capacity-booking-seed.test.ts` (in-window, no-overlap, reproducible, scenarios ordered).

### Capacity scenarios — making the decision gates bite

The brain gates **coupons above 70%** utilization and **ads above 85%** (`domain/decision/decision.ts`). With
only one load level you can never see those gates fire, so the seed takes a scenario flag:

```bash
npm run seed:intelligence -- --capacity=idle   # → 39% util (default)
npm run seed:intelligence -- --capacity=busy   # → 79% util
npm run seed:intelligence -- --capacity=full   # → 86% util
```

The generator is **target-driven**: `CAPACITY_SCENARIOS` maps each name to a `targetUtilization` and the
generator books until that minute budget is consumed, scattering slack so fragment-fit varies. (A
probabilistic per-slot fill was tried first and *cannot* hit a target — it caps out ~72% because sub-45-min
tails are never bookable, so the gates could never be exercised.) Structural ceiling ≈ **86%** for the same
reason. The seed prints booked minutes; verify at `GET /api/agent/decisions` → `capacity.utilizationPct`.

**Measured behaviour** (2026-07-06, live DB, 42 published styles — this is the regression story to demo):
| scenario | util | band | ad | coupon | display_only | skip |
|---|---|---|---|---|---|---|
| `idle` | 39% | very_idle | **4** | **4** | 0 | 34 |
| `busy` | 79% | normal | 4 | **0** | **4** | 34 |
| `full` | 86% | near_full | **0** | **0** | **8** | 34 |

`8284` (the doc's designated high-interest/low-conversion anchor) travels `coupon → display_only →
display_only`: at 79% the coupon gate (>70%) kills the discount; at 86% the ad gate (>85%) kills the spend
too. That is "下周很忙时，不要用低价动作占用产能" made literal. The 34 skips are filler styles with no funnel
data — correct, not a bug.

---

## 10. Open questions

1. Lapsed target = Rachel (recommended) or add a 4th persona so Rachel stays active?
2. Volume cohort ~40 ok, or denser?
3. PRNG: a tiny hand-rolled `mulberry32` + samplers (no dep, recommended) vs add a seedable stats lib?
4. Build order: memory repo first (fast), then Supabase parity? (recommended)
