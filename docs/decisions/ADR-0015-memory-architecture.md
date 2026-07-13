# ADR-0015 — Memory architecture: agents judge, code anchors evidence

Date: 2026-07-11 · Status: Accepted · Extends: ADR-0013 §3 (cross-round memory), ADR-0014 (context routing)

## Context

The ADR-0013 memory loop was real but shallow: the monitor wrote one-sentence verdicts
(`record_memory(kind, key, verdict, entity_id, window_days)`), and 决策 read the 40 newest rows
(`get_agent_memory`). An external design review identified the structural limits:

1. **The model controlled memory identity.** It chose `key`, `entity_id`, and `window_days` — free to
   bind a conclusion to the wrong campaign, invent an observation window, or file the same fact under
   multiple keys.
2. **No prediction snapshot → no calibration.** Actions recorded what was done, not what 决策
   *expected*. Without "predicted 4.1, measured 2.1" the memory is history, not learning — the system
   could never quantify its own estimation bias.
3. **Recency ≠ relevance.** "40 newest rows" surfaces last week's coupon note ahead of the one measured
   outcome about the exact style being decided on.
4. **One reader, one writer, no boundaries.** No stated contract for which agents may read which
   memory, and nothing stopping a future lane from writing "experience" out of an unverified hunch.
5. **Timing.** A monitor that runs seconds after an ad launches cannot measure it; writing a verdict
   then is fabrication.

## Decision

### Four information layers, strictly separated

- **Live state** (DB tables) — current facts; wins every conflict.
- **Blackboard** (`agent_rounds.blackboard`) — this round's forming judgments and execution snapshot;
  may contain unverified conclusions; dies with the round.
- **Memory** (`agent_memory`) — conclusions that survived contact with reality, scoped and
  evidence-anchored; the only cross-round layer.
- **Skill/prompt** — how each agent works and its boundaries.

The blackboard is candidate knowledge; memory is the small subset that verification promoted.

### The write contract: the agent judges, code anchors (migration `0032`)

`record_memory` is replaced by two anchored writers, **monitor-only** (enforced via
`ctx.agent_slug` / the RevisionPort capability, not prompt text):

- `record_action_outcome(action_id, assessment, confidence)` — the model supplies only the judgment.
  Code derives from the action row: domain (from action type), scope (style id from payload), entity,
  the **hypothesis snapshot**, live campaign metrics at write time, the observation window
  (action `created_at` → now), and expiry (confidence-driven TTL: high 30d / medium 14d / low 7d).
  Re-recording the same action **replaces** (unique on merchant+kind+key where key = action id).
  Refuses when the campaign has no data yet (`observation_window_immature`) — immature actions are
  reported as *pending* in prose, never written as verdicts. This is the two-phase monitor in minimal
  form: execution audit always; durable outcomes only when there is something measured.
- `record_round_verdict(verdict, evidence_action_ids, confidence)` — requires at least one real action
  id as evidence; a verdict without evidence is an opinion and is refused.

### Hypothesis snapshots (the calibration enabler)

`place_ad` / `set_group_buy_coupon` now embed the decision brain's prediction for the target style
into the action payload at execution time (`_decision_hypothesis`): `expectedRoas`, `exposureRatio`,
`costPerBookingCents` / `suggestedCouponCents`, `capacityBand`. **Code-derived from the brain's own
output — never parsed from a model's prose.** `record_action_outcome` then computes the comparison
deterministically (e.g. measured spend/booking 28 000分 vs predicted 8 000分 → ratio 3.5,
`underestimated_cost`). The claim is the agent's; the numbers are code's.

### The read contract: relevance search + deterministic hints

- `get_agent_memory` is replaced by `search_memory(scope_refs, scope_tags, domains, limit)` with
  **structured relevance scoring in code** (exact entity/action anchor +100 > style match > tag +50 >
  merchant preference +60 > domain +25 > high confidence +20). No embeddings: our scopes are explicit
  ids and tags, so deterministic scoring is cheaper and eval-reproducible. Semantic search earns its
  place only if free-text memory volume ever demands it.
- **Per-agent domain access** (`MEMORY_ACCESS`, code): 决策 and 监测 read broadly; 数分/选品/上下架/
  用户运营 read their relevant domains; **executors (投广/团购) read nothing** — history is
  synthesized into the plan by 决策, and an executor re-interpreting strategy mid-execution destroys
  the audit trail of who decided what.
- **Two-stage retrieval**: (1) deterministic pre-run hints — code injects the few memories a lane
  structurally needs (merchant preferences, latest round verdict, latest measured outcomes) into 决策
  and the orchestrator's tasks, so recall never depends on the model remembering to fetch; (2) runtime
  autonomy — after the agent discovers *which* entities matter (candidates, trends, anomalies), it
  searches their history itself. Autonomy lives in "what to look up", never in "whether to read
  required context" (ADR-0014).

### Kinds (schema `0032`)

`action_outcome` · `calibration` (systematic prediction bias — written when repeated outcomes agree)
· `round_verdict` · `merchant_preference` (explicit merchant-stated constraints only — written via UI
event paths, never inferred by an agent from one behavior; long TTL). Legacy kinds remain readable
until their 30-day TTL clears them.

## Alternatives considered

- **Free-form memory any agent can write:** the fastest route from "too little context" to context
  pollution, privilege creep, and unreproducible behavior. Rejected outright (the reviewer agreed).
- **Vector/semantic memory search:** wrong tool for explicit-id scopes at this volume; deterministic
  scoring is reproducible in eval. Revisit at scale.
- **Auto-injecting all 40 rows into 决策:** token waste and confirmation bias (数分 primed with old
  conclusions finds them again). Hints are capped and kind-selected instead.
- **A generic `record_merchant_preference` tool for agents:** preferences must come from the merchant
  (UI settings, approvals/rejections with reasons), not from an agent's inference about one behavior.
- **Full `measurement_due_at` scheduling queue:** correct end-state for production cadence; for now the
  immature-window refusal + pending-in-prose gives the same honesty without a scheduler. Deferred.

## Consequences

**Positive.** The loop now closes with attribution: prediction → action → measured outcome →
calibrated next round, every hop code-anchored. Memory can't be misfiled (identity from the action
row), can't be premature (window gate), can't be evidence-free (round verdicts), can't leak across
mandates (domain access), and can't rot silently (confidence-driven TTL). The judge-facing story
upgrades from "we log outcomes" to "the system measures its own estimation bias".

**Negative / accepted.** More schema surface (0032) and one more manual migration; the monitor's skill
carries more protocol; deal (coupon) outcomes still lack a redemption-attribution metric — their
`measured` snapshot is null until that lands (known limit, doc 03); `calibration` rows currently
require repeated consistent outcomes and are written sparingly — automation of that promotion is
future work.

## References

- `agent-service/nailed_agents/tools.py` — `record_action_outcome`, `record_round_verdict`,
  `search_memory`, `MEMORY_ACCESS`, `_decision_hypothesis`, `_score_memory`
- `agent-service/nailed_agents/orchestrator.py` — `_memory_hints` (deterministic pre-run injection)
- `supabase/migrations/0032_memory_v2.sql`
- ADR-0013 §3 (verdicts-not-metrics, live-tables-win) · ADR-0014 (inject-required / tool-optional)
