# RAG matching eval harness (ADR-0010 / docs/eval report)

Replayable artifacts for the trend→catalog model-selection study.
- `concepts.json` — 32 cached hero VLM concepts (the corpus; deterministic).
- `eval.py` — gold set (inline) + IR metrics + per-provider embed/rerank; prints the scored tables.
- `caption_catalog.py` — regenerates `concepts.json` from the live catalog (needs OpenRouter).
- `real_pinterest_check.py` — matches live Pinterest trends against the catalog.

Run:  `cd agent-service && PYTHONPATH=. .venv/bin/python eval/eval.py`
Keys: GEMINI_API_KEY, OPENROUTER_API_KEY, COHERE_API_KEY (per provider tested).

## Agent eval (Phase A + B + C)
`agents_eval.py` — per-agent scenario harness (framework: docs/eval multi-agent). Stubs
`bus.fetch_*`/`write_action` (deterministic, no dev server; forces OpenRouter), runs the real tool-call
loop `--n` times, scores **five blocking gates**:
1. **tool-call correctness** — from the `RunContext.tool_attempts` recorder (attempted calls incl. invalid
   args / off-allow-list, not just executed) + target-exists (style_id ∈ fixture, customer_name ∈ roster).
2. **scenario expectation** — read agent → opportunity in tool output; action agent → captured `agent_action`
   of the right type + **exact** target field (per action_type).
3. **negative assertion** — a forbidden action/target must NOT occur (e.g. don't delist the low-conv style).
4. **grounding (narrow)** — every style-id cited in final text / reasoning / actions traces to fixture/tool
   output (numeric grounding deferred).
5. **4/4 stability** — the structured decision signature (prose excluded, kind-aware) is identical across runs.

Run: `npm run eval:agents` (= `cd agent-service && PYTHONPATH=. .venv/bin/python eval/agents_eval.py`; add `-- --n 4`).
Needs `OPENROUTER_API_KEY` only.

Scenarios: `trend/8284` (read), `customer_ops/lapsed-rachel` (action), `catalog/dead-8277` (action, grounded
via `get_catalog_actions`). The verdict is a real gate — a FAILURE means the current agent isn't demo-ready, not
that the harness is broken.

**Phase C (`--judge`, non-blocking):** blind multi-judge MOS (1-5, gemini-2.5-flash + gpt-4o, forced JSON) on
the open-ended output (准确性/完整性/实用性/安全性); judge parse/infra failures are tracked separately (never
averaged as 0). Low avg (<3.5), judge disagreement (≥1.5), or a judge error → **⚑ human-review**.
**问题闭环:** any blocking-gate failure **or any human-review flag** (incl. disagreement / judge-error) is
appended to `eval/regressions.jsonl` (gitignored) as a **replayable** seed — capturing the representative
(first-failing) run's task, fixture, final output, actions, tool attempts, raw judge outputs/errors, and a
failure category. Run: `npm run eval:agents -- --n 4 --judge`.
