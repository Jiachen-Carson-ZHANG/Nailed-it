# Plan — Decision brain + action contract (投广 / 团购)

Local plan (not shipped to GitHub). Source: PM spec `美甲款式运营决策分析.pdf`, audits 2026-07-06,
ADR-0012. Sequencing is **contract-first → brain → agent → surfaces**.

## Update — after merging `origin/main` (2026-07-06)

A whole **StyleAd ad-campaign subsystem already exists on main** (was missing from `feat/persistence-p0`):
- `src/domain/style-ad.ts` — real entity: status `draft→active→paused→ended`, promotionGoal, targetExposure,
  targetRoi, startAt, durationDays, audience, dailyBudgetCents.
- **投广中心** at `/merchant/ads` (`StyleAdCenter`, aggregate spend/impressions/ROAS) + per-style editor at
  `/merchant/styles/[id]/ads` (`StyleAdEditor` + `StyleAdPromotionSettings`).
- `style-ad-actions.ts` — `launchStyleAdAction` (merchant *launches* a draft → active; requires published
  style), `getStyleAdCenterSnapshotAction`; persists via `upsertCampaignRow` (Supabase) + mock. Tables:
  migrations `0023–0025` (my `style_concept` renumbered to `0026`).

**Consequences for this plan:**
- The **投广管理 tab is already built** (center + editor). Do not build; reuse.
- The **"real ad entity" (audit H1 / old Phase 0) exists** (`StyleAd`).
- **Ads already have a merchant gate** (draft→launch→active). So for the money lever, ride *that* gate —
  the agent proposes a StyleAd **draft**; the merchant launches it in the center. This is cleaner than
  "auto-apply real ad spend within an envelope"; the envelope idea survives only as an optional demo
  fast-path (auto-launch inside caps).
- Remaining gap = **linkage + brain + 团购**, not building the ad UI.

## The core reframe

`place_ad` / `set_group_buy_coupon` are fire-and-forget `applied` log rows, disconnected from the real
commercial objects (`StyleAd`, `GroupbuyDeal`). Every want — spend control, pause/stop, review→publish,
attribution, honest undo, the PM's "do nothing" — needs the action to map to the real entity. Ads: agent
proposes a `StyleAd` draft (merchant launches). Coupons: agent proposes a `GroupbuyDeal` (merchant
publishes). The agent may `skip` / `display_only`.

## PM spec → repo status (the gap)

| PM component | Status |
|---|---|
| Event schema (impression→click→…→booking) | ✅ `migration 0017` + seeded `intelligence-seed.ts` + track action |
| Trend→catalog match → amplify/price_test/gap/prune | ✅ `trend_logic.py` (trend-fit driven) |
| Economics: contribution profit, rev/hr, profit/hr, break-even coupon | ❌ build (Phase 1, T1) |
| Capacity: next-week utilization, fragment-fit | ⚠️ data exists (scheduling kernel) — not computed (T3) |
| 4 scores (BizValue / Demand / Conversion / Capacity-Fit) | ❌ build (T2, T4) |
| Ad-vs-coupon rule (ROAS target, incremental profit, capacity gate) | ⚠️ crude amplify→ad / price_test→coupon (T4) |
| Per-style output {ad/coupon/display/skip}+reason+impact+risk | ⚠️ partial (T4) |

North star to bake into the agent + the rule engine:
> 广告推"本来就赚钱、只是曝光不够"的款；团购推"有兴趣但转化不足、且下周有空档"的款；下周很忙时不做低价动作。

## Phase 0 — Contract (do first)

- **Entities + tables** (manual SQL migration; memory + supabase bundles):
  - `ad` — merchantId, styleId, slot, budgetCents, roiTarget, status (proposed→approved→running→paused→
    stopped), spendCents, roas, sourceRunId, timestamps.
  - `groupbuy_deal` — move `GroupbuyDeal` off `localStorage` into a table; add `sourceRunId`, `status`
    (proposed/draft/published/unlisted). Repository seam like the rest.
- **Budget envelope** (merchant policy, set in 投广管理): weeklyAdCapCents, defaultRoiTarget, maxAdBudgetCents;
  coupon: minProfitPerHour, maxDiscountPct. Persist per merchant.
- **Tools** `propose_ad` / `propose_groupbuy`: write the entity + an `agent_actions` row linked by
  `sourceRunId`; auto-set status to running/published when inside the envelope, else proposed. Keep the
  existing tool names as thin wrappers if the Python contract is easier to evolve incrementally.
- **Un-force the agent**: rewrite `orchestrator.py` 决策 step + `skills/decision.md` to allow 0–N actions
  incl. `skip` / `display_only`; the decision output is per style.
- **Entity-aware undo**: `undo` stops the `ad` / unlists the `groupbuy_deal`, transactional with the action
  status; honest about already-spent budget (ADR-0011).

## Phase 1 — Deterministic decision brain (`styleBusinessDecision` read model)

Pure, testable modules (compute-on-read, ADR-0006/0011 pattern). One function → per-style analysis.

- **T1 `style-economics.ts`**: `contribution = price − price×VARIABLE_COST_RATE − price×PLATFORM_FEE_RATE`;
  revenuePerHour, profitPerHour (= contribution / minutes × 60), breakEvenCouponPrice. Config constants
  centralized. Tests.
- **T2 `funnel-scores.ts`**: CTR, detailRate, saveRate, tryOnRate, bookingRate, completionRate from
  `analytics_events` aggregates → Demand Score + Conversion Score (PM weights). Tests.
- **T3 `capacity.ts`**: next-week available/booked minutes, utilization band (<60 / 60–80 / 80–90 / >90),
  and **fragment-fit** for a style's duration — reuse the *full* scheduling kernel (`scheduling.ts`:
  working plans, breaks, blocked time, staff duration overrides), exclude cancelled, merchant tz. Tests
  incl. the "150-min style into 45-min gaps → not fit" case.
- **T4 `decision.ts`**: 4 scores (BizValue/Demand/Conversion/CapacityFit, PM weights) → rule engine
  (Ad Recommend / Coupon Recommend thresholds; capacity gate; incremental-profit + ROAS-target checks) →
  per-style `{recommendation: ad|coupon|display_only|skip, reason, expectedImpact, risk}`. Tests encode the
  PM thresholds and the four-quadrant classification.

## Phase 2 — Agent consumes the brain

- 决策 agent reads T4 output (a compute action, e.g. `get_style_business_decisions`), proposes actions **or
  none**, and writes the grounded narrative (reason/impact/risk from the read model, not invented).
- Monitor agent attributes outcomes against the real `ad` / `groupbuy_deal` entities (B→C→monitor loop).

## Phase 3 — Surfaces (both fed by real proposals)

- **团购管理** (`GroupbuyPanel`): AI助手 card → real proposed `groupbuy_deal`s (kill the hardcoded
  `sug-001/002` + dead 查看); proposal → merchant edits/publishes the real deal; move the coupon
  `AgentActionInline` **inside** the panel (not above the pricing panels, `manage/page.tsx:737`); strengthen
  `groupbuy.ts` date/time validation (end>start, sale window, weekday, working-hours overlap); DESIGN.md
  tokens + AA contrast + 44px.
- **投广管理 (new tab)**: spend governance — envelope settings (cap / ROI / max), proposed-ad approve/reject,
  running-ad pause/stop, spend + ROAS view. Ads stay agent-proposed; this tab governs the money.
- **今日 home**: ad + coupon proposals flow into the existing pin/roll (already built) once they are proposals.
- **Cross-cutting**: money → merchant currency (drop hardcoded SGD in `AgentActionInline`); `.button-compact`
  → 44px; the global `.button-primary` contrast fix (ADR-0011 follow-up).

## Open / assumptions

- `PLATFORM_FEE_RATE`, `VARIABLE_COST_RATE` are config assumptions until confirmed.
- Ad spend/ROAS is simulated until a real 美团 ad API exists (Monitor writes synthetic outcomes for the demo).
- **Envelope: decided** — auto-launch within cap + withdrawable, gate above (ADR-0012 Accepted 2026-07-06).
- **Status:** Phase 0a (schema/repos/state-machine) + Phase 1 (deterministic brain) shipped. Phase 2 (the
  read-model action + tools that write entities & set the action↔entity linkage + un-force orchestrator +
  eval) is next — it also carries the audit follow-ups: transactional save RPC, group-buy terms parser,
  real ROAS/exposure ad gate, and a follow-up migration for `style_ad_campaign.source_run_id`.
