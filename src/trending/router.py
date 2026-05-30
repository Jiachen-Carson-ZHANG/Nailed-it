import time

from fastapi import APIRouter

from src.trending.pipeline import run_trending
from src.trending.schemas import TrendingResponse

router = APIRouter(tags=["trending"])

_TTL = 3600.0
_cache: TrendingResponse | None = None
_cache_at: float = 0.0


@router.get("/trending", response_model=TrendingResponse)
async def trending(refresh: bool = False) -> TrendingResponse:
    global _cache, _cache_at
    if not refresh and _cache is not None and (time.time() - _cache_at) < _TTL:
        return _cache
    _cache = await run_trending()
    _cache_at = time.time()
    return _cache
