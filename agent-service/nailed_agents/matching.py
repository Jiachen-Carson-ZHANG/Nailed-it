"""选品 hybrid concept matcher (design: docs/eval/2026-07-01-trend-matching-design.md).

trend keyword → Cohere embed (search_query) → pgvector cosine top-k over the merchant's cached
style_concept vectors (recall) → Cohere rerank (precision) → threshold. Exposed as an injectable
match_fn so trend_logic stays a pure function. Any failure (concept mode off, nothing enriched, Cohere
/ Supabase error) returns None → trend_logic falls back to tag-overlap for that trend (never hard-fails).
"""
from __future__ import annotations

import json
import math
from typing import Callable

from . import bus, cohere_client, config, embeddings

# match_fn(trend_label, trend_tags) -> [(style_id, score), ...]  |  None (→ tag fallback)
MatchFn = Callable[[str, list[str]], "list[tuple[str, float]] | None"]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def _load_concepts(sb, merchant_id: str) -> list[dict]:
    rows = sb.table("style_concept").select("style_id,concept_text,embedding") \
        .eq("merchant_id", merchant_id).execute().data
    for r in rows:
        emb = r.get("embedding")
        r["embedding"] = json.loads(emb) if isinstance(emb, str) else emb  # pgvector returns '[...]'
    return [r for r in rows if r.get("embedding")]


def match_trend(keyword: str, concepts: list[dict], *, top_k: int, threshold: float) -> list[tuple[str, float, str]]:
    """Embed keyword → cosine top-k → rerank → keep those ≥ threshold.
    Returns (style_id, rerank_score, why) — `why` is the concept_text, so the match is auditable (audit #5)."""
    qvec = embeddings.embed([keyword], "search_query")[0]
    ranked = sorted(concepts, key=lambda c: -_cosine(qvec, c["embedding"]))[:top_k]
    if not ranked:
        return []
    results = cohere_client.rerank(keyword, [c["concept_text"] for c in ranked], top_n=top_k)
    out: list[tuple[str, float, str]] = []
    for r in results:
        if r["relevance_score"] >= threshold:
            c = ranked[r["index"]]
            out.append((c["style_id"], round(float(r["relevance_score"]), 3), c["concept_text"]))
    return out


def make_match_fn(sb=None, merchant_id: str | None = None,
                  top_k: int | None = None, threshold: float | None = None) -> MatchFn:
    """Build the injectable matcher. Loads the merchant's concepts once; each call embeds+reranks one
    trend. If nothing is enriched or a call errors, returns None so trend_logic uses tag-overlap."""
    sb = sb or bus.supabase()
    merchant_id = merchant_id or config.MERCHANT_ID
    top_k = top_k or config.MATCH_TOP_K
    threshold = config.MATCH_THRESHOLD if threshold is None else threshold
    concepts = _load_concepts(sb, merchant_id)
    fallbacks: list[str] = []  # per-trend degrade reasons, surfaced by the caller (audit #4)

    def match_fn(label: str, _tags: list[str]) -> "list[tuple[str, float, str]] | None":
        if not concepts or not label.strip():
            fallbacks.append(f"«{label}»: no enriched concepts")
            return None  # not enriched → fall back to tag-overlap
        try:
            return match_trend(label, concepts, top_k=top_k, threshold=threshold)
        except Exception as e:  # Cohere/network error → degrade to tags for this trend
            reason = f"«{label}»: {type(e).__name__}"
            print(f"[matching] concept match failed for {reason}; tag fallback")
            fallbacks.append(reason)
            return None

    # expose for transcript/preflight visibility — did concept mode actually run, or silently fall back?
    match_fn.concepts_loaded = len(concepts)  # type: ignore[attr-defined]
    match_fn.fallbacks = fallbacks            # type: ignore[attr-defined]
    return match_fn
