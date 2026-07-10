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

A third phase (LLM-judge, multi-judge cross-check with disagreement flags) scores open-ended prose
quality, non-blocking, with a regression log (问题闭环) that turns each confirmed failure into a pinned
case.

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

## What we deliberately do NOT claim

- No statistical significance at n=2–4 — the gates are **regression tripwires and demo-stability
  checks**, not benchmark science. n is a dial (`--n`); the blocking philosophy (all-N, not average)
  is what makes small n meaningful.
- One known flaky scenario (`customer_ops/lapsed-rachel` at n=2 on flash) predates ADR-0013; it passes
  on re-run and is on the list to pin down rather than hide.
- Synthetic funnel data: structured and scenario-controlled (seeded PRNG, target-driven capacity), but
  synthetic. The eval proves decision logic and guardrails, not market outcomes.
