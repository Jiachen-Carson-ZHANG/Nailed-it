# ADR-0016 — Business sandbox, Action Briefs, and executor autonomy

Date: 2026-07-11 · Status: Accepted · Supersedes parts of: ADR-0012 (brain output contract) · Extends: ADR-0013/0014/0015

## Context

Fourth external design review, and the deepest critique yet — verified against the running system:

1. **The decision brain pre-decides.** `get_style_business_decisions` returns
   `candidate: ad|coupon|display_only|skip` per style. 决策 has overridden it live (twice, both
   directions), but structurally the flow is Rule Engine → restate → execute. The tool's *name*
   already contains the word "decisions".
2. **Executors have no world to interact with.** `place_ad(style, slot, budget)` merges planning,
   validation, and execution into one call. 投广 receives exact parameters in prose and fires one
   tool — an API caller, not an agent.
3. **Forecast and actual are the same thing.** With no pre-launch forecast surface and no simulated
   market, the monitor can only compare measured numbers against the brain's static estimate
   (hypothesis snapshots, ADR-0015). Nothing can *surprise* the system, so nothing exercises
   diagnosis.

What the review got wrong (already built, kept as-is): five-layer separation (skills / task /
blackboard / memory / code policy), monitor evidence thresholds, skip-with-reason, the approval
matrix (envelope, always-draft deals, human gate on listings), same-entity revision, memory
permission matrix (ADR-0015).

## Decision

### 1. Division of labor v3 (supersedes ADR-0012 §5's *outputs*, keeps its principle)

```
Business Engine (deterministic)  →  facts + signals + constraints   (never a verdict)
决策 (LLM)                       →  Action Briefs: objective + boundaries per action
Executors (LLM)                  →  find viable parameters inside the brief, via forecast loops
Validator (code)                 →  hard rules: budget, CPA cap, protected periods, approval gates
Reviewer (LLM, Stage 2)          →  soft risk: conflicts, cannibalization, attribution, evidence quality
Monitor (LLM)                    →  layered diagnosis of actual vs forecast; bounded revision; memory
```

The brain's per-style output drops `candidate` and `suggestedCouponCents` as *directives* — the same
economics ship as **facts + signal tags** (`high_profit_per_hour`, `underexposed`,
`high_interest_low_conversion`, `poor_slot_fit`…). What to do about them becomes 决策's judgment.

### 2. Action Briefs — structured via tool call, never prose

决策 submits each action as a `submit_action_brief` **tool call** — function-calling enforces the
schema (flash cannot be trusted to emit prose JSON; tool args are the one structured channel we've
measured to be reliable). Brief shape (ad):

```json
{
  "action_type": "ad", "style_id": "S001",
  "objective": "增加工作日预约，填补下午空档",
  "target_bookings_min": 3, "target_bookings_max": 5,
  "max_total_budget_cents": 12000, "max_cost_per_booking_cents": 2500,
  "max_booked_minutes": 350, "allowed_period": "weekday"
}
```

Python stores briefs on the blackboard (`briefs` section, code-written) and injects the matching
brief verbatim into the executor's dispatch context — same deterministic-context contract as
ADR-0014. The executor may conclude **infeasible** (prose conclusion citing forecast evidence) —
that is a first-class outcome flowing back to 决策's next round.

### 3. The Ad Sandbox (Merchant Operations Simulation Environment)

A Python-owned module (`nailed_agents/sandbox.py`) + migration `0033`. Explicitly labeled a
**simulation** in the UI and to judges — the honest framing: prompts, tool loops, validation,
approvals, revisions, and memory are the real runtime; only time and market response are simulated.

- **Audiences** (code constants, 3): `broad_local_interest` (5000, low intent),
  `saved_or_viewed` (1200, medium), `try_on_no_booking` (450, high). Audience implies funnel stage —
  the separate `slot` argument dies.
- **Forecast engine** (deterministic formulas, returns *ranges* + warnings, never point estimates):
  `CPC = base_cpc × competition`; `clicks = budget/CPC`; `impressions = clicks/CTR`;
  `booking_cvr = style_cvr × intent_factor × price_fit`; plus **frequency fatigue**
  (budget/(CPC×audience_size) → factor 1 / 0.85 / 0.65 above 2 / 3 impressions per user) so "just
  raise the budget" measurably degrades CPA — the agent must trade off, not escalate.
- **Hidden scenario state** (per demo seed, invisible to agents): `delivery_factor`,
  `audience_quality` per audience, `booking_friction`. Forecast uses historical priors; **delivery
  uses hidden truth**. Same seed → same divergence → reproducible on-stage failure.
- **Business clock**: `sim_state` row per merchant (clock_hours, scenario_seed).
  `advance_clock(hours)` runs the delivery simulator for every ACTIVE campaign and accumulates
  impressions/clicks/bookings/spend into `style_ad_campaign` — the existing monitor,
  `get_campaign_outcomes`, due-list, undo, and UI read paths keep working unchanged.
- **Campaign state machine**: `draft → pending_approval → active → paused/completed`, with
  `version` incremented by in-place revisions (`update_ad_campaign` mutates the SAME campaign —
  ADR-0013's stable-entity contract, now versioned). The ¥50 auto-launch envelope maps onto
  `draft`/`active` exactly as today.

### 4. Executor toolsets

**投广**: `get_ad_account_state`, `list_available_audiences`,
`forecast_ad_plan(style_id, audience, budget_cents, duration_days)`,
`place_ad(style_id, audience, budget_cents, duration_days)` (validator inside: brief bounds → hard
refusal; envelope decides draft-vs-active), `update_ad_campaign`, `pause_ad_campaign`.
Free within the brief; the loop is: forecast → compare → maybe re-forecast → place or report
infeasible.

**团购 (Stage 3)**: merchant-approved **templates** (`allowed_coupon_templates` in policy) — the
agent configures *restrictions* (audience, redemption windows, count, expiry), never invents a
discount. Its pre-launch loop is economics-only (price floor, profit/hour, capacity fit,
cannibalization risk as `scenario estimate` ranges); real learning arrives via the monitor.

**上下架 (Stage 3)**: `delist_style` is replaced by merchandising verbs —
`feature_style`, `deprioritize_style`, `hide_from_recommendations`, `mark_seasonal` — assets are
never removed by an agent; true delisting is merchant-only. (Assets stay searchable; only exposure
allocation changes.)

**用户运营 (Stage 3)**: `classify_message_policy` splits messages into transactional
(auto-send, labeled "商家助手"), product notifications (auto, labeled), and relationship marketing
(**merchant-draft only** — the agent finds the customer and the reason, drafts, and stops). The
boss-impersonation pattern dies.

### 5. Monitor diagnosis tree (skill, Stage 1)

Failure layers, in order: insufficient evidence (→ continue collecting, NOT a revision) → delivery
failure (audience too narrow / budget too low) → engagement failure (clicks low: creative/audience)
→ conversion failure (clicks high, bookings zero: do NOT buy more of the same traffic; retarget /
hand to coupon or insight) → economic failure (CAC/profit) → capacity or experience risk. A revision
request names the layer and the requested change; the executor re-runs `update_ad_campaign` on the
same campaign.

### 6. Risk Reviewer (Stage 2)

New agent between 决策 and executors for **soft** risk only (hard rules stay in code): action
conflicts (ad + coupon on one audience → attribution loss; coupon vs delisted style — the exact
8275 conflict we hit live), capacity concentration, cannibalization, evidence quality, approval
routing. Verdicts: `approved | approved_with_conditions | revision_required |
merchant_approval_required`. Bounded like the monitor: one pass, no redesigning plans.

### 7. Decision context v3 (Stage 2)

Injected at start (per ADR-0014's inject-required rule): mission, merchant policy snapshot
(budget remaining, auto-execute limit, price floors, protected periods, approval matrix), capacity
summary, candidate style index (signals + confidence, 3–5 styles), memory hints (ADR-0015).
Tools shrink to: `inspect_style_business_facts` (detail on chosen candidates),
`inspect_capacity_slots`, `search_memory`, `simulate_action_portfolio` (combined-plan conflicts:
shared capacity, budget competition, audience overlap), `submit_action_brief`.
`get_style_business_decisions` dies with the verdict contract.

## Model reality (measured constraint the review missed)

Flash abandons long chains and narrates unperformed work (measured twice: orchestrator P1, monitor
ADR-0015). This design makes 投广 and 决策 long-chain agents → both move to the strong tier
(`AD_MODEL`, `DECISION_MODEL` default = ORCHESTRATOR_MODEL). Cost is bounded: ≤4 strong-tier runs
per round; short lanes stay flash. Round latency budget for the demo: ≤5 min, with the three
Moments (决策 brief vs facts / 投广 forecast loop + approval / monitor 打脸 + revision) as the
narrated spine and everything else in the panel.

## Alternatives considered

- **Real ad-platform integration / ML forecaster**: out of scope and dishonest at demo scale; the
  sandbox is presented as a simulation with real runtime on top.
- **Prose Action Briefs**: rejected — measured flash JSON reliability; tool args are schema-enforced.
- **Point-estimate forecasts**: rejected — ranges + confidence keep the monitor's diagnosis honest
  and stop the agent from anchoring on magic numbers.
- **Keeping `candidate` alongside briefs**: rejected — as long as the brain emits a verdict, 决策
  regresses to restating it (observed).
- **Every tool fires every round**: explicitly rejected as a demo goal — a skipped tool with a cited
  reason is stronger evidence of agency than a fired one.

## Consequences

**Positive**: executors gain genuine decision space bounded by briefs + code; forecast/actual
divergence gives the monitor real diagnosis work; the demo gets a reproducible, honest failure; the
"scripted workflow" reading dies structurally, not rhetorically.

**Negative / accepted**: ~1.5–2 weeks across three stages with the eval suite partially invalidated
between stages; two more strong-tier lanes per round (cost + latency); the sandbox is more surface
to keep honest — mitigated by pytest on the engine's math and seeds; migration 0033 (user-applied).

## References

- `agent-service/nailed_agents/sandbox.py` (Stage 1), migration `0033_ad_sandbox.sql`
- ADR-0012 (superseded: brain verdict outputs; kept: judgment-in-loops/legality-in-code)
- ADR-0013 (stable entities, bounded revision) · ADR-0014 (deterministic injection) · ADR-0015 (memory)
- External review: 2026-07-11 finals-demo brainstorm (user-relayed)
