# ADR-0010 — Evaluation methodology (model + system)

**Status:** Accepted (2026-07-02). **Aligns to:** GB/T 45288.2-2025 《人工智能 大模型 评测指标与方法》.
**Detailed docs (local):** `docs/eval/` (matching design, RAG eval report, multi-agent eval framework).

## Context

We make model and system decisions — which embedder/reranker (ADR-0008), which agent base model, whether
the agent team behaves correctly — that must be **defensible by measured evidence, not preference**, and a
technical mentor must be able to judge the approach. We adopted a standard-aligned method, but it was spread
across three working docs. This ADR **locks the methodology as a decision** so subsequent work has a fixed
bar to build against; the detailed reports/specs stay standalone in `docs/eval/`.

## Decision

**Follow the GB/T 45288.2 loop:** 评测对象 → 测试集 → 指标 → 标注 → 问题闭环.

**Two separate eval suites — different task types, never merged:**
- **RAG / matching = a retrieval eval** → IR metrics (**Recall@k, MRR, nDCG, P@1**) over a *graded-relevance*
  gold set; deterministic pipeline; automated scoring.
- **Multi-agent = an agentic eval** → a **capability matrix** (指令遵循 / 工具调用正确性 / 幻觉 / 结果稳定性 /
  意图理解 / 决策有效性 / 泛化 / 内容安全 / 多轮编排) over scenario cases; **eval-first** (spec precedes the build).

**Model choice = benchmark-shortlist + benchmark-corroborate; our task eval decides.** Benchmarks give
breadth + external validity (MTEB/C-MTEB for embed/rerank; BFCL / IFEval / τ-bench for agents); our own gold/
scenario set gives domain fit and is decisive. **Cost excluded when so instructed — decide on ability, break
ties on operational properties** (determinism, latency).

**Test set = a mix of sources** (Benchmark / 现网回流 / 人工编写 / 模型生成), phase-dependent; the **synthetic
dataset (ADR-0009) is the seed test set** for the agent suite (each planted scenario carries an expected behaviour).

**Judging is routed by objectivity:** automated deterministic checks for objective dimensions; **LLM-as-judge**
for open-ended quality (**blind + multi-judge + human spot-check**); human experts for high-risk / safety.

**Three blocking gates for the agent demo** (the agent auto-executes business actions, so a wrong
tool/target is as dangerous as a hallucination): **工具调用正确性 (=100% on core scenarios)**,
**幻觉/grounding (=0 on core, ADR-0006)**, and **结果稳定性 (4/4可靠性 ≥90%)**.

**Statistical honesty:** report only differences that exceed the **noise floor** (≈1/N resolution of the
gold set); disclose validity threats. **Closed loop:** mine failures from `agent_runs.transcript` → regression
set → track fix-rate.

## Design principles

- Benchmark = breadth/corroboration; own task eval = domain fit/decisive (benchmark is necessary, not sufficient).
- Separate suites per task type; share the *methodology* only.
- Decide by measured ability; break ties on operational properties; trust only supra-noise differences.
- Eval-first for the not-yet-built agent system.
- Grounding + stability are blocking gates, not footnotes.

## Alternatives considered

- **Ad-hoc / "vibes" model choice** — rejected: not defensible.
- **One merged eval for matching + agents** — rejected: different task types, metrics, failure modes.
- **Fold the detailed reports into this ADR** — rejected: ADRs stay short; the reports are standalone,
  mentor-facing artifacts (kept in `docs/eval/`).
- **Public benchmark as the primary application test set** — rejected: measures the model in isolation, not
  our pipeline/prompts/data.
- **LLM-judge as production scorer without controls** — rejected: nondeterministic; requires blind + multi-judge + human.

## Consequences

**Positive**
- Defensible, standard-aligned, mentor-reviewable; a **fixed bar to continue building against**.
- Reuses assets we already have: synthetic dataset (ADR-0009) + `agent_runs.transcript` as the eval substrate.
- Model choices (ADR-0008) are traceable to this method.

**Status of the harnesses**
- **RAG matching eval** built (`agent-service/eval/eval.py`).
- **Agent eval A+B+C** built (`agent-service/eval/agents_eval.py`): 5 blocking gates + blind multi-judge MOS
  (non-blocking) + a 问题闭环 regression log. `npm run eval:agents [-- --n 4 --judge]`.

**Negative / open**
- Gold/scenario sets are small / single-merchant → need **现网回流 + multi-annotator (κ)** + more planted scenarios.
- **Live transcript mining** — the 问题闭环 currently seeds from the harness's own runs; wire it to real `agent_runs.transcript`.
- **Numeric grounding** — the grounding gate covers style-ids only; add budget/price allow-listed from tool outputs.
- **Judge robustness** — MOS uses blind multi-judge with strict validation (errors tracked, not averaged as 0); still needs calibration + human-labelled anchors.
- The **platform-hot signal is TBD (ADR-0009)** — once designed, it needs its own eval slice.

## References

- Detailed docs (local): `docs/eval/2026-07-01-trend-matching-design.md`, `…-trend-matching-eval-report.md`,
  `…-multiagent-eval-framework.md` (+ `docs/eval/README.md` index).
- Standard: GB/T 45288.2-2025 (local PDF). Benchmarks: MTEB/C-MTEB, BFCL V4, IFEval, τ-bench, C-Eval/CMMLU.
- Related: ADR-0006 (grounded intelligence), ADR-0007 (agent team), ADR-0008 (model choice via this method),
  ADR-0009 (synthetic data = agent test set).
