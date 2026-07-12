# 02 — Multi-Agent Architecture

## The claim we're prepared to defend

This is a real multi-agent system by the only test that matters: **remove any layer and behavior
degrades in a way you can name**. Remove the orchestrator's judgment → the team wastes money on full
weeks. Remove per-lane tool loops → decisions stop citing evidence. Remove the monitor's revision edge →
a mispriced campaign runs until a human notices. It is *not* a chat-room of agents talking to each other —
that was rejected deliberately (see "What we rejected").

## Anatomy of a round

One round, as it actually executed (run `e9a4ff93`, 2026-07-10, verifiable in `agent_runs`):

```
运营助手 (orchestrator, gemini-2.5-pro)
│  reads: get_merchant_insights + get_style_business_decisions  ← its OWN grounding, not hearsay
│  decides: capacity 33% very_idle → full growth plan; skip nothing this round
├─ dispatch: 数分 insight        (parent: orchestrator)   13:14:07
├─ dispatch: 选品 trend          (parent: insight)        13:14:22
├─ dispatch: 决策 decision       (parent: trend)          13:14:51   ← reads brain + memory, may override
├─ dispatch_many (PARALLEL, all started 13:15:34):
│    投广 ad (parent: decision) · 团购 coupon (parent: decision)
│    上下架 catalog (parent: insight) · 用户运营 customer_ops (parent: insight)
└─ dispatch: 监测 monitor        (parent: decision)       13:16:14
     └─ may request_revision(action, feedback) → ONE bounded re-run of an executor, parented to monitor
```

Every arrow is a row: runs are parented to their semantic upstream, so the merchant UI's lineage
(↑上游 / ↓下游 chips) renders the round *as it was decided*, including revisions, with zero UI code
written for it.

## The five load-bearing design decisions

### 1. Agents are data; runs are targeted (the Multica pattern, genuinely adopted)

An agent is a row: `{slug, name, role, instructions, tools[]}` (`agents` table, ADR-0007). A run is one
agent × one task. We studied Multica (`/home/tough/multica`) and took its *pattern* — agents-as-data,
an orchestrator dispatching targeted runs, transcript streamed to a dashboard, presence — and its
*frontend language* (tone-pill transcript rows, collapsible raw detail, presence dots). We did **not**
take its runtime: Multica's daemon runs coding-agent subprocesses over git repos; our substrate is a
Postgres bus and business tools. Porting it would have meant adopting a process manager, sandbox, and
issue model that map to nothing here (ADR-0007, reaffirmed ADR-0013).

Precision on what "data" controls, because we'd rather state it than have a judge discover it: the
`agents` row is the **registry and audit identity** (its `id` is what every `agent_runs` row points at)
plus the UI's metadata. It is deliberately *not* the runtime source of truth for the two things that
matter most:

- **Prompts** live in `agent-service/skills/*.md`; the row's `instructions` is a fallback for a missing
  file. Version-controlled prompts are PR-reviewed and pinned by the eval suite — a DB-edited prompt
  would change agent behavior with no diff, no review, and no eval run.
- **Tool allow-lists** live in one shared file (`src/mock/agent-tools.json`): the Python runner loads it
  as `LANE_TOOLS` for enforcement, the TS seed writes the same file into the row's `tools[]` for display,
  and parity tests pin both sides — the display copy structurally cannot drift from what the runner
  enforces. Allow-lists are legality, and legality lives in the repo, not in an editable DB row
  (ADR-0012) — a DB edit must never be able to hand the read-only insight agent `place_ad`.

Within its allow-list an agent chooses freely — which tools, what order, how many calls, what arguments.
The list itself is code. When agent configs become merchant- or ops-editable (multi-merchant stage), the
planned shape is DB-configured lists validated against a code-side ceiling (`configured ⊆ ceiling`,
refuse to boot on violation) — dynamic narrowing, never dynamic widening.

### 2. The orchestrator is an agent with dispatch tools — and code holds the leash

`run_round` (`agent-service/nailed_agents/orchestrator.py`) opens an orchestrator run whose tool loop
holds `dispatch_agent` / `dispatch_many`. The LLM decides **who runs and why**; a `RoundState` object
decides **whether it may**:

- lane whitelist (8 slugs — an invented agent name dies with `unknown_agent`),
- one dispatch per agent per round,
- a hard dispatch budget (`MAX_DISPATCHES_PER_ROUND = 8`),
- atomic validation of parallel batches (a bad batch runs nothing),
- and the dispatch tools **refuse any RunContext that doesn't carry a RoundState** — only the
  orchestrator's does, so a lane agent hallucinating a dispatch is refused before any side effect.

This is capability-based security in miniature: power is an object injected into exactly one context
(`RunContext.round`), not a permission string an LLM could talk its way past. The same pattern gates the
monitor's revision power (`RunContext.revision`, doc 05).

### 3. Judgment in loops, legality in code (the division of labor, ADR-0012 §5)

The single most important line we drew — and ADR-0016 moved it to its final position. Everything
that must be *correct* is deterministic code: arithmetic, forecast formulas, state machines, budget
caps, brief ceilings, allow-lists, transitions. Everything that must be *judged* is an LLM tool loop,
and the judgments now stack in layers: the engine emits **facts** (never verdicts — the `candidate`
output died when a review showed the decision agent restating it); 决策 turns facts into **Action
Briefs** (objective + hard boundaries, schema-enforced tool call); the **Risk Reviewer** judges the
brief portfolio for soft risk (conflicts, cannibalization, attribution — hard rules stay in code);
executors find their own parameters inside the brief through the ad sandbox's forecast loop — free to
choose audience/budget/duration, free to report the objective **infeasible** with forecast evidence,
never free to breach a ceiling (refused pre-side-effect). The eval pins each layer: a brief for the
underexposed earner and none for the below-floor style; broad traffic failing the CAC ceiling in
forecast and the agent finding retargeting itself; a conflicting portfolio drawing
`[REVISION_REQUIRED]` while a clean one draws `[APPROVED]` with no invented objections.

### 4. Deterministic context passing — no LLM copying

When the orchestrator dispatches 决策 after 选品, Python appends the upstream conclusion to the child's
task verbatim (`_run_lane`), and the round blackboard records each lane's conclusion as it lands. We do
not ask a model to faithfully paraphrase another model's output — that's a fidelity bug waiting to
happen. LLMs decide; Python moves data.

### 5. Model tiering is a measured decision, not a guess

Lanes run gemini-2.5-flash (single-purpose loops, 1–3 tool calls). The orchestrator runs
gemini-2.5-pro (`ORCHESTRATOR_MODEL`). This came from evaluation, not preference: flash **reliably
abandoned the multi-step dispatch chain after one tool call** — eval signature `('insight',)` on
repeated runs — and prompt hardening did not fix it; the model tier did (doc 06). The round's brain is
the one place the expensive model earns its cost; a round is one pro loop + up to eight flash loops.

## What we rejected, and why

| Alternative | Why rejected |
|---|---|
| **Fixed pipeline presented as "multi-agent"** | That's what we had first (a Python for-loop). A judge asks "what happens when the salon is full?" and the answer was "the same 8 runs". Indefensible; rebuilt as ADR-0013 P1 — the eval now pins that a 91%-utilization round must NOT dispatch the spend lanes. |
| **LangGraph / CrewAI / AutoGen** | Our runner (`runner.py`) is ~100 lines and drives both an Anthropic and an OpenAI-format backend over the same tool bodies. A framework would add a dependency and a debugging surface, and contribute nothing a judge scores — the judged behaviors (guardrails, grounding, lineage, memory) all live in *our* layer regardless. Pattern over framework. |
| **Free-form agent-to-agent messaging** | Unbounded token cost, loop risk, and non-reproducible demos. Interaction exists where it pays: dispatch (orchestrator→lane), deterministic context passing (lane→lane), one bounded revision edge (monitor→executor). Each is visible in the lineage tree; nothing coordinates invisibly. |
| **Porting Multica wholesale** | Wrong substrate (coding-agent daemon vs business-ops bus). Pattern adopted, runtime not. |
| **A message queue (Kafka/SQS) as the bus** | One writer (the Python service), one reader (the panel), demo scale. Supabase-as-bus means the panel reads the same rows the agents write, live, with zero new infrastructure. Revisit when rounds are concurrent across merchants. |

## Communication model (explicit, because judges ask)

Agents communicate through exactly three channels, all persisted and all visible:

1. **Dispatch results** — the child's conclusion returns to the orchestrator, verbatim.
2. **The round blackboard** (`agent_rounds.blackboard`) — each lane's conclusion, written
   deterministically by Python as lanes finish; readable by any lane via `read_blackboard`.
3. **Cross-round memory** (`agent_memory`) — windowed verdicts, written by 监测, read by 决策 (doc 05).

There is deliberately no fourth channel. If two agents need to "talk", the conversation is either a
dispatch, a blackboard section, or it shouldn't happen.
