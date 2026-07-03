# ADR-0008 — 选品 trend↔catalog matching via VLM concepts + hybrid retrieve/rerank

Status: Accepted (2026-07-01). Extends ADR-0007 (agent team) / ADR-0006 (grounded intelligence).
Design detail: `docs/eval/2026-07-01-trend-matching-design.md` (local).

## Context

The 选品 agent classifies a trend as `amplify` (we offer it) or `gap` (we don't) by matching the trend to
the catalog. The original matcher was tag-overlap. On real inventory it failed both ways (spike, 2026-07-01):
- missed obvious matches — `法式 french tip` scored 珠光法式银月钻 **0** (its tag is 美术设计服务, not 法式风);
- created false positives — `chrome` "matched" a style on its noisy 金属感 tag though the photo isn't chrome.

Tags are coarse, inconsistent, mixed-granularity; a trend is a *concept* (visual + occasion/vibe), not a
tag set. Pinterest cannot supply trend images (no global pin search — see implementation-log 2026-06-30),
so image↔image is impossible; the trend side is always text.

## Decision

Represent each nail as a **VLM concept** — a vision model reads the catalog photo and emits a structured
CN concept (形状/长度/底色/质感/图案/装饰/风格/适合场景), cached in `style_concept`. Match a trend keyword
by **hybrid retrieve→rerank**: `google/gemini-embedding-001` → pgvector cosine top-k (recall) → Cohere
`rerank-multilingual-v3.5` (precision) → threshold. Behind `MATCH_MODE=tag|concept`, `EMBED_PROVIDER=
google|cohere|openrouter`; concept degrades to tag-overlap per-trend on any error (never hard-fails a round).

**Model selection was by eval, not preference** (2026-07-01; 32 concepts, 12-query bilingual gold set,
graded relevance). Embedding — google/gemini-embedding-001 won decisively: R@10 **0.91**, MRR **0.92**,
nDCG@10 **0.88** vs Cohere embed (0.78/0.79/0.67) and OpenAI-3-large (0.72/0.72/0.63). Rerank — Cohere
rerank-multilingual-v3.5 (P@1 0.83, MRR 0.92) chosen over an LLM-judge: gpt-4o scored marginally higher
(P@1 0.92) but only by ~1 query (within gold noise) while being slow, token-costed, and nondeterministic;
Cohere is one fast deterministic call per round. Harness in `docs/eval/2026-07-01-trend-matching-design.md`
appendix; cost was explicitly excluded (decide on ability).

## Design principles

- **Ground the action in the right signal** — matching is text↔text (trend concept ↔ nail concept); the
  nail's concept is derived from its own photo, not from a foreign trend image we can't get.
- **Retrieve for recall, rerank for precision** — cheap embedding narrows, rerank orders the shortlist.
- **Cache the expensive part** — VLM+embed once per image; matching per round is embed(query)+rerank only.
- **Never hard-fail a round** — concept mode degrades to tag-overlap per-trend on any error (cf. the
  Pinterest fixture fallback).
- **Keep the core pure** — `trend_logic` takes an injected `match_fn`; all I/O lives in `matching`/`enrich`.

## Alternatives considered

- **Keep tag-overlap** — free but broken (above); kept only as fallback / same-vocabulary fast path.
- **CLIP image↔keyword** — matches pixels, misses occasion/vibe, coarse on fine nail nuance, not auditable.
- **Pull trend images from Pinterest → image↔image** — impossible; no global pin discovery at our API tier.
- **Pure embedding cosine** — cheap recall, poor precision (similarity ≠ "is-instance-of").
- **Pure LLM-judge** — precise but token-cost ∝ catalog, nondeterministic; used only to *prove* the spike.
- **Standalone vector DB** — over-infra at hundreds of styles; pgvector in the existing Supabase suffices.

## Consequences

- New `style_concept` table (migration 0023, pgvector). Enrichment is offline/idempotent
  (`python -m nailed_agents.enrich`), re-enriched when any of **(source_media_asset_id, model,
  pipeline_version)** changes; VLM runs on OpenRouter.
- Cross-lingual (EN Pinterest keyword ↔ CN concept) is handled by the multilingual embed+rerank — no
  translation step. Concepts are cached → matching stays deterministic/grounded (ADR-0006).
- Adds a Gemini-embedding dependency (`GEMINI_API_KEY`) + Cohere rerank (`COHERE_API_KEY`); per-round
  embed+rerank calls; both degrade to tag-overlap on error. `EMBED_PROVIDER` swaps the embedder (google
  default; cohere/openrouter available) without touching the matcher; the 1024-d column fits all three.
- The VLM concept also supersedes the noisy tag vocabulary for matching, and is auditable (readable "why").
- `trend_logic.trend_opportunities` stays a pure function — the matcher is injected as `match_fn`.
- Non-goals: visual lookalike search (customer inspo→style) and publishing styles as pins remain backlog.

## References

- Design detail + tradeoff tables: `docs/eval/2026-07-01-trend-matching-design.md` (local).
- Migration `supabase/migrations/0023_style_concept.sql`; code `agent-service/nailed_agents/{enrich,matching,cohere_client}.py`.
- Spike evidence + Pinterest API limits: `docs/changes/implementation-log.md` (2026-06-30 / 2026-07-01).
- Builds on ADR-0006 (grounded intelligence) and ADR-0007 (agent team).
