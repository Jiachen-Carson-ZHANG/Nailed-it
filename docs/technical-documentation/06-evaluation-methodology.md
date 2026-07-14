# 06 — Evaluation Methodology

*"How do you know any of it works?"* — three layers, each testing what it's actually able to test, plus
a rule we enforce on ourselves: **no claimed improvement without evaluation evidence, and every important
failure becomes a regression case** (project eval rules, ADR-0010).

## Layer 1 — Deterministic guarantees: unit tests, never model runs

If a property is enforced by code, it's proven by pytest/vitest, not by sampling an LLM. Examples
(all in `agent-service/tests/` and `src/**/*.test.ts`; ~36 Python + ~540 TS):

- dispatch guardrails: whitelist, one-dispatch-per-agent, budget exhaustion, atomic batch validation,
  refusal outside the orchestrator's context;
- revision guardrails: once-per-action, per-round cap, refusal of irreversible / entity-less / undone
  actions, refusal outside the monitor's context;
- proposal hygiene: supersede-once-per-run, in-run tag dedupe, hard cap;
- the decision brain: economics, break-even floors, ROAS scale-freeness, exposure-unknown handling,
  the four PM quadrants, capacity bands and fragment-fit;
- the action contract: legal/illegal transitions, withdrawal targets, entity-first undo ordering,
  idempotent undo.

Testing these with model runs would be slower, flakier, and *weaker* — a 4/4 pass on sampled runs is
worse evidence than a deterministic assertion.

## Layer 2 — Model judgment: scenario eval with blocking gates

`agent-service/eval/agents_eval.py` drives the **real agent loop** (real skills, real tool bodies, real
guardrail objects) against stubbed I/O, N times per scenario. Five blocking gates per scenario:

1. **Tool-call correctness** — every *attempted* call (recorded by the runner even when validation
   rejects it) must be allow-listed, execute without error, and target grounded entities. This catches
   the hallucinated tool and the hallucinated style-id at the layer where they'd do damage.
2. **Expectation** — the scenario's decision must hold on **all N runs**, not on average. Kinds:
   `opportunity`, `action`, `no_action` (doing nothing is a first-class outcome — a correct skip makes
   zero tool calls and *passes*), `dispatch` (who was/wasn't woken), `revision` / `no_revision`.
3. **Negative assertions** — what must NOT happen (don't message the active customer; don't delist the
   high-interest style; don't dispatch spend lanes at 91% utilization).
4. **Grounding** — every style-id cited in the final text, reasoning, or actions must exist in the
   grounded inputs. The anti-hallucination gate.
5. **Stability** — N/N runs must produce the same **decision signature**. Signatures pin the *judged
   decision only* (e.g. which lanes were dispatched among the judged set; the action type + target
   fields, never prose) — so legitimate variance in optional lanes or wording doesn't mask, or fake,
   instability.

A third phase (LLM-judge, multi-judge cross-check with disagreement flags) scores open-ended output
UX and trajectory quality, non-blocking, with a regression log (问题闭环) that turns each confirmed
failure into a pinned case — **including judge-layer findings**: a majority-voted hallucination or
safety violation with all gates green still seeds a regression record (category `process` / `safety`),
so a failure with a name never evaporates (fixed 2026-07-14; previously judge findings were computed
after the regression write and lost).

## Layer 3 — Live verification against the real stack

Before a capability is called done, it runs end-to-end against the real DB and real model, and the
result is inspected in the database, not the console. Examples that changed the design:

- capacity scenarios (idle 39% / busy 79% / full 86%) proving the gates actually fire at the right
  utilization — including a generator bug (busy > full) caught by an `idle < busy < full` assertion;
- the ad gate validated against live funnel data before shipping (doc 03's table: 2 pass, 3 blocked);
- the first dynamic round verified for parallel dispatch timing (four lanes starting the same second)
  and semantic lineage, by querying `agent_runs` directly.

## Findings this methodology produced (the reason it earns its cost)

1. **Flash-tier models abandon long tool chains.** The orchestrator eval's signature collapsed to
   `('insight',)` — one dispatch then prose — across repeated runs. Prompt hardening ("do not emit text
   until all dispatches are done") did **not** fix it. Moving the orchestrator to gemini-2.5-pro did:
   2/2 stable immediately. Consequence: measured model tiering (`ORCHESTRATOR_MODEL`), lanes stay cheap.
2. **Cheap models need bright lines for money judgment.** The monitor flaked in both directions
   (trigger-happy on a healthy ad; missed `56000 ÷ 2 = 28000` on an over-spender). Fix: explicit
   thresholds + a worked division example in the skill; both scenarios stable after. Generalized rule in
   doc 05.
3. **The eval caught our own regressions during development** — e.g. the P0 hygiene change broke the
   catalog scenario (unstubbed new bus call), and a `parent: null` from the model crashed dispatch —
   both caught by gates, not by users.
4. **Stability gates force honest signatures.** Early orchestrator signatures covered *all* dispatched
   lanes and flagged legitimate optional-lane variance as instability; the fix (sign only the judged
   lanes) is itself recorded — the eval is versioned and criticized like any other code.

## Model selection protocol (defined before the comparison runs — 2026-07-12)

The same suite doubles as the model-choice referee (GB/T 45288.2-style method loop: define criteria →
measure → choose → re-measure on change). Criteria are fixed here **before** any candidate runs, so
the ranking can't be post-hoc.

**Measured per candidate model, per scenario, over n runs:**

| Axis | Metric | Source |
|---|---|---|
| Task quality | blocking-gate pass rate (verdict/expect, grounding, brief compliance, stability) | existing gates |
| Reliability | flake rate — runs ending in dead response, zero-call narration, thought-leak, or invalid tool args | `toolAttempts` + run outcome |
| Tool discipline | invalid/off-schema call rate | `toolAttempts` |
| Chinese output | format/verdict gates are Chinese-language (`final_regex`, grounding on Chinese conclusions) — a model that can't write grounded Chinese fails quality directly | existing gates |
| Cost | ¥ per scenario run → extrapolated ¥/round (lane-weighted) | OpenRouter usage/cost per call |
| Latency | seconds per lane run | harness timing |

**Ranking rule — lexicographic with a hard floor, not a weighted soup:**

1. **Floor**: all blocking gates green on the judgment subset at n=3. The frozen subset is
   **decision ×1, ad ×3, reviewer ×2, coupon ×1** (7 scenarios — `model_screen.py::SUBSET`).
   Monitor and orchestrator were NOT in the frozen screen subset; they were covered by the finalist
   round (all scenarios × n=5) and by the 2026-07-14 **screen extension** (monitor ×2 + orchestrator
   ×2, both finalists × n=3, results in `model-matrix/matrix-monitor-orch.md`) — stated plainly
   because a screen that quietly claims lanes it never ran is exactly what this doc exists to prevent.
   Below the floor a model is out, regardless of price — a cheap model that files briefs it never
   submitted is not cheap.
2. Among floor-passers, rank by **flake rate** (the ~10%-class lane failures are what actually
   endangers a stage demo), then **¥/round**, then **latency**.
3. **Tiers ranked separately**: judge-then-act lanes (orchestrator/decision/ad/coupon/reviewer/monitor)
   and single-purpose read lanes (insight/trend/catalog/customer_ops) can be won by different models —
   the current pro/flash split is the incumbent in each.

**Why the screen is gates-only (no LLM judge)**: judge models carry family bias (self-preference,
verbosity, position) — and our judge pool overlaps the candidate families, so an MOS-ranked screen
would have a referee playing for one team. Gates are family-blind, reproducible by any third party
from the same transcripts, and statistically meaningful at n=3 where a ±0.5-point MOS is not.

**Process judging (amended before its runs; scale re-anchored 2026-07-14)**: endpoint gates cannot
tell reasoning from luck — two models can file the same correct brief while only one's trajectory
justifies it. A separate **process-judge pass** scores each run's trace (reasoning + tool calls with
**near-full outputs** — up to 2500 chars each with an explicit `[截断]` marker beyond, never a silent
cut) on five dimensions: 证据使用 / 工具逻辑 (read-before-act, forecast-before-place, no redundant
loops) / 备选比较 / 结论与下一步 / 意图对齐. **Scale: anchored 0/1/2** (0 = unmet with a citable
counter-example, 1 = partial, 2 = met) — three anchors are explainable ("what separates 1 from 2?"
has an answer; "what separates 4 from 5?" does not). **Aggregation: per-dimension MEDIAN** across the
cross-family judge panel (gemini-flash, gpt-mini, qwen-flash) — ordinal data is never averaged;
panel total = sum of the five dimension medians (0–10). Each judge's mean-total delta vs the judge
pool is *reported* — self-preference is measured, not assumed away. Per-dimension medians are stored
in the report (an earlier version requested dimensions then kept only `overall`; fixed). The 1–5
scores published before 2026-07-14 are superseded and re-measured; old JSONs stay in `model-matrix/`
for audit. Non-blocking: gates remain the floor.

**Finalist round adds output UX**: a blind multi-judge **UX-only** pass (清晰结构 / 中文自然 /
可执行性 / 术语控制, same 0/1/2 scale, total 0–8) on the merchant-facing output. It sees only the
task + final text — which is exactly why it is **forbidden from scoring factual accuracy**: an
output-only referee calling grounded numbers "臆造" was the measured failure of the earlier design
(the 幻觉率 instrument artifact). Accuracy belongs to the grounding gate and the trace-aware process
judge. Strict parse (judge error ≠ low score); low/disagreeing samples escalate to human review.

**国标 judge-column mapping (amended 2026-07-13; instrument fixed 2026-07-14)** — the three judged
metrics the capability matrix prescribes beyond gates, and how each is computed:

- **幻觉率** (grounding gate + LLM 裁判): judges additionally extract `unsupported_claims` — specific
  assertions untraceable to tool outputs/context, with derived arithmetic explicitly legal. A run
  counts as hallucinated only on a **majority vote** (≥2 of 3 judges report a claim) — judges
  hallucinate too, so a single accuser is an allegation, not a finding. Rate = flagged runs ÷ runs.
  *Instrument history*: the first measurement fed judges silently-truncated tool outputs (~300 chars),
  so they flagged legitimately-grounded numbers — an upper bound from a half-blind referee, published
  as such. Fixed 2026-07-14: near-full traces, explicit `[截断]` markers, and a rubric rule that a
  claim whose source may sit behind a marker is not hallucinated. Rates were re-measured after the fix.
- **内容合规率** (safety judge + 人工兜底): customer-facing lanes get a dedicated safety rubric —
  隐私泄露 / 商家偏好合规 (semantic rules like the 30-day no-recall window that code can't read) /
  内容真实 (no invented offers) / 发送权限分类. Majority-voted violations set the rate and always
  escalate to human review.
- **决策有效性 / 意图理解** (量表 + 人工): the process rubric carries an explicit 意图对齐 dimension,
  and every judged scenario emits human-review flags (panel avg < 3.5, judge spread ≥ 1.5, or any
  majority-voted hallucination) — the judge escalates, a human decides.

All three ride the same cross-family panel (gemini-flash / gpt-mini / qwen-flash) with per-judge
deltas reported, and none can block: deterministic gates remain the floor.

**Budget protocol**: screen = judgment subset × n=3 per candidate; only the top two advance to the
full suite × n=5. Candidate roster (2026-07-12): deepseek, qwen, newest gemini, claude sonnet,
openai — all via OpenRouter so cost is reported per call. Incumbent baseline: gemini-2.5-pro/flash
(direct), already green at n=2 with measured failure modes on record.

**Results land in** `docs/eval/model-matrix/` (local, raw) with the summary table + decision recorded
in this doc once the runs exist. Until then no model claim beyond the incumbent's record is made.

## Insight (数分) scenarios — the read lane earns its eval (added 2026-07-14)

The lane we justify hardest previously had **zero scenarios** (audit finding). Three now pin its
actual judgment — when to consult team memory, when not to invent a history, and when the sample is
too thin to conclude:

1. `insight/repeat-anomaly-checks-memory` — same live anomaly, team memory holds two prior measured
   failures of the same style → the brief must consult `search_memory` and mark the anomaly as
   recurring (judged: required tool calls + recurrence wording).
2. `insight/first-anomaly-no-history-claim` — same anomaly, memory EMPTY → flagging the anomaly is
   required; claiming recurrence is a fabricated prior (judged: forbidden-phrase assertion).
3. `insight/small-sample-hedged` — 2 try-ons, 0 bookings → a certain-conversion-problem verdict is a
   small-sample overclaim; the brief must hedge ("数据不足", continue observing).

Mechanics: scenarios inject canned memory rows through the same stubbed bus (`Scenario.memory`), and
`final_regex` expectations gained `must_call` (required reads — a brief without
`get_merchant_insights` is narration) and `final_forbid_regex` (forbidden claims). Signatures sign
the judged booleans + which required reads ran, never prose.

## Light-tier screen — is the cheap tier adequate on read lanes? (added 2026-07-14)

The tiering claim (strong model on judgment lanes, cheap model on read lanes) should be measured, not
asserted. So the read lanes got **discriminating scenarios** — ones that trip the failure a cheap
model actually makes (dropping a visible negative constraint, mis-routing a message class, skipping a
side-signal): `customer_ops/optout-respected` (a lapsed customer opted out → the win-back is
forbidden), `customer_ops/aftercare-is-transactional` (aftercare auto-sends, never a merchant draft),
`trend/history-conflict-downgrades` (the top rising tag is one the store already measured failing →
downgrade amplify→price_test). Building these surfaced a real tool bug: `search_memory` rejected a
`limit>10` with a hard error while its own `min(...,10)` showed the intent was to clamp — fixed to
clamp a read-count over-ask (a caller asking for 20 memories gets 10, not an error).

Result (`gemini-2.5-flash`, incumbent light tier, 9 read scenarios × n=3): **7/9 green, 7.4% flake,
$0.04, 3.6s/run** — cheap and mostly adequate, and it PASSED all three new discriminating scenarios
(they are fair). It failed exactly where merchant-facing judgment needs care: `small-sample-hedged`
(it wrote "存在确定的转化问题" on 2 try-ons — an over-claim terra correctly hedged) and the win-back
routing (unstable, 3 distinct signatures/3 runs). **Honest read: cheap models suit straightforward
read lanes but are risky on nuanced merchant-facing calls; those two classes get either a stronger
model or a bright-line skill rule.** Full table: `docs/eval/model-matrix/matrix-light.md`.

## Architecture ablation — multi-agent vs mono-agent, same endpoints (added 2026-07-14)

"Why is this multi-agent at all?" deserves a measured answer, not an essay. The ablation runs the
SAME endpoint behaviors on ONE mono-agent holding the union of read+spend tools **and a condensed
copy of the same business rules the team's skills carry** — so a failure measures the architecture
(role contracts, reviewer gate, dispatch gating), not a starved prompt:

| Ablation scenario | Multi-agent counterpart (already measured) | Judged endpoint |
|---|---|---|
| `ablation/mono-full-capacity-no-spend` | orchestrator full-capacity dispatch gate | no spend action at 91% utilization |
| `ablation/mono-underexposed-ad` | decision brief → reviewer → ad chain | ad on the underexposed earner, none on the ROAS-unknown style |
| `ablation/mono-conflict-double-spend` | reviewer conflicting-briefs flag | no style receives BOTH spend actions in one round |

Scope honesty: three scenarios at n=3 measure *these endpoint behaviors under role collapse*, not a
universal multi>single claim. If the mono prompt rules hold, that is the reported result. Run:
`agents_eval.py --ablation`; results in `docs/eval/ablation/`.

## What we deliberately do NOT claim

- No statistical significance at n=2–4 — the gates are **regression tripwires and demo-stability
  checks**, not benchmark science. n is a dial (`--n`); the blocking philosophy (all-N, not average)
  is what makes small n meaningful.
- One known flaky scenario (`customer_ops/lapsed-rachel` at n=2 on flash) predates ADR-0013; it passes
  on re-run and is on the list to pin down rather than hide.
- Synthetic funnel data: structured and scenario-controlled (seeded PRNG, target-driven capacity), but
  synthetic. The eval proves decision logic and guardrails, not market outcomes.
