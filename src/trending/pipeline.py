import json
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

from fastapi import HTTPException

from src.shared.openrouter import post_chat
from src.trending.schemas import SearchLink, TrendingResponse, TrendingStyle

_MODEL = "qwen/qwen3.6-flash"

_PROMPT_TEMPLATE = """You are a nail industry trend analyst. Today is {month_year}.

List the top 10 nail styles that are trending RIGHT NOW — based on what is currently popular on social media, in salons, and among beauty influencers this season.

Consider: current season aesthetics, recent viral looks, dominant color palettes for {month_year}, popular techniques and finishes gaining traction this month.
You can reference social media platforms if you have access, such as TikTok, Pinterest, 小红书 (rednote) etc.

Return ONLY a valid JSON array (no markdown, no explanation) with exactly 10 objects, each with:
{{
  "rank": <1-10>,
  "name": "<style name in English — keep it short and searchable, e.g. \\"Glazed Donut Nails\\">",
  "name_zh": "<style name in Chinese>",
  "description": "<one sentence describing the look and why it's trending now>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}}"""


def _build_search_links(name_en: str, name_zh: str) -> list[SearchLink]:
    en = quote_plus(f"{name_en} nails")
    zh = quote_plus(f"{name_zh} 美甲") if name_zh else en
    return [
        SearchLink(label="Pinterest", url=f"https://www.pinterest.com/search/pins/?q={en}"),
        SearchLink(label="小红书", url=f"https://www.xiaohongshu.com/search_result?keyword={zh}"),
        SearchLink(label="Google Images", url=f"https://www.google.com/search?tbm=isch&q={en}"),
        SearchLink(label="TikTok", url=f"https://www.tiktok.com/search?q={en}"),
    ]


async def run_trending() -> TrendingResponse:
    month_year = datetime.now(timezone.utc).strftime("%B %Y")
    prompt = _PROMPT_TEMPLATE.format(month_year=month_year)

    data = await post_chat({
        "model": _MODEL,
        "messages": [{"role": "user", "content": prompt}],
    })
    try:
        raw = data["choices"][0]["message"]["content"]
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        items = json.loads(raw)
        styles = [
            TrendingStyle(
                **item,
                search_links=_build_search_links(item["name"], item.get("name_zh", "")),
            )
            for item in items
        ]
        return TrendingResponse(
            styles=styles,
            generated_at=datetime.now(timezone.utc).isoformat(),
            ttl_seconds=3600,
        )
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse trending response: {exc}")
