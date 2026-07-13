"""Match REAL live Pinterest trends against the real catalog, using the production models
(Google embed → cosine top-k → Cohere rerank → threshold). Uses the cached 32 concepts (DB-free)."""
import json, os, time
from nailed_agents import config, trends_source, matching, embeddings

CACHE = os.path.join(os.path.dirname(__file__), "concepts.json")
C = json.load(open(CACHE))
concepts = [{"style_id": sid, "title": v["title"], "concept_text": v["concept_text"]} for sid, v in C.items()]

# embed the 32 concept docs once (Google, search_document)
print(f"embedding {len(concepts)} concept docs via {config.EMBED_PROVIDER}/{config.EMBED_MODEL} ...")
vecs = embeddings.embed([c["concept_text"] for c in concepts], "search_document")
for c, v in zip(concepts, vecs):
    c["embedding"] = v
title = {c["style_id"]: c["title"] for c in concepts}

# real live Pinterest trends (US / beauty / growing)
trends = trends_source._fetch_pinterest(limit=12, trend_type="growing")
print(f"\nfetched {len(trends)} live Pinterest trends (region={config.PINTEREST_REGION}, interests={config.PINTEREST_INTERESTS})")
print(f"threshold={config.MATCH_THRESHOLD}\n" + "=" * 78)

matched = 0
for t in trends:
    kw = t["label"]
    # get full ranked candidates (threshold 0 to see the scores), then apply threshold
    scored = matching.match_trend(kw, concepts, top_k=5, threshold=0.0)
    top = scored[:3]
    verdict = "MATCH" if top and top[0][1] >= config.MATCH_THRESHOLD else "gap"
    if verdict == "MATCH":
        matched += 1
    g = t.get("growth", {})
    print(f"\n『{kw}』  (MoM {g.get('mom')}%)  →  {verdict}")
    for sid, sc, *_ in top:
        mark = "✓" if sc >= config.MATCH_THRESHOLD else " "
        print(f"    {mark} {sc:.3f}  {title[sid]}")
    time.sleep(6.5)  # Cohere trial rerank = 10/min → space calls

print("\n" + "=" * 78)
print(f"MATCHED {matched}/{len(trends)}  |  gaps {len(trends)-matched}/{len(trends)}  (threshold {config.MATCH_THRESHOLD})")
