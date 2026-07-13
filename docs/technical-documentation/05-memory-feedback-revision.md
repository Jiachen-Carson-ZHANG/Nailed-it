# 05 — Memory, Feedback, and the Revision Edge

The PM architecture draws a loop: 数据收集 → 商业决策 → 动作 → **监测回流**. Most agent demos draw that
arrow and never wire it. ADR-0013 P2/P3 is the wiring: measured outcomes flow back into the next round's
decisions, and the monitor can push back on this round's actions — both bounded, both visible.

## Round blackboard: shared state without shared chaos

`agent_rounds.blackboard` (migration `0030`) holds each lane's conclusion, keyed by lane, written
**deterministically by Python** as lanes finish — plus one structured section, `executions`: the
round's `agent_actions` rows (id, type, status, entity, payload), refreshed by code after each
executor lane concludes (ADR-0014). Reading is two-layer: context a lane *structurally needs* is
injected by Python before the run starts (`CONTEXT_POLICY` — 决策 always gets 数分+选品's
conclusions, 监测 always gets the plan and the execution list with real action ids); the read-only
`read_blackboard` tool is granted to 决策 and 监测 only, for mid-run consultation, never as the
carrier of required context. An external audit caught the original sin here: the tool existed but no
lane held it — a write-only blackboard — and the monitor had no path to the action ids its revision
tool required. Both are now wired and eval-tested through the same code path the live round uses.

Design deviation worth defending: the ADR draft gave agents *write* tools to the blackboard. We didn't
ship that. Writes are Python-side because the orchestrator already has every conclusion in hand — LLM
write access added nothing but write-conflict surface and a new hallucination sink. An LLM writes prose;
Python moves state. (Same principle as deterministic context passing, doc 02.)

## Cross-round memory v2: the agent judges, code anchors the evidence (ADR-0015)

The contract, rebuilt after a second external design review:

- **Raw metrics are never duplicated into memory.** Impressions/clicks/bookings/spend live in
  `style_ad_campaign` and the event tables — those are the truth, and **on any conflict the live table
  wins**. A memory system that shadows live data becomes a stale-data generator.
- **Predictions are snapshotted at execution time.** `place_ad`/`set_group_buy_coupon` embed the
  decision brain's expectation (`expectedRoas`, `costPerBookingCents`, …) into the action payload —
  code-derived from the brain's own output, never parsed from prose. That snapshot is what turns
  memory from *history* into *calibration*: "predicted 每单 80 元，measured 280 元 → ratio 3.5,
  cost underestimated" is computed by code at write time.
- **The model supplies only the judgment.** `record_action_outcome(action_id, assessment, confidence)`
  — everything identifying (domain, scope, entity, window, expiry) is derived from the action row, so
  a conclusion cannot be filed against the wrong campaign or given an invented observation window.
  Premature writes are refused (`observation_window_immature`) — un-measured actions are *pending* in
  prose, never verdicts. `record_round_verdict` additionally requires real action ids as evidence.
- **Writes are monitor-only; reads are domain-scoped** (`MEMORY_ACCESS`): 决策/监测 read broadly,
  analysts read their domains, and executors read **nothing** — history is synthesized into the plan
  by 决策; an executor re-interpreting strategy mid-execution would blur who decided what.
- **Retrieval is two-stage**: code injects deterministic *hints* (merchant preferences, latest round
  verdict, latest measured outcomes) into 决策's and the orchestrator's tasks before the run — recall
  never depends on the model remembering to fetch; then, once the agent knows *which* candidates
  matter, it digs with `search_memory` (structured relevance scoring: exact entity anchor > style >
  tag > domain — deterministic, eval-reproducible, no embeddings needed at this scale).
- Confidence drives expiry (high 30d / medium 14d / low 7d); re-measuring the same action **replaces**
  its row. Memory answers "what did we conclude", never becomes a log (the runs table is the log).

This is also the honest answer to the incrementality limit in doc 03: the estimated ROAS is an upper
bound *until* the loop produces measured outcomes, at which point the measurement wins. The demo line:
round N+1's 决策 opens with "上一轮实测说我们的每单成本被低估约 3.5 倍，本轮相应收紧预算".

## The revision edge: agents disagreeing, with a leash

`request_revision(action_id, feedback)` — the monitor rejects one of this round's actions and its
executor re-runs **once** with the feedback attached, parented to the monitor's run (the lineage tree
shows the pushback: 投广 → 监测 → 投广′).

**Bounds are code, not prompt text** (`RevisionPort`, `orchestrator.py`):

- injected ONLY into the monitor's `RunContext` — the tool refuses every other context (capability
  pattern, same as dispatch);
- one revision per action; `MAX_REVISIONS_PER_ROUND = 2`;
- only reversible, entity-backed actions (`place_ad`, `set_group_buy_coupon`) in `applied/proposed`
  state — **published deals and sent messages refuse** (`action_not_revisable`);
- the entity-transition contract: a revision **never forks a parallel entity**. Stable ids
  (`ad-<styleId>`, `gb-<styleId>`) make the executor's re-run an in-place upsert; the superseded action
  row flips to `undone`, the re-run writes its replacement, and the budget envelope re-applies (a revised
  budget above the cap lands as a draft, exactly like a fresh one).

**Why one bounded edge instead of free agent-to-agent negotiation:** negotiation loops are unbounded in
cost, unreproducible in demos, and unauditable in transcripts. One adversarial check captures the judged
behavior — an agent reacting to another agent's work with evidence — while staying deterministic enough
to pin in evaluation ("over-spending ad → exactly one revision"; "healthy ad → zero"). If a second
interaction edge ever earns its place, it gets the same treatment: a capability object, hard bounds, a
transition table, and an eval scenario before it ships.

## The skill-discipline finding (worth a judge's attention)

First eval runs of the monitor flaked in **both directions**: one run revised a perfectly healthy
campaign; another missed an obvious over-spender because the model fumbled `56000 ÷ 2` mid-reasoning.
The fix was not a better prompt vibe — it was **bright-line thresholds with a worked division example**
in the skill: revise iff (clicks ≥ 50 ∧ bookings = 0) or (budget > ¥100 ∧ spend-per-booking > ¥200),
compute the division explicitly before judging. After: both scenarios stable at 2/2.

The generalization we now apply everywhere: **cheap models get judgment only above bright lines that
code or explicit arithmetic can verify.** Where no bright line exists, either the model tier goes up
(the orchestrator) or the decision moves into deterministic code (the brain). "Use good judgment" is not
an instruction a flash-tier model can execute with money.
