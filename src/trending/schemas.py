from pydantic import BaseModel


class SearchLink(BaseModel):
    label: str
    url: str


class TrendingStyle(BaseModel):
    rank: int
    name: str
    name_zh: str
    description: str
    tags: list[str]
    search_links: list[SearchLink]


class TrendingResponse(BaseModel):
    styles: list[TrendingStyle]
    generated_at: str
    ttl_seconds: int = 3600
