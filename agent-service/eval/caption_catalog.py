"""Eval prep: caption all hero nail photos once → cache concept_text + title to concepts.json.
Reuses the enrich VLM prompt. Idempotent — skips styles already in the cache."""
import base64, json, os
from openai import OpenAI
from nailed_agents import bus, config, enrich

CACHE = os.path.join(os.path.dirname(__file__), "concepts.json")
client = OpenAI(api_key=config.OPENROUTER_API_KEY, base_url=config.OPENROUTER_BASE_URL)

cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
sb = bus.supabase()
rows = sb.table("merchant_style").select("id,title,primary_media_asset_id") \
    .eq("merchant_id", config.MERCHANT_ID).eq("status", "published").execute().data
media = {m["id"]: m for m in sb.table("media_asset").select("id,original_bucket,original_path")
         .in_("id", [r["primary_media_asset_id"] for r in rows if r.get("primary_media_asset_id")]).execute().data}

for i, r in enumerate(rows, 1):
    if r["id"] in cache:
        continue
    m = media.get(r.get("primary_media_asset_id"))
    if not m:
        continue
    img = sb.storage.from_(m["original_bucket"]).download(m["original_path"])
    concept = enrich._caption(img)
    cache[r["id"]] = {"title": r["title"], "concept": concept, "concept_text": enrich._concept_text(concept)}
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=2)
    print(f"[{i}/{len(rows)}] {r['id']} «{r['title']}» → {cache[r['id']]['concept_text']}")

print(f"\ncached {len(cache)} concepts → {CACHE}")
