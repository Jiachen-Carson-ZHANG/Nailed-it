# ADR-0013 — Dynamic orchestration, cross-round memory, and a real feedback loop

Status: **Accepted** (2026-07-10 P0+P1 · 2026-07-11 P2+P3 implemented — live round pending migration 0030 + OpenRouter credits) · Builds on ADR-0007, ADR-0012

## Context

What exists is stronger than a chain but weaker than a team:

- **Real per-agent tool loops** (ADR-0007): each step is a multi-turn LLM loop with its own skill +
  tool allow-list. Live evidence: 决策 called two tools, cross-referenced the briefing, and overrode the
  deterministic brain on two styles with cited numbers.
- **Real entities** (ADR-0012): actions create campaigns/deals with undo, budgets, and audit links.
- **But the orchestration layer is a fixed Python pipeline** (`orchestrator.py` `_CHAIN`: 数分 → 选品 →
  决策 → 投广 → 团购 → 上下架 → 用户运营 → 监测 → 数分'). Every agent runs every round in the same
  order; nothing is skipped, nothing runs in parallel, no agent reacts to another.
- **监测回流 is drawn, not wired.** The PM architecture (商家运营 Multi-Agent 画板) routes 款式数据监控
  back into 商家款式数据分析. In code, Monitor ends at a re-baseline read; its verdict influences nothing.
- **Zero memory.** Round N knows nothing round N−1 learned. The ad gate's `expectedRoas` stays an
  estimate forever because measured outcomes are never stored.
- **Proposal pileup.** 上下架 re-proposes the same gaps every round and old proposals never expire —
  25 pending 上架建议 accumulated across demo rounds.

Owner's audit (2026-07-10): "this is just a linear agent … not even multi-agent … nothing related to
memory, nothing related to interaction." Correct about the orchestration layer; the per-agent loops and
entity substrate are real and are kept.

## Decision

Rebuild the **orchestration layer only** in `agent-service/` (Python, per the project convention).
The bus, runs/actions tables, entity contract, tools, decision brain, and all UI (lineage, presence,
transcripts) are reused unchanged.

### 1. Orchestrator becomes an agent with dispatch tools

运营助手 runs as an LLM tool-loop with `dispatch_agent(agent, task, parent)` and `dispatch_many`
(parallel batch). A dispatch is synchronous and returns the child's conclusion, so no separate
`read_run` tool is needed — the earlier draft's `read_run` was dropped in implementation.
It reads the briefing and **decides which lanes to wake**: full capacity → skip 投广/团购; no trend
movement → skip 选品; nothing to monitor → skip 监测. Independent dispatches run in parallel
(选品 ∥ 数分-adjacent reads; 投广 ∥ 团购 ∥ 用户运营). Skip decisions are written to the transcript with
reasons — the lineage UI renders "why this agent did not run" for free.

Deterministic guardrails stay in Python (division of labor, ADR-0012 §5): whitelisted dispatch targets,
at most one dispatch per agent per round, a per-round dispatch budget, hard wall-clock timeout, and the
existing per-agent tool allow-lists. The LLM chooses *which*; code enforces *whether it may*.

### 2. Round blackboard (shared state)

New `agent_rounds` table: `{id, merchant_id, status, blackboard jsonb, started_at, finished_at}`;
`agent_runs.round_id` FK. Agents read/write named sections (`briefing`, `opportunities`, `plan`,
`executed`, `verdict`) via `read_blackboard` / `write_blackboard` tools instead of chasing run-id refs
through prompts. The blackboard IS the round's working memory; the transcript stays the audit trail.

### 3. Cross-round memory (监测回流, executable)

New `agent_memory` table: `{id, merchant_id, agent_slug, kind, key, content jsonb, entity_type,
entity_id, window_start, window_end, evidence_run_id, created_at, expires_at}`, unique on
`(merchant_id, kind, key)` so re-measurement upserts rather than stacks.

**Memory never duplicates or overrides live facts** (audit 2026-07-10 #2): raw impressions / clicks /
bookings / spend stay sourced from `style_ad_campaign` and event tables — those are the truth. Monitor
writes **derived verdicts over an explicit window** ("campaign ad-8274, 7d window: measured ROAS 2.1 vs
estimate 4.1; verdict: overestimated ×2"), each row citing its entity, window, and evidence run, with an
expiry. 决策 gains `get_agent_memory` and reads last-round verdicts before deciding; where a measured
verdict exists it outranks the `ads.ts` estimate — the honest-limit caveat retires with data instead of
a fabricated lift factor. A conflict between memory and a live table is resolved by the live table,
always.

### 4. One bounded interaction edge: revision

监测 gains `request_revision(action_id, feedback)`: it can reject an executed/proposed action and
re-dispatch the executor **once** with the feedback attached ("预算超出上周实测 ROAS 支持的水平，降到
¥80/天"). Hard bound: one revision per action per round — an adversarial check, not a negotiation loop.
The revision run parents to the monitor run, so the ↑↓ lineage renders the interaction with zero UI work.

**Entity transition contract** (audit 2026-07-10 #4) — a revision NEVER forks a parallel entity; the
stable entity ids (`ad-<styleId>`, `gb-<styleId>`) make the executor's re-run an in-place upsert:

| entity state before | revision effect on entity | old action row | new action row |
|---|---|---|---|
| style_ad `active` | upsert same campaign (new budget); envelope re-applies (over-cap → `draft`) | `undone` (superseded) | written by the re-run, same `entity_id` |
| style_ad `draft` | upsert same campaign draft | `undone` (superseded) | same `entity_id` |
| groupbuy `draft` | update the same deal via `proposeGroupbuyForStyleAction` (stable id) | `undone` (superseded) | same `entity_id` |
| groupbuy `published` | NOT revisable — the merchant published it; monitor may only *recommend* unlist | unchanged | none |
| any irreversible action (message sent) | NOT revisable | unchanged | none |

### 5. Proposal hygiene (the 25-条待确认 fix)

The implemented contract is **supersede → in-run dedupe → cap**, in that order (audit 2026-07-10 #3
flagged the earlier "update in place" wording — this is the authoritative semantics):
- The run's FIRST `propose_listing` expires all older-round pending proposals (`undone`, audit kept).
- Within the run, a repeated `gapTag` is skipped (post-supersede, in-run tags are the only live set, so
  this IS the dedupe — no cross-run update-in-place needed).
- The count is capped at `MAX_PENDING_PROPOSALS` (default 5, merchant policy later); the tool errors
  with `proposal_cap_reached` so the loop stops proposing.
- No keyed-upsert RPC: the Python service is the single writer and the dispatch guardrail allows one
  catalog run per round, so there is no concurrent-writer race to defend against. If a second writer
  ever appears, revisit with a `(merchant_id, type, payload->>gapTag, status)` upsert.

### Schema

Migration `0030_agent_rounds_memory.sql`: `agent_rounds`, `agent_memory`, `agent_runs.round_id`
(nullable — old runs keep rendering). Manual apply, as always.

## Design principles

- **Judgment in loops, legality in code.** The orchestrator chooses; Python bounds (whitelists, caps,
  single-revision, timeouts). Same split that made the decision brain defensible.
- **Memory is structured rows with evidence links**, not prompt-stuffed history. Every memory row cites
  the run that produced it.
- **Every interaction must be visible.** Dispatch reasons, skips, and revisions are transcript steps and
  parented runs — the existing lineage/presence UI is the renderer. No invisible coordination.
- **Bounded nondeterminism.** The orchestrator skill prescribes the default full plan; deviation requires
  a citable signal (capacity band, empty opportunity list). Eval scenarios pin the skip/dispatch logic.

## Alternatives considered

- **Keep the fixed chain, present it as multi-agent.** Rejected — a judge asks "what happens when the
  salon is full?" and the answer today is "the same eight runs". Indefensible.
- **Port Multica's runtime.** Rejected already in ADR-0007: its daemon runs coding-agent subprocesses
  over repos; our substrate is a Supabase bus + business tools. We adopt its *pattern* (dynamic targeted
  dispatch, presence, queue) — now genuinely, since dispatch becomes a decision.
- **Free-form agent-to-agent messaging.** Rejected: unbounded cost and loop risk, non-reproducible demos.
  One bounded revision edge captures the judged behavior (agents reacting to agents) without the chaos.
- **Adopt LangGraph/CrewAI.** Rejected: the runner already does tool loops well; a framework adds a
  dependency layer without adding any behavior a judge scores. Pattern over framework.

## Consequences

**Positive.** Demo story upgrades from pipeline to team: rounds that *skip* lanes with reasons, parallel
execution, a monitor that pushes back, and a decision agent that quotes last week's measured outcomes.
Measured ROAS closes ADR-0012's honest limit. Proposal queue stays sane. All of it renders in existing UI.

**Negative / risks.** Rounds become nondeterministic (mitigated by skill-prescribed defaults + eval
scenarios for dispatch decisions); more model calls per round (bounded by the dispatch budget; skips
often make rounds *cheaper*); two new tables; revision adds a failure mode (executor re-run fails —
bounded to one attempt, run finalizes `failed` visibly).

## Phasing

- **P0** — proposal hygiene (§5). Small, immediate, fixes a visible demo wart.
- **P1** — orchestrator-as-agent: dispatch/skip/parallel + eval scenarios ("full capacity → 投广/团购 not
  dispatched", "empty trends → 选品 skipped").
- **P2** — `agent_rounds` + `agent_memory`; monitor writes measured outcomes; 决策 reads them.
- **P3** — revision edge + eval ("over-budget ad → exactly one revision dispatch").
- UI later (optional): group 最近运行 by round; blackboard viewer on the run page.

## Amendments (2026-07-10 — P0+P1 implementation)

- **Orchestrator runs a stronger model** (`config.ORCHESTRATOR_MODEL`, default gemini-2.5-pro on
  OpenRouter / sonnet on Anthropic; lanes stay on `AGENT_MODEL`). Flash-tier models reliably abandoned the
  multi-step dispatch chain after one tool call — prompt hardening did not fix it; the model tier did.
  The round's brain is the one place the stronger model earns its cost.
- **Two lanes are non-skippable** (数分, 决策) — without data and a decision the round has no basis; the
  skill and eval both pin this after a flash run skipped everything.
- **Reply protocol** in the skill: no interim prose until all dispatches are done (the OpenAI-format loop
  treats a text-only reply as the final answer).
- **Eval layering** (audit 2026-07-10 #5): LLM eval covers what the MODEL decides (skip/dispatch
  choices); code-enforced guarantees (dispatch budget, one-dispatch-per-agent, whitelist, batch
  atomicity) are pytest unit tests against the real RoundState — deterministic properties don't need
  model runs to prove.
- **Eval**: two orchestrator scenarios drive the REAL RoundState guardrails with canned lane conclusions —
  `full-capacity-skips-spend` (must NOT dispatch ad/coupon at 91% utilization) and
  `dispatches-chosen-lanes` (ad yes / coupon no per the decision text). Signatures pin only the judged
  lanes; optional lanes may legitimately vary.
- **Live round evidence**: orchestrator read insights+decisions itself, dispatched 8 lanes with cited
  reasons (ROAS >3.8, exposureRatio <0.76, 产能 33%), fanned ad/coupon/catalog/customer_ops out in
  parallel (all started the same second), semantic lineage intact (trend→insight, decision→trend,
  executors→decision), and P0 cut pending 上架建议 from 25+ to exactly 5 (cap) with older rounds
  superseded.

## Amendments (2026-07-11 — P2+P3 implementation)

- **Blackboard writes are deterministic** (deviation from the §2 draft): lanes conclude → the Python
  orchestrator writes `blackboard[slug] = conclusion`; agents get a read-only `read_blackboard` tool.
  LLM write access added nothing but write-conflict surface.
- **Revision is monitor-held, not orchestrator-mediated**: `RevisionPort` is injected only into the
  monitor's RunContext (same pattern as the orchestrator-only `RoundState`); its re-dispatch parents to
  the monitor run and bypasses the one-per-agent rule under its own bounds (one revision per action,
  `MAX_REVISIONS_PER_ROUND = 2`, only reversible entity-backed place_ad / set_group_buy_coupon in
  applied/proposed state).
- **Bright-line revision thresholds** in the monitor skill (flash-tier lanes need arithmetic spelled
  out): revise only if (a) clicks ≥ 50 with zero bookings, or (b) daily budget > ¥100 AND measured
  spend-per-booking > ¥200 — with a worked division example. Before this, the monitor flaked in both
  directions (trigger-happy on healthy ads / arithmetic miss on overspenders); after, both eval
  scenarios ran 2/2 stable.
- **Verification status**: pytest 36/36 (revision guardrails, memory upsert shape, registry parity).
  Eval: monitor scenarios 2/2 stable; orchestrator scenarios were 2/2 stable pre-credit-exhaustion —
  the full-suite rerun + live P2/P3 round are blocked on OpenRouter credits and migration `0030`.

## References

- ADR-0007 (agents-as-data, targeted runs — the substrate this keeps) · ADR-0012 (action contract,
  decision brain, division of labor §5)
- PM architecture: 商家运营 Multi-Agent 画板 (三业务线 × 数据收集→商业决策→动作, 监测回流)
- Owner audit 2026-07-10 (linear-orchestration critique) · Multica pattern study
  (`docs/plans/2026-07-10-merchant-ui-alignment.md` §Multica adoption decision)
- Code seams: `agent-service/nailed_agents/orchestrator.py` (the `_CHAIN` this replaces), `runner.py`,
  `bus.py`, `tools.py`, `agent-service/eval/agents_eval.py`
