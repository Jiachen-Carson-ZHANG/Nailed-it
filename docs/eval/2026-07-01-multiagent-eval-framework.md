# Evaluation Framework for the Merchant Operations Agent Team (ADR-0007)
### An eval-first specification, built on GB/T 45288.2-2025
Author: Nailed-it engineering · Date: 2026-07-01 · Audience: engineering + mentor review
Status: FRAMEWORK (eval-first — defines the acceptance criteria *before* the system is finished)

---

## 0. Why this is a *separate* eval from the RAG-matching study

Different task type → different everything. The [trend-matching eval](2026-07-01-trend-matching-eval-report.md)
is a **retrieval** eval (does it rank the right styles? — IR metrics, deterministic pipeline). This is an
**agentic** eval (does the team *reason*, *decide*, and *act* correctly on grounded data? — capability
metrics, nondeterministic LLMs). They share only the **methodology** (GB/T 45288.2 loop) and harness pattern.

> **Eval-first rationale.** The agent system is partly built (ADR-0007 Phase 3b). We define the target
> *now* so the remaining build has a measurable bar to pass, and so we don't retrofit a flattering eval.

## 1. 评测对象拆解 — decompose the object (the standard's first step)

The team is the chain 数分 → 选品 → 决策 → 投广 → 团购 → 运营(上下架) → 用户运营 → Monitor → 数分'. We split
capabilities two ways, exactly as GB/T's 评测对象示例 (行业能力 + 通用能力):

**行业能力 (business/domain correctness — per agent):**
| agent | correct behaviour to verify |
|---|---|
| 数分 insight | briefing headline/alerts/focus grounded in the read model (no invented metrics) |
| 选品 trend | amplify/price_test/gap/prune correct *given* the matcher output (matcher quality is the RAG eval) |
| 决策 decision | picks a *valid, justified* place_ad + set_group_buy_coupon from briefing + trend report |
| 投广/团购/运营/用户运营 | executes the right tool with schema-valid args on the intended style/customer |
| Monitor | measures lift on the acted styles, or records a truthful baseline if no window |

**通用能力 (general — from GB/T §三, applied to agents):**
指令遵循 · 意图理解 · 泛化性 · 结果稳定性 · 幻觉 · 内容安全 · 工具调用正确性 · 多轮/编排一致性.

## 2. Capability matrix — the core (dimension × metric × method)

| capability | what it means here | metric | method |
|---|---|---|---|
| **指令遵循** | stays in its tool allow-list; obeys skill hard-rules (e.g. customer_ops *must* call send_customer_message) | 指令遵循率 = runs obeying all constraints / total | automated (deterministic check) |
| **工具调用正确性** | tool name + args schema-valid, on the intended target | tool-call accuracy (BFCL-style AST/schema check) | automated |
| **幻觉** | cites a number/style/trend absent from the grounded input | 幻觉率 = runs with an ungrounded claim / total | automated grounding check + LLM-judge |
| **结果稳定性** | same input → consistent decision across runs | 结果一致率; **4/4可靠性** | automated (repeat runs) |
| **意图理解** | correctly reads the briefing/task intent | 意图正确率 | LLM-judge + human |
| **行业决策有效性** | the chosen action is valid + defensible for the scenario | 决策有效率 (valid+justified / total) | rubric + human |
| **泛化性** | holds across merchants + planted scenarios | per-scenario pass-rate | automated + human |
| **内容安全** | boss-message appropriate; no PII/secret leak; neutral on sensitive topics | 内容合规率 | LLM-judge (safety) + human gate |
| **多轮/编排一致性** | context passes correctly down the chain (briefing→decision→execute; parent_run_id) | chain-consistency rate | automated (transcript trace) |
| **开放式输出质量** | briefing insight, customer message quality | MOS 量表 (准确/完整/实用/安全, 1–5) | LLM-judge + human, blind |

## 3. Metrics — definitions

- **指令遵循率** = (runs where every skill/tool constraint held) / (total runs).
- **工具调用正确性** = (tool calls with valid name **and** schema-valid args **and** correct target) / (total tool calls).
  Objective, AST/JSON-schema checkable — the BFCL approach applied to *our* tool set.
- **幻觉率** = (runs asserting a metric/entity not present in the grounded briefing/trend input) / (total).
  Directly operationalizes ADR-0006 ("act on grounded numbers, never invent"). Automatable: extract numbers
  /style-ids from the output, verify each exists in the input.
- **结果稳定性**: 结果一致率 = (inputs whose repeated runs give the same decision) / (total); **4/4可靠性** =
  (inputs correct on 4 consecutive runs) / (total) — the demo-safety gate (OpenAI used 4/4 for o3).
- **决策有效率** = (actions that are schema-valid **and** justified by the scenario signals) / (total).
- **MOS** = mean of graded (1–5) human/LLM-judge scores on defined dimensions, for open-ended outputs.

## 4. Test-set construction (GB/T source mix)

The standard mandates a **mix** of sources, not one hand-made set:

1. **Scenario cases (人工编写, planted).** Our synthetic data already plants scenarios (winner / low-conv /
   gem / declining / vanity / dead / near-tie). Each becomes a case with an **expected behaviour**, e.g.
   *"declining style X → must appear in prune or price_test"*, *"winner Y → must be amplified"*,
   *"most-lapsed customer → must receive a message"*. These give objective pass/fail.
2. **现网回流 (transcript replay).** `agent_runs.transcript` is the 全链路日志 — replay real past runs, mine
   failures, promote them into the regression set. Dominant source once the system runs (~50%+).
3. **Adversarial / edge (人工编写).** Ambiguous briefings, conflicting signals, empty/1-row data, a merchant
   with no gaps — to test robustness + 主动交互 (does the agent degrade sanely, not hallucinate?).
4. **模型生成 (泛化).** Paraphrased tasks / reordered briefings (说法泛化, 指令泛化) to test the agent isn't
   brittle to phrasing.

Each case carries: input (briefing/roster/trend state), the target agent(s), and the **expected behaviour**
(objective assertion where possible; rubric where open-ended).

## 5. Base-model selection — where benchmarks come in

The agents run on a base LLM (provider seam `MODEL_PROVIDER`: OpenRouter `google/gemini-2.5-flash` default;
Anthropic `claude-*` optional). Benchmarks **shortlist + justify** the base model; our scenario eval decides:

- **工具调用 → BFCL V4** (gorilla.cs.berkeley.edu) — the standard for function calling; **Claude family tops
  it** (Opus 4.5 ≈77%, Sonnet 4.5 ≈73%; GPT-5 ≈59%, 7th). Tool-call reliability is central to our agents, so
  BFCL is a strong input — it argues for Claude if tool-call accuracy is the bottleneck (our provider seam
  already supports it).
- **指令遵循 → IFEval**; **agentic multi-step → τ-bench / AgentBench**; **Chinese → C-Eval / CMMLU**.
- **Justification pattern:** pick base model M; cite M's BFCL/IFEval standing (breadth); confirm on *our*
  tool set + scenarios (fit). Cost/latency then breaks ties (as in the RAG study). Benchmark ≠ sufficient —
  it measures the model in isolation, not our prompts/tools/data.

## 6. Evaluation methods — automated vs LLM-judge vs human (GB/T §2.2)

Route each capability to the cheapest sufficient method (the standard's tradeoff table):

- **Automated (deterministic, high consistency):** 工具调用正确性, 指令遵循, 幻觉 grounding-check, 稳定性,
  链路一致性. These are objective → script them; run on every build.
- **LLM-as-judge (Model-Based, scalable, some nondeterminism):** open-ended quality (briefing insight,
  message tone), 意图理解. Use **blind** (hide which build produced which) + randomized order; multi-judge
  cross-check; **always with human spot-check** (LLM judges can hallucinate — the standard flags this).
- **Human expert (small-sample, high-stakes):** 内容安全 final gate, disputed cases, milestone sign-off.
  Use **2–3 annotators + Cohen's κ** on the subjective dimensions.

## 7. Result stability — the demo-safety gate

Unlike the RAG matcher (deterministic), agents use temperature-driven LLMs → nondeterministic. Stability is
therefore a **first-class, blocking** metric here:
- **4/4可靠性 ≥ 90%** on the core scenario set before any demo/milestone.
- Reduce variance operationally: low temperature for decision steps, structured-output constraints, and
  deterministic tool bodies (already the case). Measure, don't assume.

### Three blocking gates (must pass before a demo/milestone)
Because the agent **auto-executes business actions** (place_ad, coupon, message), a wrong tool/target is as
dangerous as a hallucination — so tool-call correctness is a blocker too (audit #2):
1. **工具调用正确性 = 100%** on core scenarios (right tool, schema-valid args, right target).
2. **幻觉率 = 0** on core scenarios (every number/style-id/trend traces to a grounded input; §8).
3. **4/4可靠性 ≥ 90%** on core scenarios (stability; above).
Non-blocking quality metrics (决策有效率, MOS, 泛化, coverage) are tracked but don't gate the demo.

## 8. Grounding / hallucination — tie to ADR-0006

ADR-0006's core principle ("agents act on grounded numbers, never invent") *is* the anti-hallucination
contract. The 幻觉率 metric makes it measurable: every metric/style-id/trend in an agent's output must trace
to its grounded input (briefing/trend report/roster). Automatable as a post-hoc check over the transcript.

## 9. 问题挖掘 → 分析 → 闭环 (continuous, off the transcript)

- **挖掘:** mine failures from `agent_runs.transcript` (the 全链路日志), plus 点踩/内测 feedback.
- **分析:** localize — is it the base model, the skill/prompt, the tool, or the grounded data? (Full-chain
  trace makes this possible.)
- **闭环:** promote each failure into the scenario regression set; track 修复率 across model/prompt/tool
  changes. Converts eval from one-shot to continuous, as the standard requires for the iteration phase.

## 10. How this drives the build (eval-first) + reproducibility

- The **capability matrix (§2) is the acceptance spec**: the agent build is "done" when it clears the three
  blocking gates (§7: 工具调用正确性 = 100%, 幻觉率 = 0, 4/4可靠性 ≥ 90% on core scenarios) **and** all planted
  scenarios pass. (Targets are the initial bar; tighten as the scenario set grows via 现网回流.)
- **Harness — Phase A+B built** (`agent-service/eval/agents_eval.py`, run `--n 4`): per-agent scenarios over
  stubbed `bus.fetch_*`/`write_action`; runs `runner.run_agent` N× and scores **five blocking gates** —
  (1) tool-call correctness from the `RunContext.tool_attempts` recorder (captures *attempted* calls incl.
  invalid args, not just executed); (2) scenario expectation (read→opportunity in tool output, action→captured
  `agent_action`); (3) **negative assertion** (forbidden action/target must not occur — e.g. don't delist the
  low-conversion style); (4) narrow grounding (cited style-ids trace to fixture/tool output; numeric deferred);
  (5) **4/4 stability** on a structured decision signature (prose excluded, kind-aware). Status: **all three
  scenarios pass 4/4, reproducibly** (gemini-2.5-flash, `--n 4`) after two architectural fixes the harness
  surfaced — (a) `catalog` grounded on a deterministic `get_catalog_actions` prune/gap list (shares
  `_trend_report` with 选品, so concept-mode can't diverge) instead of re-judging raw metrics (ADR-0006: act
  on grounded candidates → reliable + can't over-delist the low-conv style); (b) **`style_id` removed from
  `send_customer_message`** — no grounded per-customer recommendation source exists, so the model kept
  hallucinating an id (9001/456); removing it eliminates the vector → customer_ops reproducibly stable.
  (An earlier "green" claim was flaky for exactly this reason — now fixed.)
- **Phase C built** (`--judge`, non-blocking): blind **multi-judge MOS** (1-5; gemini-2.5-flash + gpt-4o) on
  the open-ended output (准确性/完整性/实用性/安全性); low avg (<3.5) or judge disagreement (≥1.5) → flagged for
  **human spot-check**. **问题闭环:** any blocking-gate failure (or low MOS) is appended to
  `agent-service/eval/regressions.jsonl` as a regression seed. Live-Supabase transcript mining (over real
  `agent_runs`) is the remaining extension.
- **Original harness spec** (reference): scenario cases as data; a runner that executes the target agent(s) on each case
  against a fixed grounded fixture; automated checkers (schema/AST, grounding, stability); an LLM-judge +
  human queue for open-ended dims; a scored report per build. Mirrors the RAG harness pattern.
- **Determinism of the eval itself:** fix the grounded fixtures + seeds; pin base-model versions; record
  temperature. Report stability as evidence, not noise.

## 11. Threats / limitations

- **Nondeterminism** inflates variance → hence 4/4 stability + repeated runs + fixed fixtures.
- **LLM-judge bias/hallucination** on open-ended dims → blind, multi-judge, human spot-check.
- **Scenario coverage** → seed from planted scenarios, but *grow* via 现网回流 (real runs) to avoid an
  over-fit, hand-picked bar.
- **Base-model churn** → benchmarks (BFCL/IFEval) shift as models update; pin versions, re-check at milestones.
- **Metric gaming** → an agent could satisfy 指令遵循 while making a poor decision; that's why 决策有效性 +
  MOS (quality) sit alongside the objective compliance metrics.

## 12. References

- Methodology: GB/T 45288.2-2025 《人工智能 大模型 评测指标与方法》 (source PDF, local).
- Benchmarks (primary): BFCL V4 — gorilla.cs.berkeley.edu; MTEB — HuggingFace `mteb/leaderboard`;
  IFEval / τ-bench / AgentBench / C-Eval / CMMLU.
- System under test: ADR-0007 (agent team), ADR-0006 (grounded intelligence), ADR-0008 (concept matching).
- Sibling eval: docs/eval/2026-07-01-trend-matching-eval-report.md (RAG matching).
