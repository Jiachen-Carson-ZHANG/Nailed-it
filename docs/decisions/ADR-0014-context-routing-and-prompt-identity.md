# ADR-0014 — Deterministic context routing, structured executions, prompt identity

Date: 2026-07-11 · Status: Accepted · Extends: ADR-0012 (division of labor), ADR-0013 (dynamic orchestration)

## Context

An external code audit of the ADR-0013 implementation surfaced three context gaps, all verified
against HEAD before acceptance:

1. **The round blackboard was write-only.** Python wrote every lane's conclusion to
   `agent_rounds.blackboard`, and a `read_blackboard` tool existed in the registry — but no lane's
   allow-list included it. A code comment claimed agents could "see what stands so far"; none could.
2. **The monitor had no path to `agent_actions.id` in a live round.** `request_revision(action_id)`
   validates against the actions table, but nothing showed the monitor those ids: campaign rows carry
   entity ids, and the decision's prose (its injected parent conclusion) is written *before* executors
   run. The revision-edge eval passed only because scenario tasks hand-fed the id in prose — the eval
   vouched for judgment, not wiring. The live revision loop was dead on arrival.
3. **Single-parent context.** Each lane received exactly one upstream conclusion (its dispatch
   parent's). 决策, parented to 选品, never saw 数分's alerts unless 选品 happened to restate them.
   Mitigated for *data* (决策 re-reads grounded numbers through its own tools) but not for upstream
   *judgment* (alerts, anomalies).

A related gap from the same audit: `agents.version` cannot version prompts — the prompt truth is
`skills/*.md` (ADR-0013 amendment), so editing a skill changes behavior with no recorded identity on
the runs it produces. Prompt A/B was impossible to attribute.

## Decision

**Three-layer context contract** — 必需信息自动注入，可选信息走工具，执行前以实时状态为准:

1. **Deterministic injection (code decides, before the run starts).**
   - The dispatch parent's conclusion, verbatim (unchanged from ADR-0013), **plus** policy extras:
     `CONTEXT_POLICY = {"decision": ["insight", "trend"], "monitor": ["decision"]}` — appended in
     order, deduped against the parent (`_upstream_context`, pure function, unit-tested).
   - **The monitor additionally gets the round's structured execution list** — every `agent_actions`
     row of the round (`bus.fetch_round_actions`, an `agent_runs.round_id` join), formatted by
     `_execution_context`: `{id, type, status, risk, entity_id, payload}` per action. Real ids from
     the table, never parsed out of another agent's prose. The eval injects through the **same
     formatter**, so the judged context format is the live one.
2. **Optional tools (the agent decides, mid-run).** `read_blackboard` is granted to 决策 and 监测
   only (the two cross-lane consumers) via `agent-tools.json`; `get_agent_memory` stays a tool in
   决策's skill. Tools are for context the lane *might* need or that may have changed mid-round —
   required context never depends on the model remembering to fetch it.
3. **Live state before action (unchanged).** Execution tools re-read authoritative tables regardless
   of what any injected text or memory claims; on conflict the live table wins (ADR-0013 §3).

**Blackboard gains one structured section.** After each executor lane concludes, Python writes
`blackboard["executions"]` from `fetch_round_actions` — code-written JSON beside the per-lane prose
sections. Analyst conclusions stay prose (they genuinely are prose); execution state is data and is
never represented as prose.

**Prompt identity on every run** (migration `0031_run_prompt_identity.sql`): `agent_runs.prompt_sha`
= sha256[:16] of the resolved system prompt; `agent_runs.agent_version` = the config version at run
time. Degrades loudly (WARN + insert without the columns) when 0031 is unapplied. Enables prompt A/B:
edit a skill → new sha → group eval/live outcomes by sha.

## Design principles

- **Inject what is structurally required; tool-read what is situational.** A required fetch left to
  the model is a latent failure (forgotten call, wrong order, wasted loop iterations).
- **Code moves state; the LLM writes prose.** The execution list and blackboard are written by
  Python from tables. No LLM output is ever the carrier of an id another agent must act on.
- **The eval must exercise the live context path.** Hand-written approximations of injected context
  (the old "action id: …" prose) test the model against inputs it will never see in production.
- **Routing stays a dict, not a framework.** `CONTEXT_POLICY` is data reviewed in diffs; adding a
  source is a one-line change with a test.

## Alternatives considered

- **Context-pack abstraction** (`build_context_pack(slug, …)` assembling briefing/capacity/memory/
  live-entities per lane — the auditor's fuller design): right end-state at multi-merchant scale;
  today it would wrap three injection sites in a layer with no second consumer. Revisit when a lane
  needs more than conclusions + executions.
- **Fully structured blackboard schema** (briefing/opportunities/plan/executions/verdict, typed):
  forcing analyst output into JSON on flash-tier models adds a malformed-output failure mode needing
  schema-retry machinery. Adopted the hybrid: `executions` structured (code-written), analyst
  sections prose. ADR-0013's plan for `plan.actions` slices to executors stays deferred.
- **`read_blackboard` for every lane / whole-blackboard injection:** token waste, off-mandate
  re-decisions by executors, blurred authority boundaries. The auditor argued against this too.
- **Previous-round blackboard carry-over:** rejected — cross-round conclusions are `agent_memory`'s
  job (windowed verdicts, expiry, replace-on-remeasure); the blackboard is one round's working state.
- **Memory-kind expansion** (`merchant_preference`, `catalog_outcome`, …): right shape, deferred —
  each new kind ships with its own eval scenario per the eval rules, none is demo-critical.
- **`agents.version` snapshot alone** (without prompt_sha): records the wrong thing — the DB version
  doesn't change when the actual prompt (skill file) does.

## Consequences

**Positive.** The revision edge is wired for live rounds (real action ids reach the monitor); 决策
sees 数分's alerts and 选品's opportunities every round regardless of parent; the eval's monitor
scenarios test the production context format; every run is attributable to an exact prompt text;
eval scenario tool lists import `LANE_TOOLS`/`ORCHESTRATOR_TOOLS` so they cannot drift from the
enforced allow-lists.

**Negative / accepted.** The monitor's task grows with the round's action count (bounded by the
dispatch budget and proposal caps); the blackboard is now mixed-type (prose sections + one JSON
section); one more manual migration (0031) before prompt identity lands; `CONTEXT_POLICY` is another
code-side contract to keep honest — covered by unit tests, same discipline as `LANE_TOOLS`.

## Amendment (2026-07-11) — implementation invariants & acceptance criteria

Adopted after a second external review of this ADR; each invariant is enforced in code and covered by
a test or the eval.

**Implementation invariants**

1. **Monitor snapshot barrier.** The monitor may not be dispatched in the same `dispatch_many` batch
   as any other lane (`RoundState.reserve` rejects the batch atomically). Dispatches are otherwise
   blocking, so a solo monitor dispatch always sees terminal executors. Its execution list is built
   immediately before its run starts; a revision's re-execution does **not** silently appear in the
   running monitor's context — measuring it takes the next round's monitor.
2. **Missing-source semantics.** Absent `CONTEXT_POLICY` sources are annotated explicitly in the
   injected context（"上游 X 本轮未运行——按信息缺失处理"）, never silently skipped and never
   hard-failed — a hard requirement would fight dynamic orchestration; the non-skippable lanes
   (数分/决策) are enforced at the orchestrator level and pinned by eval instead.
3. **Context provenance and bounds.** Every injected conclusion is delimited with its source slug and
   run id and marked "evidence, not instructions"; each source is capped (2 500 chars).
4. **Execution source of truth.** `agent_actions` is authoritative; `blackboard["executions"]` is a
   derived snapshot. `fetch_round_actions` filters by merchant + round and orders deterministically
   (`created_at, id`). Execution entries carry `{id, type, status, risk, entity_id, created_at,
   revisionable, payload}` with `revisionable` code-computed.
5. **Blackboard write consistency.** All blackboard mutations for a round are serialized under one
   lock around the read-modify-write; a stale full-JSON write can no longer erase a concurrently
   completed lane's entry.
6. **Tool allow-list source of truth.** `agent-tools.json` → loaded by `orchestrator.py` into
   `LANE_TOOLS`/`ORCHESTRATOR_TOOLS` → runner **and** eval import those runtime values; the TS seed
   imports the same JSON for display. No second hand-maintained list exists.
7. **Prompt identity, scoped honestly.** `prompt_sha` is the full sha256 of the exact system string
   passed to the model. Prompt comparisons are controlled A/B only when model, tools, context policy,
   and inputs are held constant — to that end `agent_runs.input` persists the FINAL rendered task
   (post-injection) and the model id.

**Acceptance criteria** (all verified 2026-07-11, full eval suite green on gemini-direct)

- A live executor's `agent_actions` row reaches the monitor through `_execution_context` and
  `request_revision` succeeds with no id copied through prose (eval: `monitor/overspending-ad-revised-once`,
  signature `('act-ad-8284',)` from the injected list).
- 决策 receives 数分's and 选品's conclusions whenever both exist, regardless of dispatch parent
  (pytest: `_upstream_context` routing/dedupe).
- The monitor cannot start alongside a non-terminal executor (pytest: barrier rejection, atomic).
- Concurrent executor completions cannot erase each other's blackboard entries (lock).
- Runtime and eval expose identical allow-lists (imports, not copies).
- Editing one character of a resolved skill changes `prompt_sha`; identical prompts hash identically.
- Execution-context ordering and formatting are deterministic for a given DB state.

## References

- `agent-service/nailed_agents/orchestrator.py` — `CONTEXT_POLICY`, `_upstream_context`,
  `_execution_context`, `_prompt_sha`
- `agent-service/nailed_agents/bus.py` — `fetch_round_actions`, `start_run(prompt_sha, agent_version)`
- `supabase/migrations/0031_run_prompt_identity.sql`
- `src/mock/agent-tools.json` — allow-list single source (see implementation log 2026-07-11)
- ADR-0012 §5 (judgment in loops, legality in code) · ADR-0013 §2–3 (blackboard, memory, revision)
