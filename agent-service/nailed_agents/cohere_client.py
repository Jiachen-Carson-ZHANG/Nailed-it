"""Cohere embed + rerank via REST (httpx) — no SDK dependency. Two calls we use for 选品 concept
matching (design: docs/eval/2026-07-01-trend-matching-design.md):
  - embed:  concept docs (input_type='search_document') at enrichment; the trend keyword
            (input_type='search_query') at match time. Multilingual → EN keyword ↔ CN concept.
  - rerank: precisely order the pgvector candidates for a trend keyword.
"""
from __future__ import annotations

import time

import httpx

from . import config

_EMBED_BATCH = 96  # Cohere /v2/embed hard cap on texts per call
_MAX_RETRIES = 4   # rate limits (429) + transient 5xx — bounded backoff, respects Retry-After


def _post(path: str, body: dict) -> httpx.Response:
    """POST with bounded retry on 429/5xx (honours Retry-After when present)."""
    for attempt in range(_MAX_RETRIES):
        resp = httpx.post(
            f"{config.COHERE_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {config.COHERE_API_KEY}"},
            json=body, timeout=30.0,
        )
        if resp.status_code not in (429, 500, 502, 503) or attempt == _MAX_RETRIES - 1:
            return resp
        wait = float(resp.headers.get("Retry-After") or (2 ** attempt) * 3)
        time.sleep(wait)
    return resp  # unreachable


def embed(texts: list[str], input_type: str) -> list[list[float]]:
    """input_type: 'search_document' | 'search_query'. Returns one float vector per input text.
    Batched at 96 (the API cap)."""
    out: list[list[float]] = []
    for i in range(0, len(texts), _EMBED_BATCH):
        chunk = texts[i : i + _EMBED_BATCH]
        resp = _post("/embed", {"model": config.COHERE_EMBED_MODEL, "input_type": input_type,
                                "texts": chunk, "embedding_types": ["float"]})
        resp.raise_for_status()
        out.extend(resp.json()["embeddings"]["float"])
    return out


def rerank(query: str, documents: list[str], top_n: int | None = None) -> list[dict]:
    """Rerank documents against the query. Returns [{index, relevance_score}] (0..1), sorted desc."""
    body: dict = {"model": config.COHERE_RERANK_MODEL, "query": query, "documents": documents}
    if top_n:
        body["top_n"] = top_n
    resp = _post("/rerank", body)
    resp.raise_for_status()
    return resp.json()["results"]
