# ADR-0009 — Synthetic demo data: seeded distributional generation with planted scenarios

**Status:** Accepted (2026-07-02). **Depends on:** ADR-0006 (grounded intelligence). **Feeds:** ADR-0007
(agent team) + the multi-agent eval framework. **Full spec:** `docs/plans/2026-06-27-synthetic-demo-data.md` (local).

## Context

The 美团 semifinal is a **single-salon competition demo on mock data** (ADR-0006: two real tables,
everything computed on read). We need one engineered dataset that makes the whole platform demoable —
multi-merchant feed + ads, the per-merchant agent loop (数分/选品/决策/Monitor), personalized 用户运营 —
and the real nail photos aren't ready yet. Crucially, the **same dataset doubles as the test set** for the
agent evals, so it must be **reproducible** yet **non-trivial**.

The core tension: we want a **stable, safe demo** (identical every run) but we must **not script the
agent's decisions** — if we hardcode `nail → action`, the "AI agent" is a puppet that proves no
intelligence and cannot be evaluated.

## Decision

**Two determinisms — keep one, kill the other.**
- **Data determinism (keep):** a seeded PRNG (`mulberry32(SEED)`) → identical dataset every run.
- **Decision determinism (kill):** never hardcode `nail → action`. Diagnosis, ranking, place_ad/coupon,
  list/delist all happen in the **agent runtime** over the generated numbers (ADR-0006 grounding). We
  design *situations*; the agent reasons; we observe (and may disagree).

**Generative behaviour model, sampled — not hand-picked.** Model the funnel as a chain of conditional
probabilities; each style has *latent* quality; sample it:
`impressions~Poisson(λ) → clicks~Binomial(imp,ctr) → try-ons~Binomial(clicks,try) → bookings~Binomial(try,cvr) → saves`.
Rates ~ `Beta(α,β)` (bounded [0,1]; tune mean + spread so most styles cluster middling, a few great/poor);
**Binomial-on-Beta blurs the edges** → organic, not obvious. Exposure (`λ`) is **decoupled** from quality.

**Coherent users + emergent trends.** Customer taste = a latent affinity vector; event prob ∝ `taste·tags`
→ real personalization. Trends = **time-varying rates** ramped over a 14-day window → "rising" emerges from
timestamps, **no `isRising` flag** (the agent must derive it).

**Planted scenarios = situations, not verdicts.** Override ~11 hero styles into deliberately *ambiguous*
cases (winner 8265 · low-conversion 8284 · declining 8282 · vanity 8273 · metallic-bg 8274 · gem 8275 ·
near-tie 8249/8266 · dead 8277/8261), inside ~20 random middle-mass styles. Nothing is labelled;
scenario names live only in code. **暗黑 = a 0-stock supply gap** (external trend + search demand, no
in-catalog style), not a planted funnel style.

**5 merchants (1 hero + 4 fillers)** so the fillers produce a **real cross-merchant 平台热门 signal**, not
a mock. **Verify by bands, not exact counts** (data is sampled; the SEED makes the bands hold every run).

**The dataset is also the eval test set:** each planted scenario carries an expected behaviour (declining →
prune/price_test; winner → amplify) → objective pass/fail for the multi-agent eval. If the agent reasons
poorly we tune the **data or the prompt, never a hardcoded path** — that is the problem-closed-loop.

## Design principles

- Data reproducible **but organic** (sampled from distributions, not round constants).
- **Design situations, observe judgement** — decisions stay live at runtime.
- **Grounded** (ADR-0006): numbers are generated; the agent acts on them, never invents.
- **Mock-now, swap-later:** nails are `imageUrl` placeholders; tags authored; nothing blocked by missing pics.
- **Extend, don't rebuild** on the existing hero + personas.

## Alternatives considered

- **Hand-picked round numbers** — rejected: obvious/fake, pattern-matchable, can't test real judgement.
- **Scripted decisions (hardcode nail→action)** — rejected: puppet agent, proves nothing, not evaluable.
- **Unseeded randomness (`Math.random`)** — rejected: non-reproducible demo, flaky band-tests.
- **Real production data** — none exists (pre-launch competition demo).
- **Single hero merchant only** — rejected: no real cross-merchant 平台热门 signal.

## Consequences

**Positive**
- Reproducible + organic; the agent's intelligence is real and **evaluable** (same dataset = eval test set).
- Personalization is real (taste vectors); trend detection is real (timestamp-derived, no flag).
- Demo-safe (SEED) without scripting the outcome.

**Negative / open**
- Hand-tuned latents need calibration to keep rankings plausible (e.g. 8284 `λ160`/`cvr Beta(1,40)`; 8274
  `cvr` kept below the winner). Band-tests only assert ranges, not exact counts.
- Nail images remain placeholders until the real pics land.
- **Platform-hot (pop-style) signal is a placeholder** — current `get_platform_hot` = cross-merchant
  tag-count (`styleCount + merchantCount`). The real popularity signal should be more sophisticated —
  **neither raw booking/click nor tag-count — TBD (open design item).**
- Scenario coverage is seeded from planted cases; it should grow via 现网回流 (real-run replay) per the
  eval framework.

## References

- Plan + methodology + generator spec (with §0.5 implementation status): `docs/plans/2026-06-27-synthetic-demo-data.md` (local).
- Code: `src/mock/{prng,style-latents,filler-merchant-styles,intelligence-seed,external-trends}.ts`; scripts `npm run backfill:fillers`, `npm run preflight`.
- Consumes/feeds: ADR-0006 (intelligence layer), ADR-0007 (agent team), ADR-0008 (concept matching), multi-agent eval framework (`docs/eval/2026-07-01-multiagent-eval-framework.md`).
