# 07 — Anticipated Judge Q&A

The questions we'd ask if we were judging this, with the answers we can actually back. Where the honest
answer is "known limit", it says so — a defensible limit beats an indefensible claim.

---

## Architecture & agents

**Q1. "Strip the buzzwords. Isn't this just a pipeline calling an LLM eight times?"**
It was — we said so in the ADR and rebuilt it (ADR-0013). Now: the orchestrator is itself a tool-loop
that reads the shop's state and *decides* the round — the eval pins that at 91% utilization it must not
wake the spend lanes, and the live transcript shows dispatch reasons with cited numbers. Below it, each
lane is a multi-turn tool loop that can and does override its inputs (决策 declined the brain's coupon
candidates on delist-flagged styles, citing both signals). Skips, parallel fan-out, cross-round memory,
and a monitor that can force a bounded re-run — remove any of these and behavior degrades nameably.
That's our bar for "multi-agent", and we'd apply the same bar to anyone else's demo.

**Q2. "Why didn't you use LangGraph / CrewAI / AutoGen? That's the industry standard."**
Because the runner is ~100 lines (`runner.py`) driving two provider backends over one set of tool
bodies, and everything a judge scores here — guardrail objects, grounding gates, entity contracts,
lineage — lives in *our* layer no matter what runs the loop. A framework would add a dependency and a
debugging surface and contribute none of the judged behavior. We'd rather defend 100 lines we fully
understand than 100k lines we don't. Pattern over framework.

**Q3. "Agents don't talk to each other. Where's the 'multi' in multi-agent?"**
They interact through three persisted, visible channels: dispatch (with upstream conclusions passed
deterministically by code), a round blackboard, and cross-round memory — plus one adversarial edge where
监测 rejects an action and its executor re-runs with feedback. What we refused is free-form chat, on
grounds we'll defend: unbounded cost, loop risk, unreproducible demos, invisible coordination. Every
interaction here appears in the lineage tree the merchant sees. If "agents chatting" is the criterion,
we think the criterion is wrong — interaction should exist where it changes outcomes, and each edge
should be auditable.

**Q4. "Why is Postgres your message bus? That doesn't scale."**
One writer (the Python service), one reader (the panel), and the panel needs to render exactly what the
agents wrote — same rows, live, zero extra infrastructure. At multi-merchant scale with concurrent
rounds, the dispatch layer becomes a queue and the bus gets revisited; the seams for that (round rows,
run parenting, per-merchant scoping) already exist. Choosing Kafka for a single-merchant demo would have
been resume-driven engineering.

**Q5. "Two Gemini tiers — sounds like guesswork. Why pro for one agent and flash for the rest?"**
Measured, not guessed. Flash abandoned the orchestrator's multi-step dispatch chain after one tool call
— eval signature `('insight',)` across runs — and prompt hardening did not fix it; the tier did (2/2
stable immediately after). Lanes are 1–3 call loops where flash is reliable *if* judgment sits above
bright lines (Q14). So the expensive model runs exactly once per round, where chain depth demands it.

## Money & economics

**Q6. "Your ROAS is fake — you don't know CPC and you assume every booking is incremental."**
Correct on both counts, and both are written down (doc 03, ADR-0012 amendment). CPC is a named config
assumption (¥1.2, beauty-category-typical); incrementality makes the estimate an **upper bound**. Our
answer isn't a fabricated lift factor — it's the feedback loop: 监测 writes *measured* outcomes per
campaign into memory, 决策 reads them next round, and measured verdicts outrank the estimate. The
estimate's job is to rank spend candidates on day one; the measurement's job is to correct it from day
seven. Meanwhile the gate already blocked the objectively bad buys on live data (61 clicks, zero
bookings → no spend) — a wrong-in-magnitude estimate still gets direction right when the alternative
converts nothing.

**Q7. "The agent picks the budget. What stops it from picking ¥2,000/day?"**
Nothing stops it from *picking*; three layers stop it from *spending*: a hard input bound in the tool
(≤ ¥2,000 rejects), the merchant envelope in the server action (> ¥50/day lands as a draft the merchant
must launch; ≤ ¥50 auto-launches as a withdrawable daily drip with a one-tap pause), and entity-first
undo (doc 04). The demo round proves the envelope: the agent chose ¥200/day and all three campaigns
correctly landed as drafts awaiting the merchant.

**Q8. "Why is 'unknown ROAS = don't spend' right? You'll never learn about new styles."**
Deliberate asymmetry: a false 'spend' costs real money; a false 'unknown' costs a round. And "never
learn" is wrong in this system — new styles earn organic impressions through the feed, accumulate funnel
data, and become measurable within days; the coupon lever (gated on demand, not ROAS) can also generate
signal. Exploration budgets are a legitimate future feature — as a *merchant opt-in envelope*, not a
default gamble.

**Q9. "Variable cost 15%, fee 6%, CTR target 8% — where do these numbers come from?"**
Config assumptions, centralized and named (`economics.ts`, `funnel.ts`), documented as tunable. The
structural decisions don't depend on them: profit-per-hour as the metric, absolute (not %) variable cost
so break-even is a real floor, scale-free ROAS. Relative rankings between styles are robust to target
values; absolute scores are not, and nothing gates on absolute scores alone.

## Safety & trust

**Q10. "What happens when the model hallucinates a style id or a tool?"**
It has, and the layers caught it. Off-allow-list tools are refused *before execution* in the runner.
Tool inputs are validated before side effects (regex, bounds, whitelists). The eval's grounding gate
fails any run citing an entity that doesn't exist in the grounded inputs — and it reads *attempted*
calls, so a validation-rejected hallucination still shows up in evaluation. Server actions revalidate
everything again in TS. The one real incident class we hit — the model passing `parent: null` — crashed
into a `ValueError`, not a side effect, and became a pinned test.

**Q11. "Undo is fake in most AI demos. Prove yours isn't."**
Ordering: entity first, status second — a mid-way failure leaves the campaign paused but the pill stale
(self-correcting from the authoritative entity), never the reverse (claiming "undone" while spending).
Typed reversibility: sent messages refuse undo at the repository guard, and the UI never offers it.
Tested end-to-end against the memory bundle, including idempotent double-undo, and exercised live. Also:
rejected group-buy proposals are *shelved*, not deleted — audit trail preserved.

**Q12. "The merchant sees a wall of AI activity. How is this not a black box?"**
Every run renders a merchant-readable thinking chain (per-tool one-sentence summaries with the real
numbers; raw JSON only behind a 查看数据 expander), a task-context line ("由「决策 Agent」的结论触发本次
任务") with upstream/downstream chips, and every commercial object links back to the run that proposed
it. The transcript describers are pure, tested functions — not the model summarizing itself.

**Q13. "What's your blast radius if the whole agent service goes rogue for a round?"**
Bounded by construction: ≤ 8 dispatches, ≤ ¥50/day auto-launched per campaign (everything above is a
draft), ≤ 5 pending proposals, ≤ 2 revisions, messages capped in length and count per round, group-buys
can't self-publish. Worst realistic case: a few ¥50/day drips the merchant pauses with one tap, all
attributed to a visible run. The failure we engineered against hardest is not overspend — it's *lying
about state*, which is why atomicity and undo ordering got RPC-level treatment.

**Q14. "You gave a cheap model authority over money judgments. Why is that OK?"**
Because judgment only exists above bright lines. The monitor eval flaked in both directions until the
skill got explicit thresholds and a worked division example; after, 2/2 stable. Our rule, generalized:
cheap models judge only where code-verifiable bright lines exist; otherwise the tier goes up (orchestrator)
or the decision moves into deterministic code (the brain). "Use good judgment" is not an instruction we
give flash with money on the table.

## Evaluation & rigor

**Q15. "n=2 or n=4 runs is not statistics."**
Agreed, and we don't claim it is (doc 06). The gates are regression tripwires with an all-N blocking
rule — a single deviant run fails the scenario, which at small n is a *stricter* bar than averaging.
Deterministic properties aren't sampled at all; they're unit tests. What n=4 buys is exactly what a demo
needs: confidence the judged decision is stable, and a pinned reproduction when it isn't.

**Q16. "Your data is synthetic. Everything downstream is fiction."**
The *volumes* are synthetic; the *structure* is not — seeded PRNG over real funnel semantics, capacity
scenarios that provably move the gates (idle 39% / busy 79% / full 86% produced 4-ad/4-coupon →
4-ad/0-coupon → 0/0 respectively). Synthetic data is how you test decision logic against conditions you
can't order up on demand (a fully-booked week). What synthetic data cannot prove — market outcomes,
real CPC — is exactly what the memory loop is built to measure once real traffic exists.

## Scale & business

**Q17. "What breaks first at 1,000 merchants?"**
In order: (1) round concurrency — the Python service runs one round at a time; the dispatch layer needs
a queue and per-merchant workers. (2) Compute-on-read analytics — event-log scans per read want
materialized rollups around 10⁶ events per merchant. (3) The model bill — mitigations already built:
lanes on flash, skips make rounds cheaper, and orchestration frequency can be event-driven instead of
scheduled. The seams for all three exist (merchant-scoped everything, round rows, repository seam);
none required rework to date because we scoped them early.

**Q18. "Why would a merchant pay for this instead of doing it themselves?"**
The 今日 home is the answer: the merchant's job collapses to reviewing a short needs-you queue and
keeping a pause button. The team reads funnels nobody reads (8284: 26% of impressions, 61 clicks, zero
bookings — invisible in any dashboard a busy owner checks), prices coupons against a profit-per-hour
floor instead of gut feel, and refuses spend a human would have wasted. The pitch isn't "AI does
marketing"; it's "the shop gets an operations analyst whose every action is reversible and explained."

**Q19. "What's actually novel here versus any agent demo from the last year?"**
Three things we'd defend as genuinely uncommon: (1) actions create *real, reversible commercial objects*
through the app's own validated write path, with a two-way audit contract — not log-line theater; (2)
the measured feedback loop — the system stores what its estimates *got wrong* and demotes them next
round; (3) the discipline artifacts themselves: capability-object guardrails, entity-first undo
ordering, bright-line skill thresholds — each one exists because an eval or an audit caught the failure
it prevents, and the paper trail (ADRs 0004–0013) shows it.

**Q20. "If you had two more weeks, what's first?"**
(1) Multi-merchant: N shops competing on one platform feed — the architecture's designed-for case and
the strongest demo of decision divergence (same platform data, different capacity/economics → different
rounds). (2) Real coupon redemption + booking attribution so `coupon_outcome` memory rows measure as
well as ads do. (3) An exploration envelope (Q8) as merchant policy. Deliberately *not* first: more
agents. Eight lanes with sharp contracts beat fifteen with mush.
