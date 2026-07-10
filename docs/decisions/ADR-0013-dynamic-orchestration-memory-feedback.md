# ADR-0013 — Dynamic orchestration, cross-round memory, and a real feedback loop

Status: **Proposed** (2026-07-10) · Builds on ADR-0007 (agent team), ADR-0012 (action contract + decision brain)

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

运营助手 runs as an LLM tool-loop with `dispatch_agent(slug, task, parent_run_id)` and `read_run(run_id)`.
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

New `agent_memory` table: `{id, merchant_id, agent_slug, kind, key, content jsonb, evidence_run_id,
created_at, expires_at}`. Monitor's job changes from "write a verdict" to "write **measured outcomes**":
per campaign/deal — impressions, clicks, bookings, spend since launch; per coupon — redemption when the
data exists. 决策 gains `get_agent_memory` and reads last-round outcomes before deciding. Over rounds,
**measured ROAS replaces the estimated upper bound** in `ads.ts` (the honest-limit caveat retires with
data instead of a fabricated lift factor).

### 4. One bounded interaction edge: revision

监测 gains `request_revision(action_id, feedback)`: it can reject an executed/proposed action and
re-dispatch the executor **once** with the feedback attached ("预算超出上周实测 ROAS 支持的水平，降到
¥80/天"). Hard bound: one revision per action per round — an adversarial check, not a negotiation loop.
The revision run parents to the monitor run, so the ↑↓ lineage renders the interaction with zero UI work.

### 5. Proposal hygiene (the 25-条待确认 fix)

- `propose_listing` dedupes by `gapTag`: an existing proposed action for the same gap is updated, not
  duplicated.
- A new round **supersedes** the same agent's previous `proposed` set (expired → `undone`, audit kept).
- Merchant-configurable cap on pending proposals (default 5) joins the envelope policy alongside the ad
  budget cap. New-listing ideas originate from weekly-cadence sources (internal hot + external trends);
  the pending queue should never outrun that cadence.

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

## References

- ADR-0007 (agents-as-data, targeted runs — the substrate this keeps) · ADR-0012 (action contract,
  decision brain, division of labor §5)
- PM architecture: 商家运营 Multi-Agent 画板 (三业务线 × 数据收集→商业决策→动作, 监测回流)
- Owner audit 2026-07-10 (linear-orchestration critique) · Multica pattern study
  (`docs/plans/2026-07-10-merchant-ui-alignment.md` §Multica adoption decision)
- Code seams: `agent-service/nailed_agents/orchestrator.py` (the `_CHAIN` this replaces), `runner.py`,
  `bus.py`, `tools.py`, `agent-service/eval/agents_eval.py`
