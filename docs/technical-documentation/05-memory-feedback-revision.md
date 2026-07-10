# 05 — Memory, Feedback, and the Revision Edge

The PM architecture draws a loop: 数据收集 → 商业决策 → 动作 → **监测回流**. Most agent demos draw that
arrow and never wire it. ADR-0013 P2/P3 is the wiring: measured outcomes flow back into the next round's
decisions, and the monitor can push back on this round's actions — both bounded, both visible.

## Round blackboard: shared state without shared chaos

`agent_rounds.blackboard` (migration `0030`) holds each lane's conclusion, keyed by lane, written
**deterministically by Python** as lanes finish. Lanes read it via a read-only `read_blackboard` tool.

Design deviation worth defending: the ADR draft gave agents *write* tools to the blackboard. We didn't
ship that. Writes are Python-side because the orchestrator already has every conclusion in hand — LLM
write access added nothing but write-conflict surface and a new hallucination sink. An LLM writes prose;
Python moves state. (Same principle as deterministic context passing, doc 02.)

## Cross-round memory: verdicts, not metric dumps

The contract (`agent_memory`, tightened by external audit before implementation):

- **Raw metrics are never duplicated into memory.** Impressions/clicks/bookings/spend live in
  `style_ad_campaign` and the event tables — those are the truth, and **on any conflict the live table
  wins**. A memory system that shadows live data becomes a stale-data generator.
- A memory row is a **windowed verdict**: *"7 天实测 ROAS 2.1，决策估算 4.1 —— 高估约 2 倍"* — with
  `entity_type/entity_id`, `window_start/end`, `evidence_run_id` (the run that measured it), and a 30-day
  `expires_at`.
- `unique (merchant_id, kind, key)` — re-measuring the same campaign **replaces** the verdict. Memory
  answers "what did we conclude last time"; it never becomes a growing log (the runs table is the log).
- Kinds are whitelisted (`ad_outcome | coupon_outcome | round_verdict`) and validated in the tool.

**Write path**: 监测 calls `get_campaign_outcomes` (live metrics) and `record_memory` (verdict).
**Read path**: 决策's skill now starts with `get_agent_memory` — *measured verdicts outrank estimates*.
This is also the honest answer to the incrementality limit in doc 03: the estimated ROAS is an upper
bound *until* the loop produces measured outcomes, at which point the measurement wins. The demo line:
round N+1's 决策 opens with "上一轮实测说我们的 ROAS 估算偏高，本轮相应收紧预算".

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
