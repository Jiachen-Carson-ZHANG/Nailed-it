# 03 — The Decision Brain & the Economics

## Why a deterministic brain exists at all

Ask an LLM "which of these 40 styles should get ad spend?" and you get plausible prose with unreliable
arithmetic — different answers per run, no audit trail, and no way to unit-test the money logic. So the
math lives in a pure TypeScript module (`src/domain/decision/`) with 40+ unit tests, and the LLM's job is
what LLMs are good at: **synthesis across signals** (brain output × briefing × trends × memory) and
writing the merchant-readable reason.

The brain is **advisory, not command** (ADR-0012 §5). It returns, per style: four scores, a candidate
lever (`ad | coupon | display_only | skip`), and machine signal tags — never prose, never a final plan.
The 决策 agent has overridden it in live rounds, with reasons; that's the design working, not failing.

## The economics, and the three decisions inside them

### 1. Profit-per-hour is the headline metric — because time is the scarce resource

A salon sells technician-hours, not units. A ¥300 style that takes 3 hours is worse business than a ¥150
style that takes 1 hour. Everything routes through `profitPerHourCents`
(`src/domain/decision/economics.ts`), and capacity (below) is measured in the same unit: minutes.

### 2. Variable cost is an ABSOLUTE amount, not a percentage — or break-even is a lie

First implementation had variable cost as % of transaction price. That's degenerate: if cost is 15% of
whatever you charge, *any* discount still "breaks even" — break-even price is 0. Material cost does not
shrink because you discounted. So: `variableCostCents = round(normalPrice × 15%)` fixed from the normal
price, platform fee = 6% of the *transaction* price, and break-even is a real floor:
`breakEven = variableCost / (1 − feeRate)`. Coupon suggestions are checked against a per-hour profit
floor at the discounted price — the brain will not propose a coupon that pays the merchant less than the
floor per hour of chair time.

### 3. The ad gate spends only when the money clears — and ROAS is scale-free

Two defects were fixed the day we found them (ADR-0012 amendment 2026-07-10):

- **No money in the gate.** The ad candidate used to fire on scores + capacity. A style can score
  beautifully and still be a bad buy. Now: `expectedRoas = contribution / costPerBooking`, where
  `costPerBooking = CPC ÷ measured click→booking rate` from the style's own funnel. Gate:
  `expectedRoas ≥ merchant targetRoi` (default 2.0).
- **Circular "underexposed".** The signal was emitted *by* the ad branch — it meant "we decided to
  advertise". Now measured: `exposureRatio = impressionShare / demandShare` (attention received vs
  attention earned, relative to the shop's other styles). Below 0.8 → the shop's own surface under-serves
  the style; paid amplification has a misallocation to correct. At parity, more impressions correct
  nothing — that money is self-cannibalization.

**Why ROAS is scale-free, and why that decides where the gate lives:** bookings = spend / costPerBooking,
so ROAS = (spend / costPerBooking) × contribution / spend — **the budget cancels**. Whether to advertise
is a property of the *style*; how much to spend is a property of the *merchant's envelope*. Hence the
gate lives in the brain and the budget cap lives in the envelope (doc 04). This is also the answer to
"why doesn't the brain pick budgets".

### Asymmetric treatment of unknowns — deliberately

- **Unknown ROAS is a NO.** A style with zero clicks or zero bookings has unmeasurable economics;
  spending on it is gambling with the merchant's money. Default = keep the money.
- **Unknown exposure is reported as unknown**, never fabricated. Exposure is a relative claim needing ≥2
  impression-carrying peers; one style is 100% of its own batch, which is evidence of nothing. The signal
  becomes `exposure_unknown` — because the 决策 agent *narrates* these signals to the merchant, and a
  fabricated `over_exposed` would become a fabricated explanation.

The asymmetry is intentional: the cost of a false "spend" is real money; the cost of a false "unknown"
is a missed round.

### Validation against live data (not just unit tests)

Before shipping the gate we ran it against the demo merchant's real funnel (5 styles with traffic):

| style | exposure ratio | measured ROAS | verdict |
|---|---|---|---|
| 8274 | 0.61 (under) | 4.1 | ad ✓ |
| 8249 | 0.66 (under) | 6.8 | ad ✓ |
| 8275 | 0.38 (under) | n/a — zero bookings | **no spend** |
| 8282 | 1.30 (over) | 1.8 < 2.0 | **no spend** |
| 8284 | 1.85 (26% of ALL impressions, 61 clicks, 0 bookings) | n/a | **no spend** |

The gate kept the two good buys and killed the three cash-burners — including 8284, the style an earlier
round had wanted to amplify. 8284 instead became a **coupon** candidate (high demand, zero conversion,
already fully exposed → price is the lever, not visibility). That distinction — ad fixes under-exposure,
coupon fixes under-conversion — is the whole PM quadrant model, executable.

## Capacity: interval math, not vibes

`src/domain/decision/capacity.ts` computes next-week free intervals from working plans minus bookings:
utilization %, band (`very_idle < 60 < normal < 80 < near_full ≤ 90 < full`), largest free gap, and
per-style **fragment fit** (`largestGap ≥ styleDuration` — a 3-hour style doesn't fit a week of 45-minute
scraps even at 60% utilization). The gates consume it: coupons are blocked above 70% utilization (don't
discount chair time you'll sell anyway), ads above 85%, and the orchestrator skips the spend lanes
entirely at `full` (eval-pinned, doc 06).

## Honest limits, written down before a judge finds them

1. **Incrementality.** `expectedRoas` treats every ad-driven booking as incremental; some would have
   booked organically. It is an **upper bound**, stated as such in code comments and the ADR. The fix is
   not a fabricated lift factor — it's the memory loop (doc 05): 监测 writes *measured* outcomes, 决策
   reads them, and measured verdicts outrank the estimate.
2. **`AD_COST_PER_CLICK_CENTS = 120` is a named config assumption** (¥1.2, in line with beauty-category
   CPC), not a measurement. When campaigns accumulate real spend/clicks, the measured number replaces it
   through the same memory loop.
3. **Funnel targets** (`DEFAULT_TARGETS`: CTR 8%, booking rate 15%, …) are tunable assumptions that
   normalize scores to 0–100. Relative comparisons between styles are robust to them; absolute score
   values are not.
