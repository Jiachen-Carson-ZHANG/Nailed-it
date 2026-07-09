# ADR-0012 — Agent action contract (proposals + real entities) + deterministic decision brain

Status: Proposed · 2026-07-06

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

2. **Auto-apply within a merchant budget envelope** (not a per-action gate, not raw no-guardrail). The
   merchant sets policy once in 投广管理: weekly ad-spend cap · default ROI target · max per-ad budget
   (coupons: min profit-per-hour floor · max discount %). The agent **auto-applies inside the envelope**
   (closed-loop autonomy) and **proposes when it would exceed it**. Control is policy, not nagging; the
   merchant's money is never spent past a cap they set.

3. **The agent may do nothing.** Remove the "exactly two actions" force from `orchestrator.py` +
   `decision.md`. The decision output is per style: `ad | coupon | display_only | skip`.

4. **Deterministic decision brain** (`styleBusinessDecision` read model, compute-on-read per ADR-0006/0011).
   Pure, testable: **economics** (contribution profit, revenue/hour, profit/hour, break-even coupon price),
   **funnel** scores from `analytics_events`, **capacity** from the *full* scheduling kernel (working plans,
   breaks, blocked time, cancelled-booking exclusion, staff duration overrides, style duration, timezone,
   **fragment-fit**), the **4 scores** (Business Value / Demand / Conversion / Capacity-Fit), and the rule
   engine → per-style recommendation + reason + expected impact + risk. The 决策 agent **consumes** this
   output for narrative and to fire tools; it never re-derives the math (numbers are computed, not guessed).

5. **Cost model.** `contribution = price − variable_cost − platform_fee`, with
   `variable_cost = price × VARIABLE_COST_RATE` (config, ~0.15, optional per-style override) and
   `platform_fee = price × PLATFORM_FEE_RATE` (config, flagged assumption). No `payment_fee` (payment is
   off-spec). A flat % is accurate enough for ranking, which is all the decision needs; nail economics is
   dominated by time, not material.

6. **Entity-aware reversibility.** Undo/stop acts on the real entity (stop the `ad`, unlist the
   `groupbuy_deal`) transactionally with the `agent_actions` status, and stays honest: already-spent ad
   budget and already-sent messages are not "undoable" (ADR-0011).

## Design principles

- Model the real commercial object, not a log of intentions; the UI and controls are functions of it.
- The merchant controls the money through policy guardrails set once, not per-action friction.
- Deterministic math + LLM narrative; the agent decides *whether/what to say*, not *what the numbers are*.
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

## References

- PM spec: `美甲款式运营决策分析.pdf` (local) · ADR-0006 (compute-on-read) · ADR-0007 (agent team) ·
  ADR-0011 (backend-honest controls / reversibility) · ADR-0004 (repository seam)
- Audits 2026-07-06 (proposal audit + action-contract audit) · `docs/plans/2026-07-06-decision-brain-and-action-contract.md`
- Code touch points: `agent-service/nailed_agents/orchestrator.py`, `agent-service/skills/decision.md`,
  `agent-service/nailed_agents/tools.py`, `src/lib/repositories/local/groupbuy-repository.ts`,
  `src/domain/groupbuy.ts`, `src/features/merchant/GroupbuyPanel.tsx`, `src/app/merchant/manage/page.tsx`
