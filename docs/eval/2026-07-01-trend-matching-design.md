# Design: 选品 trend↔catalog matching via VLM concepts + hybrid retrieve/rerank

Status: IMPLEMENTED (2026-07-01). Decision recorded in **ADR-0008** (matching) + **ADR-0010** (eval method).
Authoritative shipped default = **Google `gemini-embedding-001` embed + Cohere `rerank-multilingual-v3.5`**
(see §Eval outcome). The "Cohere embed" line in §Provider/model below was the pre-eval provisional pick —
**SUPERSEDED**. Local doc (not GitHub).

## Problem

The 选品 agent decides `amplify / gap` by matching a trend to the catalog. Current matcher = tag-overlap.
The spike proved it broken on real inventory:
- **Misses real matches**: `法式 french tip` → 珠光法式银月钻 scored **0** (its tag is 美术设计服务, not 法式风),
  though the nail literally has a French smile line.
- **Creates false positives**: `chrome` → 碎钻冰透裸色甲 "matched" on its 金属感 tag, but the photo isn't chrome.

Root cause: tags are a coarse, inconsistent, mixed-granularity vocabulary (service categories mixed with
visual attributes), and a trend is a **concept** (visual + occasion/vibe), not a tag set.

## Goal / non-goals

Goal: given a trend keyword (EN or CN), return the catalog styles that are genuinely *instances of that
trend concept*, ranked, with a match/gap threshold — accurate, auditable, grounded (ADR-0006).

Non-goals: visual lookalike search (customer inspo→style) — separate backlog feature. Pinterest pin
images — unavailable at our API tier (see 2026-06-27 spec / implementation-log). Fine-grained model
fine-tuning — later.

## Chosen approach

Represent each nail as a **VLM concept** (structured CN text from its photo), then match trends with a
**hybrid retrieve→rerank**:

```
ENRICH (once per style, cached):
  nail photo → VLM (gemini-2.5-flash, multimodal) → {形状,长度,底色,质感,图案,装饰,风格,适合场景}
            → concept_text (CN sentence) → embed → store {concept_json, concept_text, embedding} in Supabase

MATCH (per trend keyword):
  keyword → embed → pgvector cosine top-k (recall)  →  Cohere rerank-multilingual (precision)
          → threshold → [{style_id, score}]  →  feed amplify/gap classification
```

## Why this, and tradeoffs vs alternatives

### Representation: VLM concept (chosen) vs tags vs CLIP image

| | tags (current) | CLIP image↔keyword | **VLM concept (chosen)** |
|---|---|---|---|
| finds tag-missed matches | ✗ | ~ | ✓ (spike: 95 vs tag 0) |
| rejects tag false-positives | ✗ | ~ | ✓ (spike: read photo, scored 20) |
| captures occasion/vibe (not just pixels) | ✗ | ✗ | ✓ (VLM infers 节日/婚礼/通勤) |
| auditable ("why matched") | ~ | ✗ | ✓ (readable concept) |
| cost | free | 1 embed/img | **1 VLM call/img (one-time, cached)** |
| fixes tag quality as a side effect | — | — | ✓ (replaces noisy tags) |

VLM concept wins on accuracy + auditability; cost is a cached one-off. CLIP is pixel-bound (misses
occasion/vibe) and coarse on fine nail nuance; dropped as primary.

### Match method: hybrid (chosen) vs pure embedding vs pure LLM-judge vs pure rerank

| | recall | precision | cost/round | determinism |
|---|---|---|---|---|
| pure embedding cosine | high | **low** (similarity ≠ "is-instance-of") | ~free | high |
| pure LLM-judge (all styles) | high | high | **high** (tokens ∝ catalog) | low |
| pure rerank (all styles) | high | high | O(N)/keyword, wasteful | high |
| **hybrid: embed top-k → rerank** | high | high | **low** (k≈15) | high |

Hybrid = embeddings for cheap recall, rerank for precise ordering. Rerank is purpose-built for query-doc
relevance, cheaper + faster + more deterministic than an LLM-judge. The spike used an LLM-judge to *prove
concept matching works*; production swaps in rerank for speed/cost.

### Store: pgvector in Supabase (chosen) vs standalone vector DB vs in-memory

Scale is hundreds of styles → a standalone vector DB (Pinecone/Qdrant) is over-infra. In-memory numpy
would work but loses persistence. pgvector lives in the DB we already run: persist concept vectors beside
the catalog, no new service. Cost: one manual SQL migration (no Supabase CLI, per project constraint).

### Provider/model

- **VLM**: `google/gemini-2.5-flash` via existing OpenRouter (multimodal, cheap, already wired). No new key.
- **Embed + rerank**: ~~**Cohere `embed-multilingual-v3.0` (1024-d) + `rerank-multilingual-v3.5`**~~
  **[SUPERSEDED by the eval — see §Eval outcome].** Shipped: **Google `gemini-embedding-001` embed
  (`EMBED_PROVIDER`, 1024-d via `dimensions`) + Cohere `rerank-multilingual-v3.5`.** (Original provisional
  reasoning: one provider/key, strong multilingual, hosted = quick. The eval overturned the embed pick.)
- Cross-lingual is handled here: multilingual embed+rerank map EN trend keywords and CN concepts into one
  relevance space — this is the real fix for "English Pinterest ↔ CN catalog", no translation step needed.

## Data model

New table `style_concept` (derived artifact, keyed by style; embeddings persisted because recompute is costly):
```
style_concept(
  style_id text PK REFERENCES merchant_style(id),
  merchant_id text,
  source_media_asset_id text,     -- re-enrich when this changes
  concept_json jsonb,             -- structured attributes (auditable, also better tags)
  concept_text text,              -- CN sentence = embed/rerank document
  embedding vector(1024),
  model text, created_at timestamptz
)
-- pgvector extension + hnsw/ivfflat index on embedding
```

## Build phases

Phase 1 — Enrichment (offline, idempotent):
1. Manual SQL migration: enable `vector`, create `style_concept` + index. (user applies in Supabase)
2. `nailed_agents/enrich.py`: for each published hero-merchant style missing/stale concept → download
   image (service-role storage) → VLM concept JSON → concept_text → Cohere embed → upsert. Idempotent on
   `source_media_asset_id`.
3. CLI `python -m nailed_agents.enrich`. Config: `COHERE_API_KEY`, model names, `EMBED_DIM`.

Phase 2 — Matcher:
4. `nailed_agents/matching.py`: `match(keyword) → embed → pgvector top-k → Cohere rerank → threshold`.
5. Wire into `trend_logic`: `MATCH_MODE=tag|concept` (default keep tag; concept opt-in), tag fast-path as
   graceful fallback on API error (like the Pinterest seam — matching must never hard-fail a round).
6. Regression tests: (a) `法式`→珠光法式银月钻 top; (b) `chrome`→rejects non-chrome; (c) unrelated→gap;
   (d) threshold sanity (no match-everything).

Phase 3 — Integration + docs:
7. `get_trend_opportunities` uses the matcher; agent output shows matched styles + concept "why".
8. ADR-000X, implementation-log, current-state.

## Risks / mitigations

- **Cohere key/cost/limits** → one key; batch embed; degrade to tag-overlap on error.
- **VLM caption variance** → fixed JSON schema, low temp; store `model` for reproducibility.
- **Threshold calibration** → set from a handful of labeled trend↔style pairs; expose as config.
- **Concept staleness** → re-enrich when `source_media_asset_id` changes.
- **Determinism** → pin embed+rerank model versions; concepts cached (ADR-0006 grounding holds).

## Open decisions (need input before Phase 1)

1. Cohere key available, or use local BGE-m3+reranker (no key, +torch)?
2. Enrich scope: hero merchant only (matching is hero-scoped) — confirm.
3. Threshold: start ~0.3 rerank score, calibrate on spike examples.

## Eval outcome (2026-07-01) — supersedes the provisional provider pick above

Ran the rigorous model eval (32 concepts, 12-query bilingual graded gold; Recall/MRR/nDCG for embed,
P@1/MRR/nDCG for rerank; cost excluded). Result:
- **Embedding = google/gemini-embedding-001** (R@10 0.91, MRR 0.92, nDCG@10 0.88) — beat Cohere embed
  (0.78/0.79/0.67) and OpenAI-3-large/small decisively. So EMBED_PROVIDER defaults to `google`.
- **Rerank = cohere/rerank-multilingual-v3.5** (P@1 0.83, MRR 0.92) — LLM-judge gpt-4o was ~1 gold-query
  higher on P@1 (within noise) but slow/nondeterministic; Cohere is one fast deterministic call/round.

Net: **Google embed + Cohere rerank** (the split hypothesized), now evidence-based. Full numbers in
implementation-log 2026-07-01 and ADR-0008.
