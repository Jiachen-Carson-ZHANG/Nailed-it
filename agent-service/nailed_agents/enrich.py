"""选品 concept enrichment (offline, idempotent). For each published hero-merchant style, a VLM reads
the nail photo → structured CN concept → concept_text → Cohere embedding → upsert into style_concept.
Skips styles already enriched from the same image (source_media_asset_id). Design:
docs/eval/2026-07-01-trend-matching-design.md.

    python -m nailed_agents.enrich          # enrich missing/stale
    python -m nailed_agents.enrich --force  # re-enrich all
"""
from __future__ import annotations

import argparse
import base64
import json

from openai import OpenAI

from . import bus, config

_MERCHANT = config.MERCHANT_ID
# Bump when the concept PROMPT, JSON schema, or _concept_text flattening changes — forces re-enrich
# even if the image + models are unchanged (the stored concept depends on all of these).
PIPELINE_VERSION = "2026-07-02.1"

_CAPTION_PROMPT = (
    "你是美甲视觉标注专家。只看这张美甲图片，用中文输出严格 JSON，字段："
    '{"形状":"","长度":"","底色":"","质感":[],"图案":[],"装饰":[],"风格":[],"适合场景":[]}。'
    "只描述看得见的；风格/适合场景可合理推断（如节日、通勤、婚礼）。不要多余文字。"
)

_vlm: OpenAI | None = None


def _vlm_client() -> OpenAI:
    """Vision runs on OpenRouter (multimodal) regardless of MODEL_PROVIDER."""
    global _vlm
    if _vlm is None:
        _vlm = OpenAI(api_key=config.OPENROUTER_API_KEY, base_url=config.OPENROUTER_BASE_URL)
    return _vlm


def _caption(img_bytes: bytes) -> dict:
    b64 = base64.b64encode(img_bytes).decode()
    r = _vlm_client().chat.completions.create(
        model=config.ENRICH_VLM_MODEL, max_tokens=500,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": _CAPTION_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]}],
    )
    txt = (r.choices[0].message.content or "{}").strip()
    txt = txt.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    txt = txt[txt.find("{"): txt.rfind("}") + 1] or "{}"
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        return {}


def _concept_text(c: dict) -> str:
    """Flatten the concept JSON into one CN sentence — the embed / rerank document."""
    def part(label: str, val) -> str:
        if not val:
            return ""
        return f"{label}{('、'.join(val) if isinstance(val, list) else val)}"
    bits = [
        part("", c.get("形状")), part("", c.get("长度")),
        part("底色", c.get("底色")), part("质感", c.get("质感")),
        part("图案", c.get("图案")), part("装饰", c.get("装饰")),
        part("风格", c.get("风格")), part("适合", c.get("适合场景")),
    ]
    return "，".join(b for b in bits if b) + "。"


def _to_pgvector(vec: list[float]) -> str:
    """pgvector text-input literal: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def enrich_all(force: bool = False) -> None:
    from .embeddings import embed  # provider per EMBED_PROVIDER (default google/gemini-embedding-001)

    key_name, key_val = config._EMBED_PROVIDER_KEY.get(config.EMBED_PROVIDER, ("", ""))
    if not key_val:
        raise SystemExit(f"Missing {key_name} in .env.local (needed to embed concepts; EMBED_PROVIDER={config.EMBED_PROVIDER}).")

    sb = bus.supabase()
    styles = sb.table("merchant_style").select("id,title,primary_media_asset_id") \
        .eq("merchant_id", _MERCHANT).eq("status", "published").execute().data
    model_id = f"{config.ENRICH_VLM_MODEL}+{config.EMBED_PROVIDER}/{config.EMBED_MODEL}"
    # staleness key = (image, models, pipeline version). A row is reused only if ALL match — so changing
    # the VLM/embed model, prompt, schema, or flattening (via PIPELINE_VERSION) forces re-enrich (audit #3).
    have = {r["style_id"]: (r.get("source_media_asset_id"), r.get("model"), r.get("pipeline_version"))
            for r in sb.table("style_concept").select("style_id,source_media_asset_id,model,pipeline_version")
            .eq("merchant_id", _MERCHANT).execute().data}
    media = {m["id"]: m for m in sb.table("media_asset").select("id,original_bucket,original_path")
             .in_("id", [s["primary_media_asset_id"] for s in styles if s.get("primary_media_asset_id")]).execute().data}

    def _fresh(s: dict) -> bool:
        return have.get(s["id"]) == (s.get("primary_media_asset_id"), model_id, PIPELINE_VERSION)

    todo = [s for s in styles if force or not _fresh(s)]
    print(f"hero styles={len(styles)}  already enriched={len(have)}  to (re)enrich={len(todo)}  "
          f"(model={model_id}, pipeline={PIPELINE_VERSION})")

    for i, s in enumerate(todo, 1):
        mid = s.get("primary_media_asset_id")
        m = media.get(mid)
        if not m:
            print(f"  [{i}/{len(todo)}] {s['id']} «{s['title']}» — no media, skip")
            continue
        img = sb.storage.from_(m["original_bucket"]).download(m["original_path"])
        concept = _caption(img)
        text = _concept_text(concept)
        vec = embed([text], "search_document")[0]
        sb.table("style_concept").upsert({
            "style_id": s["id"], "merchant_id": _MERCHANT, "source_media_asset_id": mid,
            "concept_json": concept, "concept_text": text, "embedding": _to_pgvector(vec),
            "model": model_id, "pipeline_version": PIPELINE_VERSION, "updated_at": bus.now_iso(),
        }, on_conflict="style_id").execute()
        print(f"  [{i}/{len(todo)}] {s['id']} «{s['title']}» → {text}")
    print("enrichment complete.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-enrich every style (ignore cache)")
    enrich_all(force=ap.parse_args().force)
