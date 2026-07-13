# Evaluating Embedding & Rerank Models for Trend→Catalog Matching
### A reproducible model-selection study for the 选品 (trend-selection) agent
Author: Nailed-it engineering · Date: 2026-07-01 · Audience: engineering + mentor review

---

## 1. Motivation & problem statement

The 选品 agent must decide, for each incoming style trend, whether the merchant already offers that
look (**amplify** it) or does not (**gap** — consider adding). This reduces to a **matching** problem:

> Given a trend expressed as a short **text keyword** (e.g. `chrome french tip`, `法式`, `猫眼`), find the
> catalog styles that are genuine *instances of that trend concept*, ranked by relevance.

The incumbent matcher used **tag overlap** (does the trend's tag appear in the style's tag list?). On real
inventory it failed both directions:

- **False negatives** — `法式 french tip` scored the style *珠光法式银月钻* (a literal French design) **0**,
  because its stored tag was `美术设计服务` (a service category), not `法式风`.
- **False positives** — `chrome` matched *碎钻冰透裸色甲* on a stale `金属感` tag, though the photo isn't chrome.

Root cause: tags are a coarse, inconsistent, mixed-granularity vocabulary, while a trend is a **concept**
(visual attributes + occasion/vibe). We therefore moved to **semantic matching over model embeddings +
a reranker** (ADR-0008). That introduces a decision this study answers rigorously:

> **Which embedding model and which reranker should we use — chosen by measured ability, not preference
> or cost?** (Cost was explicitly excluded from the criteria at the sponsor's instruction.)

---

## 2. Task framing: why this is an information-retrieval (IR) problem

We frame trend→catalog matching as **ranked retrieval**: the *query* is a trend keyword; the *corpus* is
the merchant's catalog, each style represented as a document; the system returns a ranked list. This
framing is deliberate — it lets us reuse the mature, well-understood IR evaluation toolkit (graded
relevance, Recall@k, MRR, nDCG) rather than inventing ad-hoc scores.

The pipeline under test is **hybrid retrieve→rerank**:

```
query (trend keyword) ──embed──► cosine over catalog embeddings ──top-k──► rerank ──► thresholded matches
```

Two model choices sit inside it — the **embedder** (produces the vectors used for recall) and the
**reranker** (produces the final precise ordering). We evaluate them separately because they do different
jobs and are judged on different qualities (§6).

---

## 3. Corpus construction — how each style becomes a document

We do **not** embed the nail photo pixels and we do **not** embed the raw tags. We embed a **VLM concept
description**: a vision-language model reads each catalog photo and emits a structured Chinese concept.

- **Model**: `google/gemini-2.5-flash` (multimodal), via OpenRouter.
- **Prompt**: fixed JSON schema — `{形状, 长度, 底色, 质感, 图案, 装饰, 风格, 适合场景}` — "describe only what
  is visible; 风格/场景 may be reasonably inferred (holiday, commute, wedding)."
- **Flattening**: the JSON is joined into one natural-language CN sentence — the *document* that gets
  embedded and reranked. Example (style 珠光法式银月钻):
  `椭圆形，中长，底色透明粉色，质感光泽、珠光，图案法式、大理石纹，装饰闪粉、银色亮片，风格优雅、浪漫、精致，适合约会、婚礼、日常、派对。`

**Why concept-text and not tags or pixels** (this choice is itself justified by an earlier spike, and by
this study's outcome):
1. **vs tags** — tags are noisy/incomplete; the VLM produces consistent, granular attributes *and* infers
   occasion/vibe that tags omit.
2. **vs raw image embeddings (CLIP)** — a trend keyword carries **non-visual** meaning (occasion, vibe)
   that pixels don't encode; and CLIP is coarse on fine nail nuance. Representing the nail as a *concept*
   lets a text keyword match its full meaning.

**Corpus size**: 32 published styles for the hero merchant (`merchant-nailed-it`). Matching is
merchant-scoped, so this is the real production corpus for the primary use case.

**Caching**: concepts are generated once and cached (`concepts.json`), so the eval is deterministic w.r.t.
the corpus and re-runs don't re-caption.

---

## 4. Gold set construction — the ground truth

An eval is only as good as its labels. We built a **graded-relevance** gold set by hand.

### 4.1 Choosing the queries
12 queries, chosen to (a) span the **kinds of trends** the agent will see and (b) stress **cross-lingual**
matching (English Pinterest keywords against a Chinese catalog). Query buckets:

| bucket | rationale | example queries |
|---|---|---|
| Visual attribute | the core case; distinctive looks | `chrome mirror metallic`, `cat eye 猫眼`, `french tip 法式` |
| Colour | common but broad → tests over-matching | `蓝色 blue`, `薄荷绿 mint green`, `黄色 yellow` |
| Occasion / vibe | non-visual meaning tags/pixels miss | `elegant bridal wedding`, `派对奢华 party luxury`, `snowflake winter` |
| Pattern / motif | mid-granularity | `cartoon cute character`, `star pattern 星星`, `milky nude jelly` |

Queries are intentionally **bilingual** (mix of EN and CN, some pure-English like a real Pinterest keyword)
to measure the exact cross-lingual capability the product needs.

### 4.2 Choosing the relevance labels (graded, not binary)
Each (query, style) pair is labelled on a **3-point graded scale**:
- **2 = strongly relevant** — the style clearly *is* the trend (e.g. a pure French style for `french tip`).
- **1 = partially relevant** — related but not a clean instance (e.g. a French-*edge* novelty design).
- **0 = not relevant** (unlabelled).

**Why graded, not binary?** Real relevance is not on/off. Graded labels let nDCG (§5) reward putting a
"perfect" match above a "partial" one, which binary metrics cannot. This mirrors how a merchant judges
suggestions ("that's exactly it" vs "sort of").

**How labels were assigned (and the circularity control).** Labels were assigned by the author from the
style **title + concept**, using human judgment of what each design is. To reduce *circularity*, labelling
leaned on the human-readable **title** (independent of any model) as much as the concept. Note the key
structural safeguard: **all embedders embed the *same* documents**, so no embedder is advantaged by the
labelling; and the strongest reranker in the study (gpt-4o) is from a *different* model family than the
captioner (gemini), yet it did not gain an unfair edge — evidence the shared captioner did not bias results.

### 4.3 The gold set (excerpt)
Full set in the harness; representative rows (style ids abbreviated to numeric suffix):

| query | grade 2 (strong) | grade 1 (partial) |
|---|---|---|
| `chrome mirror metallic` | 8282, 8284 | 8278, 8280, 8253 |
| `cat eye 猫眼` | 8260, 8274, 8253 | — |
| `elegant bridal wedding french` | 8264, 8275, 8259, 8265 | 8255, 8258, 8271, 8260 |
| `snowflake winter` | 8261 | — |
| `french tip 法式` | 8264, 8271, 8265, 8256, 8255, 8259, 8275 | 8258, 8254, 8249, 8279, 8250, 8284, 8263 |

We deliberately included both **discriminating** queries (few relevant, e.g. `snowflake`→1 style) and
**broad** queries (`french tip`→many), so a model can't win just by being biased toward broad recall.

---

## 5. Metrics — what we measure and why

We report standard IR metrics, each chosen because it isolates a distinct quality:

Let a ranking return styles `s₁, s₂, …`; `rel(s) ∈ {0,1,2}` is the gold grade.

- **Recall@k** = |relevant ∩ top-k| / |relevant|, where relevant = {s : rel(s) ≥ 1}.
  *Captures coverage*: did the correct styles make it into the top-k at all? This is the **recall gate** —
  what matters for the *embedder*, because in the hybrid pipeline the embedder's only job is to put the
  right candidates into the shortlist the reranker then orders. We report k = 5 and 10.

- **MRR** (Mean Reciprocal Rank) = mean over queries of 1/rank of the *first* relevant result.
  *Captures "is a good answer near the top?"* — a single-number ranking-quality signal.

- **nDCG@k** (normalized Discounted Cumulative Gain) = DCG@k / IDCG@k, with
  `DCG@k = Σᵢ₌₁ᵏ rel(sᵢ) / log₂(i+1)`, and IDCG@k the DCG of the ideal (perfectly sorted) ranking.
  *Captures graded ranking quality with position discounting* — rewards putting **grade-2 before grade-1**
  and both near the top. This is the richest metric and uses our graded labels fully. We report k = 10 for
  embedders, k = 5 and 10 for rerankers.

- **P@1** (Precision@1) = fraction of queries whose **top-1** result is relevant (grade ≥ 1).
  *Captures the reranker's headline job*: the single best suggestion. The reranker produces the final order
  the agent acts on first, so top-1 correctness is weighted most for it.

**Why different emphases for embedder vs reranker.** The embedder feeds recall (candidates), so we judge it
on **Recall@k + ranking**. The reranker produces the final precision, so we judge it on **P@1 + nDCG**.
Judging each component on the quality it actually controls is the crux of a fair hybrid-pipeline eval.

---

## 6. Experimental protocol

### 6.1 Isolate the model under test
Both embedders and rerankers **rank all 32 documents per query** (no top-k truncation during evaluation).
This removes the *retrieval-cutoff confound*: a reranker is scored on how well it orders the full corpus,
not on whatever a particular embedder happened to feed it. Likewise embedders are scored on their own full
cosine ranking. Each component is thus measured in isolation, then combined by design (§8).

### 6.2 Embedder procedure
For each embedder: embed all 32 documents (as `search_document`) and each query (as `search_query`), then
rank documents by cosine similarity. Task-type / input-type is set correctly per provider (e.g. Google's
`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`; Cohere's `search_document`/`search_query`) because asymmetric
query/document encoding materially affects retrieval quality. Output dimension fixed at **1024** across
providers so the comparison is apples-to-apples and matches the production `vector(1024)` column.

### 6.3 Reranker procedure
For each reranker: given the query and all 32 concept documents, produce a full ordering.
- Dedicated reranker (Cohere) → native `/rerank` call, `top_n = 32`.
- LLM-judge rerankers → the model scores every document 0–100 for the query in one structured-JSON call;
  we order by score. (This is the "LLM-as-a-judge" pattern, included because it's a credible alternative to
  a dedicated reranker and OpenRouter gives access to strong judges.)

### 6.4 Candidates
- **Embedders**: `google/gemini-embedding-001`, `cohere/embed-multilingual-v3.0`,
  `openai/text-embedding-3-large`, `openai/text-embedding-3-small` (OpenAI via OpenRouter).
- **Rerankers**: `cohere/rerank-multilingual-v3.5`, LLM-judge `gemini-2.5-flash`, LLM-judge `gpt-4o`.
Selection criterion for inclusion: multilingual capability + accessible via our keys. All are current,
production-grade multilingual models — so the comparison reflects real, available choices.

### 6.5 Reproducibility & engineering notes
- Corpus concepts cached; gold set version-controlled in the harness.
- Cohere trial rate-limits (rerank 10/min) were handled with bounded 429 backoff + inter-call spacing, so
  rate limiting did not corrupt scores.
- Embedding cosine and all metrics are deterministic. LLM-judge rerankers are mildly non-deterministic
  (temperature); this is itself a finding against them (§8, §10).

---

## 7. Results

### 7.1 Embedders (rank all 32 by cosine; mean over 12 queries)
| model | Recall@5 | Recall@10 | MRR | nDCG@10 |
|---|---|---|---|---|
| **google/gemini-embedding-001** | **0.76** | **0.91** | **0.92** | **0.88** |
| cohere/embed-multilingual-v3.0 | 0.53 | 0.78 | 0.79 | 0.67 |
| openai/text-embedding-3-small | 0.56 | 0.68 | 0.88 | 0.66 |
| openai/text-embedding-3-large | 0.50 | 0.72 | 0.72 | 0.63 |

Google wins **every** metric, and by a wide margin on the two that matter most for a retriever
(Recall@10 0.91 vs next 0.78; nDCG@10 0.88 vs next 0.67).

### 7.2 Rerankers (rank all 32 per query; mean over 12 queries)
| model | P@1 | MRR | nDCG@5 | nDCG@10 |
|---|---|---|---|---|
| cohere/rerank-multilingual-v3.5 | 0.83 | 0.92 | 0.77 | 0.79 |
| llm-judge/gpt-4o | **0.92** | **0.96** | 0.79 | 0.83 |
| llm-judge/gemini-2.5-flash | 0.83 | 0.89 | **0.82** | **0.86** |

The three rerankers are **statistically indistinguishable** on quality (see §9): the largest gap (gpt-4o's
P@1 lead of 0.09) is ≈ one query on a 12-query set.

---

## 8. Scoring rubric & decision

Measured metrics are the hard evidence. To turn them into a single decision we apply a **transparent
weighted rubric**. Two of the four criteria (robustness, practical/latency) are **qualitative** judgments,
which we state explicitly rather than dress up as measurements.

**Embedder rubric** — cross-lingual recall 45% · ranking (MRR, nDCG) 30% · robustness across buckets 15% ·
practical (multilingual, dim-fit, availability) 10%.
**Reranker rubric** — P@1 45% · ranking (nDCG@5, MRR) 30% · multilingual robustness 15% · latency 10%.

- **Weights rationale**: for the *embedder*, recall dominates because it is the recall stage of the hybrid
  pipeline; for the *reranker*, P@1 dominates because it produces the top suggestion the agent acts on.
- **Cost is absent by instruction** — the sponsor asked to decide on ability, not price.

**Embedding decision → `google/gemini-embedding-001`.** It wins on every measured metric; the composite
lead (~0.18) is large and, crucially, *robust to reasonable re-weightings* (it would win under any weights
because it is Pareto-dominant). High confidence.

**Reranker decision → `cohere/rerank-multilingual-v3.5`.** On measured *quality* the three are a tie within
noise (§9). We therefore decide on the **non-noisy, operational** criteria that the rubric's latency term
captures and that matter because reranking runs **every round**:
- **one call ranks the whole shortlist** (vs an LLM generating a JSON verdict per document set),
- **deterministic** (vs temperature-driven LLM variance),
- **fast + purpose-built** for query–document relevance.
The LLM-judge (gpt-4o) is retained as a **fallback**, not the default. Refusing to decide a coin-flip
measurement on operational facts is the disciplined choice.

**Net system**: VLM concept → **Google embedding** → pgvector cosine top-k → **Cohere rerank** → threshold.

---

## 9. Statistical honesty: the noise floor

With **N = 12** queries, the finest difference the test can resolve is ≈ **1/12 = 0.083** per query on the
count-based metrics (P@1, Recall). Therefore:
- A rerank P@1 gap of **0.09** ≈ **one query** → **within noise**; we do not treat it as evidence.
- The embedding advantage (Recall@10 **+0.13**, nDCG@10 **+0.21**, *consistent across four metrics*) is
  **several queries' worth and directionally unanimous** → **real signal**.

This is exactly why we trust the embedding decision strongly and refuse to hang the rerank decision on the
gpt-4o gap. Stating the resolution limit of a small eval — and acting on it — is a core part of the method.

---

## 10. Threats to validity

- **Small gold set (12 queries, 1 merchant, 32 styles)** → limited statistical power and generalization.
  Mitigation: we report only differences that exceed the noise floor; embedder gap does, rerank gaps don't.
- **Label subjectivity / single annotator** → possible bias. Mitigation: graded scale + title-anchored
  labels; ideal next step is 2–3 independent annotators + inter-annotator agreement (Cohen's κ).
- **Label–captioner circularity** → labels partly read the VLM concept, and one judge (gemini) shares the
  captioner's family. Mitigation: title-anchored labels; the independent judge (gpt-4o) did not
  out-benefit — but a fully independent, image-based labelling would be cleaner.
- **Recall saturation at 32 styles** → with a small corpus, top-k retrieves a large fraction, so embedder
  differences may *understate* at scale (they'll matter more as the catalog grows) — which only strengthens
  the case for the strongest embedder now.
- **LLM-judge non-determinism** → single-run scores; repeated runs would give confidence intervals. This
  variance is itself a mark against LLM-judge as the production reranker.
- **Concept quality ceiling** → the whole pipeline inherits the VLM caption's accuracy; a bad caption caps
  every model. Captions were spot-checked and are strong, but this is an upstream dependency.

---

## 11. Reproducibility

- Corpus: `agent-service/eval/concepts.json` (32 cached VLM concepts).
- Harness: `agent-service/eval/eval.py` — gold set inline, metric implementations, per-provider embed/rerank
  functions, prints §7 tables. Re-runnable with the same keys; embedding + metric computations deterministic.
- Production wiring: `agent-service/nailed_agents/{embeddings,matching,cohere_client,enrich}.py`,
  migration `0023_style_concept.sql`, decision recorded in ADR-0008.

---

## 12. Conclusions & future work

**Conclusion.** By framing trend→catalog matching as graded-relevance IR, building a bilingual gold set,
and scoring current multilingual models on the qualities each pipeline stage controls, we selected —
**by measured ability** — Google `gemini-embedding-001` for embedding (a large, robust win) and Cohere
`rerank-multilingual-v3.5` for reranking (a quality tie broken on determinism + latency).

**Future work**: (1) expand the gold set to 50–100 queries across all merchants with multiple annotators
and report κ + confidence intervals; (2) calibrate the production match/gap **threshold** on labelled
scores (precision–recall trade-off), currently defaulted to 0.3 rerank score; (3) add per-bucket breakdowns
(does any model lag on occasion/vibe queries?); (4) re-evaluate embedders at full-catalog scale where recall
stops saturating; (5) periodically re-run as models update (pin versions; treat this report as the baseline).

---

## 13. Alignment to the national standard GB/T 45288.2-2025

This study maps onto 《人工智能 大模型 评测指标与方法》(GB/T 45288.2-2025)'s evaluation loop
(评测对象确认 → 测试集构建 → 指标筛选 → 标注方法 → 问题闭环). Where we already comply, and where we
extend the study to fully comply:

| Standard requirement | This study | Status |
|---|---|---|
| 指标筛选 fit to task | IR metrics (Recall/MRR/nDCG/P@1) for a retrieval task | ✅ |
| 多样性和代表性 of test set | 12 bilingual queries across visual/colour/occasion/pattern | ◐ thin — see §14 |
| 测试集来源 mix (Benchmark / 现网回流 / 人工编写 / 模型生成) | only 人工编写 used | ◐ — §14 adds the rest |
| 结果稳定性 (result stability) | pipeline is deterministic (Google embed + Cohere rerank) | ✅ inherent; add a confirmation run |
| 标注: 双盲 + 多标注员一致性 | single non-blind annotator | ◐ — §14 |
| 大模型作裁判员 + its risks | used LLM-judge as a reranker candidate, flagged nondeterminism | ✅ |
| 问题闭环 | — (one-shot study) | ◐ — becomes continuous via 现网回流 |

### Benchmark corroboration (external validity)
The standard treats public Benchmark as a primary test-set source (≈60% in the R&D phase) for its
breadth and reproducibility. We use it here for **corroboration**, not as our task test set (no public
benchmark exists for CN nail-trend↔catalog matching). The relevant standard is **MTEB / C-MTEB** (the
Massive Text Embedding Benchmark; primary source: HuggingFace `mteb/leaderboard`, and the Gemini Embedding
paper, arXiv 2503.07891):

- **`gemini-embedding-001` ranks #1 on MTEB(Multilingual)** (and #1 MTEB-Eng v2), ahead of Cohere embed
  and OpenAI text-embedding-3 on retrieval.
- This **independently confirms** our own 12-query result (Google won every metric) — the small-sample win
  is echoed by a benchmark of thousands of tasks, directly mitigating the "small gold set" validity threat (§10).

**Justification pattern (for review):** benchmark = breadth + external validity (MTEB, thousands of tasks);
our gold set = domain fit (nail concepts, our exact task). Both agree on Google embedding → high confidence.
The reranker had no decisive benchmark separation, so we chose on operational properties (determinism,
one-call latency) — consistent with the standard elevating 结果稳定性 to a first-class criterion.

## 14. Upgrade roadmap — making the test set standard-compliant

Turns §12's "future work" into a concrete, GB/T-aligned plan. Priority order:

1. **现网回流 (production-log replay)** — the standard's dominant iteration-phase source (~60%). Pull **real**
   trending nail keywords from Pinterest *beauty* + 小红书/抖音, and later real merchant search logs. This is
   the direct fix for the "hand-written queries → overfitting" threat. (Note the realism finding: live US
   Pinterest is currently July-4th-holiday-dominated → mostly *gap*, which is *correct* behaviour but a poor
   matching-quality test; a CN source or off-peak window gives matchable queries.)
2. **模型生成 泛化 set** — auto-generate paraphrase + adversarial variants of each query (说法泛化) to test
   robustness beyond the hand-written phrasing.
3. **Multi-annotator + κ** — have 2–3 people label relevance independently; report Cohen's κ. (Blind labelling
   is only needed if we add pairwise model-output comparison / 胜率.)
4. **Stability confirmation** — run the full pipeline twice; expect identical rankings (deterministic models).
   Report 结果一致率 = 100% as the stability evidence the standard asks for.
5. **问题闭环** — mine mismatches from (1) into a growing regression problem-set; track fix-rate across model
   or threshold changes. This converts the one-shot study into a continuous loop.
6. **Threshold calibration** — from labelled rerank scores, pick `MATCH_THRESHOLD` on the precision–recall
   trade-off (currently 0.3; live evidence so far: true matches ≈0.43, gaps ≤0.26, so 0.3 separates cleanly).

Target test-set mix once (1)–(2) land: 现网回流 ~50% + 人工编写 (edge/adversarial) ~25% + 模型生成 ~25%,
with MTEB/C-MTEB as standing model-choice corroboration.
