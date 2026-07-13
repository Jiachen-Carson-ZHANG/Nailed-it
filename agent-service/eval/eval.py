"""Rigorous embed/rerank model eval for 选品 trend↔catalog matching.
Ranks all 32 cached hero concepts per gold query (no retrieval confound), scores each model.
Embedders + rerankers skip gracefully if their key is absent. See design in the chat / ADR-0008."""
import json, math, os, time
import httpx
from openai import OpenAI
from nailed_agents import config

HERE = os.path.dirname(__file__)
CONCEPTS = json.load(open(os.path.join(HERE, "concepts.json")))  # id -> {title, concept_text}
IDS = list(CONCEPTS)
DOCS = [CONCEPTS[i]["concept_text"] for i in IDS]
GEM_KEY = os.environ.get("GEMINI_API_KEY", "")

# ── Gold set: 12 queries (EN + CN, visual/color/occasion), relevance graded 2=strong 1=partial ──
GOLD = {
  "chrome mirror metallic nails": {"8282":2,"8284":2,"8278":1,"8280":1,"8253":1},
  "cat eye nails 猫眼":            {"8260":2,"8274":2,"8253":2},
  "cartoon cute character nails":  {"8277":2,"8279":2,"8249":2,"8273":2,"8254":1,"8280":1,"8251":1},
  "elegant bridal wedding french": {"8264":2,"8275":2,"8259":2,"8265":2,"8255":1,"8258":1,"8271":1,"8260":1},
  "蓝色 blue nails":               {"8282":2,"8253":2,"8262":2,"8251":1,"8280":1},
  "薄荷绿 mint green nails":        {"8270":2,"8267":1},
  "snowflake winter nails":        {"8261":2},
  "派对奢华 party luxury glam":     {"8257":2,"8284":2,"8276":2,"8261":1},
  "黄色 yellow nails":             {"8277":2,"8256":2,"8273":1},
  "milky nude jelly nails":        {"8266":2,"8252":2,"8271":2,"8256":1,"8255":1,"8264":1},
  "star pattern nails 星星":        {"8253":2,"8280":2,"8250":2,"8251":2,"8263":2,"8273":1,"8261":1},
  "french tip 法式":               {"8264":2,"8271":2,"8265":2,"8256":2,"8255":2,"8259":2,"8275":2,
                                    "8258":1,"8254":1,"8249":1,"8279":1,"8250":1,"8284":1,"8263":1},
}
# gold keys are numeric suffixes; catalog ids are 'style-melissa-img-NNNN' — normalize to full ids.
GOLD = {q: {f"style-melissa-img-{k}": v for k, v in rels.items()} for q, rels in GOLD.items()}
assert all(sid in CONCEPTS for rels in GOLD.values() for sid in rels), "gold id not in catalog"

# ── metrics ──────────────────────────────────────────────────────────────────────────────────────
def _dcg(rels): return sum(r / math.log2(i + 2) for i, r in enumerate(rels))
def ndcg(ranked, gold, k):
    ideal = sorted(gold.values(), reverse=True)[:k]
    idcg = _dcg(ideal)
    return _dcg([gold.get(s, 0) for s in ranked[:k]]) / idcg if idcg else 0.0
def recall(ranked, gold, k):
    rel = {s for s, g in gold.items() if g > 0}
    return len(set(ranked[:k]) & rel) / len(rel) if rel else 0.0
def mrr(ranked, gold):
    for i, s in enumerate(ranked):
        if gold.get(s, 0) > 0: return 1 / (i + 1)
    return 0.0
def p1(ranked, gold): return 1.0 if gold.get(ranked[0], 0) > 0 else 0.0
def _cos(a, b):
    d = sum(x*y for x, y in zip(a, b)); na = math.sqrt(sum(x*x for x in a)) or 1; nb = math.sqrt(sum(y*y for y in b)) or 1
    return d / (na*nb)

# ── embedders (return {id: vec} for docs, and a fn for queries) ────────────────────────────────────
def google_embed(texts, task):
    out = []
    for t in texts:
        r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEM_KEY}",
            json={"content":{"parts":[{"text":t}]},"taskType":task,"outputDimensionality":1024}, timeout=30)
        r.raise_for_status(); out.append(r.json()["embedding"]["values"])
    return out
def openrouter_embed(model, texts, _task=None):
    r = httpx.post(f"{config.OPENROUTER_BASE_URL}/embeddings",
        headers={"Authorization": f"Bearer {config.OPENROUTER_API_KEY}"},
        json={"model": model, "input": texts}, timeout=60); r.raise_for_status()
    return [d["embedding"] for d in r.json()["data"]]
def cohere_embed(texts, input_type):
    from nailed_agents import cohere_client
    return cohere_client.embed(texts, input_type)

EMBEDDERS = {
  "google/gemini-embedding-001": (lambda tx: google_embed(tx, "RETRIEVAL_DOCUMENT"),
                                   lambda q: google_embed([q], "RETRIEVAL_QUERY")[0], bool(GEM_KEY)),
  "openrouter/text-embedding-3-large": (lambda tx: openrouter_embed("openai/text-embedding-3-large", tx),
                                        lambda q: openrouter_embed("openai/text-embedding-3-large", [q])[0], bool(config.OPENROUTER_API_KEY)),
  "openrouter/text-embedding-3-small": (lambda tx: openrouter_embed("openai/text-embedding-3-small", tx),
                                        lambda q: openrouter_embed("openai/text-embedding-3-small", [q])[0], bool(config.OPENROUTER_API_KEY)),
  "cohere/embed-multilingual-v3.0": (lambda tx: cohere_embed(tx, "search_document"),
                                     lambda q: cohere_embed([q], "search_query")[0], bool(config.COHERE_API_KEY)),
}

# ── rerankers: rank all 32 docs for a query → ordered ids ──────────────────────────────────────────
def cohere_rerank(query):
    from nailed_agents import cohere_client
    res = cohere_client.rerank(query, DOCS, top_n=len(DOCS))
    return [IDS[r["index"]] for r in res]
def llm_judge(model):
    holder: dict = {}  # lazy client — constructing OpenAI() with no key crashes before skip logic
    def rank(query):
        client = holder.get("c") or holder.setdefault(
            "c", OpenAI(api_key=config.OPENROUTER_API_KEY, base_url=config.OPENROUTER_BASE_URL))
        payload = [{"id": IDS[i], "c": DOCS[i]} for i in range(len(IDS))]
        r = client.chat.completions.create(model=model, max_tokens=3000,
            messages=[{"role":"user","content":
                f"趋势关键词「{query}」。为每个美甲概念打 0-100 分(含视觉+场景)。只输出 JSON 数组 "
                f'[{{"id":"","s":0}}]，按分降序，覆盖全部。\n{json.dumps(payload, ensure_ascii=False)}'}])
        t = (r.choices[0].message.content or "[]").strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        t = t[t.find("["): t.rfind("]")+1]
        ranked = [x["id"] for x in json.loads(t)]
        return ranked + [i for i in IDS if i not in ranked]  # append any dropped
    return rank

RERANKERS = {
  "cohere/rerank-multilingual-v3.5": (cohere_rerank, bool(config.COHERE_API_KEY)),
  "llm-judge/gemini-2.5-flash": (llm_judge("google/gemini-2.5-flash"), bool(config.OPENROUTER_API_KEY)),
  "llm-judge/gpt-4o": (llm_judge("openai/gpt-4o"), bool(config.OPENROUTER_API_KEY)),
}

def score_embedders():
    print("\n=== EMBEDDERS (rank all 32 by cosine) ===")
    print(f"{'model':40s} {'R@5':>6}{'R@10':>6}{'MRR':>6}{'nDCG@10':>9}")
    rows = {}
    for name, (embed_docs, embed_q, ok) in EMBEDDERS.items():
        if not ok:
            print(f"{name:40s}   — skipped (no key)"); continue
        try:
            dv = embed_docs(DOCS); dvecs = dict(zip(IDS, dv))
            r5=r10=mr=nd=0.0
            for q, gold in GOLD.items():
                qv = embed_q(q)
                ranked = sorted(IDS, key=lambda s: -_cos(qv, dvecs[s]))
                r5+=recall(ranked,gold,5); r10+=recall(ranked,gold,10); mr+=mrr(ranked,gold); nd+=ndcg(ranked,gold,10)
            n=len(GOLD); rows[name]=(r5/n,r10/n,mr/n,nd/n)
            print(f"{name:40s} {r5/n:6.2f}{r10/n:6.2f}{mr/n:6.2f}{nd/n:9.2f}")
        except Exception as e:
            print(f"{name:40s}   ERR {type(e).__name__}: {str(e)[:80]}")
    return rows

def score_rerankers():
    print("\n=== RERANKERS (rank all 32 per query) ===")
    print(f"{'model':40s} {'P@1':>6}{'MRR':>6}{'nDCG@5':>8}{'nDCG@10':>9}")
    rows = {}
    for name, (rank_fn, ok) in RERANKERS.items():
        if not ok:
            print(f"{name:40s}   — skipped (no key)"); continue
        try:
            p=mr=n5=n10=0.0
            for q, gold in GOLD.items():
                ranked = rank_fn(q)
                p+=p1(ranked,gold); mr+=mrr(ranked,gold); n5+=ndcg(ranked,gold,5); n10+=ndcg(ranked,gold,10)
                time.sleep(0.1)
            n=len(GOLD); rows[name]=(p/n,mr/n,n5/n,n10/n)
            print(f"{name:40s} {p/n:6.2f}{mr/n:6.2f}{n5/n:8.2f}{n10/n:9.2f}")
        except Exception as e:
            print(f"{name:40s}   ERR {type(e).__name__}: {str(e)[:80]}")
    return rows

if __name__ == "__main__":
    print(f"catalog={len(IDS)} styles, gold queries={len(GOLD)}")
    score_embedders()
    score_rerankers()
