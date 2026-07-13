"""Text embeddings for 选品 concept matching, provider-selected by EMBED_PROVIDER. Chosen by eval
(2026-07-01, docs/eval/2026-07-01-trend-matching-design.md): google/gemini-embedding-001 won cross-lingual
recall + ranking decisively (R@10 0.91, MRR 0.92) over Cohere / OpenAI-3. Rerank stays Cohere (see
cohere_client). One interface: embed(texts, input_type) where input_type ∈ {search_document, search_query}.
"""
from __future__ import annotations

import os

import httpx

from . import config

# search_document/search_query → Google taskType
_GOOGLE_TASK = {"search_document": "RETRIEVAL_DOCUMENT", "search_query": "RETRIEVAL_QUERY"}
_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")


def _google(texts: list[str], input_type: str) -> list[list[float]]:
    task = _GOOGLE_TASK.get(input_type, "RETRIEVAL_DOCUMENT")
    out: list[list[float]] = []
    for t in texts:  # embedContent is single-text; batchEmbedContents exists if volume grows
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{config.EMBED_MODEL}:embedContent?key={_GEMINI_KEY}",
            json={"content": {"parts": [{"text": t}]}, "taskType": task, "outputDimensionality": config.EMBED_DIM},
            timeout=30.0,
        )
        r.raise_for_status()
        out.append(r.json()["embedding"]["values"])
    return out


def _openrouter(texts: list[str], _input_type: str) -> list[list[float]]:
    # request EMBED_DIM so the vector fits the style_concept.embedding vector(1024) column — OpenAI-3
    # embeddings default to 3072 and support a `dimensions` param (MRL truncation).
    r = httpx.post(
        f"{config.OPENROUTER_BASE_URL}/embeddings",
        headers={"Authorization": f"Bearer {config.OPENROUTER_API_KEY}"},
        json={"model": config.EMBED_MODEL, "input": texts, "dimensions": config.EMBED_DIM}, timeout=60.0,
    )
    r.raise_for_status()
    vecs = [d["embedding"] for d in r.json()["data"]]
    if vecs and len(vecs[0]) != config.EMBED_DIM:  # model ignored dimensions → fail loud, don't corrupt the column
        raise SystemExit(f"EMBED_PROVIDER=openrouter model {config.EMBED_MODEL} returned dim "
                         f"{len(vecs[0])} != {config.EMBED_DIM}; use a model that supports `dimensions` (e.g. openai/text-embedding-3-*).")
    return vecs


def embed(texts: list[str], input_type: str) -> list[list[float]]:
    """input_type ∈ {'search_document','search_query'}. Returns one vector per text."""
    if config.EMBED_PROVIDER == "google":
        return _google(texts, input_type)
    if config.EMBED_PROVIDER == "cohere":
        from . import cohere_client
        return cohere_client.embed(texts, input_type)
    if config.EMBED_PROVIDER == "openrouter":
        return _openrouter(texts, input_type)
    raise SystemExit(f"Unknown EMBED_PROVIDER '{config.EMBED_PROVIDER}' — use google|cohere|openrouter.")
