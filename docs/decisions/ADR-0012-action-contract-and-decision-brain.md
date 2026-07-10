# ADR-0012 — Agent action contract (proposals + real entities) + deterministic decision brain

Status: Accepted · 2026-07-06

## Context

The merchant operations agent team (ADR-0007) promotes styles with two levers — **投广** (`place_ad`) and
**团购** (`set_group_buy_coupon`) — plus catalog moves and customer messages. A business-analysis spec from
the PM ("美甲款式运营决策分析") defines how those levers *should* be chosen: per style, decide **ad vs
coupon vs display-only vs skip**, gated on unit-time profit and next-week capacity. Two audits (2026-07-06)
found the current implementation cannot express that, because of a contract problem, not a UI problem:

- **The agent is forced to always act.** `orchestrator.py` asks the 决策 step for *"两个精确动作：一个投广…
  一个团购"* and `skills/decision.md` requires *选定两个精确动作*. There is no way to output *skip /
  display_only / no_action* — the exact thing the PM demands when next week is full or profit is weak.
- **Actions are fire-and-forget log rows, not reviewable proposals or real objects.** `set_group_buy_coupon`
  / `place_ad` write `agent_actions` with `status='applied'` immediately. There is no ad/deal entity with a
  lifecycle, no spend/ROAS, no `source_run_id` link. Merchant review, ad-spend control, pause/stop, 团购
  review→publish, attribution, and honest undo all require a real object the action maps to.
- **团购 deals live in browser `localStorage`** (`groupbuy-repository.ts`), so an agent can't create one, and
  the demo can't persist or attribute them.
- **Undo is a status flip** (`agent_actions.status → 'undone'`) that does not touch any real ad/deal.
- The decision itself is trend-fit driven (`trend_logic.py`: amplify/price_test/gap/prune); it lacks the
  PM's economics (profit/hour, contribution margin, break-even), capacity math, and the 4 scores.

## Decision

Fix the **action contract boundary first**, then add the deterministic brain, then the surfaces.

1. **Proposals + real commercial entities.** Every promotable action maps to a real object with a lifecycle,
   carrying `source_run_id` for traceability:
   - `ad` — style, slot, budget, ROI target, `status: proposed→approved→running→paused→stopped`, spend, ROAS.
   - `groupbuy_deal` — moved out of `localStorage` into a Supabase table (repository seam, memory + supabase
     bundles per ADR-0004), with `source_run_id`.
   The agent tools become `propose_ad` / `propose_groupbuy` (write the entity in a proposed/draft state),
   not an applied `agent_actions` log row that pretends the effect happened.

2. **Auto-launch within a merchant budget envelope; gate above it.** The merchant sets policy once in
   投广中心: weekly ad-spend cap · default ROI target · max per-campaign budget (coupons: min profit-per-hour
   floor · max discount %). **Inside the cap → the agent auto-launches** the `StyleAd` (active) — safe
   because ad spend is a **daily drip** (`dailyBudgetCents × days`) and **withdrawable** (StyleAd already
   has pause/stop), so worst-case loss is bounded and stoppable going forward. **Above the cap → it proposes
   a draft** the merchant launches in the center. Coupons follow the same logic (reversible → auto-publish
   inside the floor, propose outside). Control is policy, not per-action nagging; money is never spent past
   a cap the merchant set.

3. **The agent may do nothing.** Remove the "exactly two actions" force from `orchestrator.py` +
   `decision.md`. The decision output is per style: `ad | coupon | display_only | skip`.

4. **The decision brain is a per-style advisory TOOL, not the decider.** `styleBusinessDecision`
   (compute-on-read, ADR-0006/0011) is pure and testable: **economics** (contribution profit, revenue/hour,
   profit/hour, break-even coupon price), **funnel** scores from `analytics_events`, **capacity** from the
   *full* scheduling kernel (working plans, breaks, blocked time, cancelled-booking exclusion, staff duration
   overrides, style duration, timezone, **fragment-fit**), the **4 scores**, and a rule engine → per-style
   `{economics, scores, the lever the economics point toward, expected impact, risk}`. It answers *"is THIS
   style worth amplifying/discounting, and how"* — it does **not** conclude what to do. Numbers are computed,
   never LLM-guessed.

5. **The agent is a multi-tool loop + cross-signal synthesis — that is its entire value.** A single LLM call
   is not an agent; a deterministic rule is not an agent. The agent is real only because it **loops over
   tools** (the brain-tool + 数分 briefing + 选品 trends + monitor's actual lift, across many styles) and
   answers the question **no single tool holds**: *given this week's cap, alerts, capacity conflicts between
   styles competing for the same technician-hours, and what last round taught it — which styles to act on,
   in what order, within budget.* Design rule that keeps the loop non-cosmetic: **no single tool returns
   "the answer."** The brain is deliberately per-style and advisory; the portfolio/timing/allocation decision
   requires synthesis. Fixed stages (insight→trend→decide→execute→monitor), free tool choice within a stage.

6. **Cost model.** `contribution = price − variable_cost − platform_fee`, with
   `variable_cost = price × VARIABLE_COST_RATE` (config, ~0.15, optional per-style override) and
   `platform_fee = price × PLATFORM_FEE_RATE` (config, flagged assumption). No `payment_fee` (payment is
   off-spec). A flat % is accurate enough for ranking, which is all the decision needs; nail economics is
   dominated by time, not material.

7. **Entity-aware reversibility.** Undo/stop acts on the real entity (stop the `StyleAd`, unlist the
   `groupbuy_deal`) transactionally with the `agent_actions` status, and stays honest: already-spent ad
   budget and already-sent messages are not "undoable" (ADR-0011).

## Design principles

- Model the real commercial object, not a log of intentions; the UI and controls are functions of it.
- The merchant controls the money through policy guardrails set once, not per-action friction.
- Determinism lives in the **tools** (grounded facts); the **decision** lives in the agent's multi-tool
  synthesis. **No single tool returns "the answer"** — else it's a rule with a narrator, not an agent. A
  single LLM call is not an agent; a deterministic rule is not an agent; the tool-loop is what earns the name.
- Doing nothing is a first-class outcome.

## Alternatives considered

- **Pure auto-apply, no envelope** — rejected: spends the merchant's money with no consent, contradicts the
  merchant ad-spend-control requirement and the honest-irreversibility rule (ADR-0011); reads as reckless.
- **Per-action approval gate for everything** — rejected: kills the closed-loop autonomy that is the product
  story; the envelope gives control without the friction.
- **Keep applied-log-only actions** — rejected: cannot support review, spend control, pause/stop,
  attribution, or real undo.
- **Let the LLM compute economics/capacity** — rejected: non-deterministic and untestable; the PM provides
  explicit formulas that belong in a pure read model.
- **Per-item variable-cost model** — rejected as premature; no per-style cost data, and a flat % ranks fine.

## Consequences

**Positive:** the merchant can review/govern spend; ads/deals are real, persistent, attributable objects;
the agent can correctly do nothing; the decision is grounded and testable; undo is honest.

**Negative / follow-ups (backlog):** new Supabase tables (`ad`, `groupbuy_deal`) via manual migration; 团购
moves off `localStorage` (a data migration for any existing local drafts is out of scope — demo reseeds);
`orchestrator.py` + `decision.md` rewritten; a new 投广管理 tab; money must use merchant currency; the global
`.button-compact` (36px) needs to reach 44px. Real 美团 ad spend/ROAS is **simulated** until a platform ad
API exists; `PLATFORM_FEE_RATE` is an assumption until confirmed.

## Amendments (2026-07-06 — post-merge with `origin/main` + audit)

Merging `origin/main` revealed a **StyleAd ad-campaign subsystem already shipped** (center `/merchant/ads` +
per-style editor + entity + migrations 0023–0025). This supersedes parts of the Decision above:

- **Ride the existing entities; do not build a parallel `ad` table.** Decision §1's "ad entity" is satisfied
  by `StyleAd` (status `draft→active→paused→ended`, targets, budget, spend). 团购 still needs its own move
  off `localStorage` — mirror StyleAd's repo/table pattern.
- **Ads already have a merchant gate** (draft → *launch* → active) plus pause/stop. This makes Decision §2
  concrete and safe: **inside the cap the agent auto-launches** (bounded, withdrawable daily-drip spend);
  **above the cap it proposes a draft** the merchant launches in the center. The built lifecycle *is* the
  gate — no new gate needed.
- **Action ↔ entity linkage (audit High).** `agent_actions` today has no entity reference. Add
  `entity_type` + `entity_id` (or a typed payload contract) on `agent_actions`, and `source_run_id` on
  `StyleAd` / `GroupbuyDeal`, so undo / monitor / surfaces can find the real object. Undo acts transactionally
  on the entity (pause the `StyleAd`, unlist the `GroupbuyDeal`), not just the action status.
- **Group-buy items go relational (audit High).** Add `groupbuy_deal_item` (FK `catalog_item`, quantity,
  position), mirroring `merchant_style_item`; keep JSONB only for policy fields (availability windows). Also
  strengthen `groupbuy.ts` date/time validation (end>start, sale window, weekday, working-hours overlap).
- **State machine (audit Medium).** Define the exact map between `StyleAd.status` / `groupbuy_deal.status`
  and `agent_actions.status` (proposed / approved / applied / undone) before implementation.
- **Capacity duration policy (audit Medium).** `quoteService` duration varies by technician; the decision
  brain must pick one policy (merchant-default duration, or best-fit-technician duration) for fragment-fit.
- **Eval (audit Medium).** Add non-action (`skip` / `display_only`) scenarios and `propose_*` target-field
  grounding to `agent-service/eval/agents_eval.py` (which currently fails on "no tool calls").
- **Currency snapshot (audit Medium).** Store cents **plus** currency on ad/deal/policy at decision time so
  historical actions don't change meaning if the merchant currency changes.
- **Phase 0 split (audit High).** 0a schema/repos/state-machine → 0b linkage with no UI behavior change →
  Phase 1 deterministic brain → Phase 2 tools/orchestrator. Avoids new tools relying on LLM judgment before
  the PM math exists.

**Accepted 2026-07-06** after the division-of-labor brainstorm resolved the agent ↔ brain boundary
(Decision §5: brain = advisory tool, agent = tool-loop + synthesis, no single tool returns the answer) and
the ad-spend model (Decision §2: auto-launch within cap + withdrawable, gate above).

## Amendments (2026-07-10 — Phase 2 tail: undo, atomicity, ad economics)

**1. Undo acts on the entity, and the order is load-bearing.** `undoAgentActionAction` / `rejectAgentActionAction`
now: read the action → pre-check `canUndoAction` → withdraw the **entity** → mirror `agent_actions.status`.
The entity moves *first*. If the mirror then fails, the campaign is already paused and the deal already
unlisted: the merchant's money is safe and the stale pill self-corrects, because the entity's status is
authoritative (§ contract). The reverse order would report "undone" while the ad kept spending. An applied
irreversible action (a sent message) is refused before its entity is touched at all.

Withdrawal targets (`action-entity-contract.ts`): `style_ad active→paused` (resumable), `draft→ended`
(a declined proposal); `groupbuy published→unlisted`, `draft→unlisted`. `GROUPBUY_TRANSITIONS.draft` gains
`unlisted` so a rejected proposal is **shelved, not deleted** — the audit trail keeps its `source_run_id`.
A withdraw on an already-not-live entity is a no-op, not an illegal transition.

**2. Group-buy `save` is atomic (migration `0029`, `save_groupbuy_deal` RPC).** The old path was upsert +
item-delete + item-insert as three PostgREST calls; a failure between the delete and the insert left a
*published* deal with zero services — a live offer the merchant cannot honour. One plpgsql function now
commits deal + items together, and refuses to reassign a deal across merchants.

**3. The ad gate spends only when the money clears.** Two independent defects, both fixed in
`src/domain/decision/ads.ts`:
- *No ROAS.* The gate fired on scores + capacity, never on money. Now `expectedRoas = contribution /
  costPerBooking`, where `costPerBooking = AD_COST_PER_CLICK_CENTS / (bookings/clicks)` measured from the
  style's own funnel. **ROAS is scale-free** — the budget cancels — so *whether* to advertise is a property
  of the style, and the budget cap only decides *how much* of a good buy to buy. That is why the gate lives
  in the brain and the cap lives in the envelope (§2).
- *Circular `underexposed`.* The signal was emitted **by** the ad branch, so it meant "we decided to ad".
  Now measured: `exposureRatio = impressionShare / demandShare` — attention received (a volume share) vs
  attention earned (a rate-quality share). Below `0.8` the shop's own surface under-serves the style and
  paid amplification has a misallocation to correct; at parity it does not.

**Asymmetric defaults, deliberately.** Unknown ROAS is a **NO** (wrongly spending is a real loss). Unknown
exposure is reported as `exposure_unknown` rather than fabricated — the agent narrates these signals, and a
false `over_exposed` becomes a false explanation. Exposure is a *relative* claim, so it needs ≥2
impression-carrying styles; one style is 100% of its own batch and that is evidence of nothing.

**Honest limit:** every ad-driven booking is treated as incremental. Some fraction would have booked
organically, so `expectedRoas` is an **upper bound**. Measuring true lift needs a holdout experiment; when
`style_ad_campaign` accumulates real impressions/clicks/spend, replace the estimate with that measurement
rather than inventing a lift factor. `AD_COST_PER_CLICK_CENTS = 120` is a named config assumption (¥1.20,
美团 beauty-category CPC), not a measurement.

Verified live against the demo merchant: of 5 styles with traffic, exactly 2 clear both gates
(`8274` ratio 0.61 / ROAS 4.1; `8249` ratio 0.66 / ROAS 6.8). The gate blocks `8284` (26% of all impressions,
61 clicks, **zero** bookings) and `8282` (ROAS 1.8 < target 2.0) — the two that would have burned cash.

## References

- PM spec: `美甲款式运营决策分析.pdf` (local) · ADR-0006 (compute-on-read) · ADR-0007 (agent team) ·
  ADR-0011 (backend-honest controls / reversibility) · ADR-0004 (repository seam)
- Audits 2026-07-06 (proposal audit + action-contract audit) · `docs/plans/2026-07-06-decision-brain-and-action-contract.md`
- Code touch points: `agent-service/nailed_agents/orchestrator.py`, `agent-service/skills/decision.md`,
  `agent-service/nailed_agents/tools.py`, `src/domain/decision/` (brain, incl. `ads.ts`),
  `src/domain/action-entity-contract.ts`, `src/lib/actions/agent-actions.ts` (entity-aware undo),
  `src/lib/repositories/supabase/groupbuy-repository.ts`, `src/domain/groupbuy.ts`,
  `src/features/merchant/GroupbuyPanel.tsx`, `src/app/merchant/manage/page.tsx`
- Migrations: `0027_action_entity_contract` · `0028_style_ad_source_run` · `0029_save_groupbuy_deal_rpc`
