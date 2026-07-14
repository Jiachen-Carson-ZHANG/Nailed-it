"""External-trend source for the 趋势选品 agent (ADR-0008).

One seam, three sources via TREND_SOURCE:
  - "curated_visual" (default): preselected trend-image concepts. The images are sampled offline for
                           the demo, run through VLM once into `conceptQuery`, then matched through the
                           existing style_concept embed/rerank pipeline. No network key, deterministic.
  - "fixture"   (legacy alias): same deterministic curated pack; kept so older eval scripts keep working.
  - "pinterest" (live):    Pinterest Trends API (user-authorized token). NOTE: regions are Western only
                           (US, GB+IE, CA, AU+NZ, DE, FR, …) — NO China/Asia. Scoped to interest=beauty
                           and keyword-only, so it proves live ingestion but is NOT the demo's primary
                           source.

Returns a list of {"label": str, "tags": [str, ...], "conceptQuery": str, ...} either way. The trend
logic displays `label`, falls back to `tags`, and uses `conceptQuery` for concept matching when present.
"""
from __future__ import annotations

import base64
import math
from typing import Any

import httpx

from . import config

# Demo visual trend pack. `sourceImage` is an evidence pointer for docs/decks; matching uses
# `conceptQuery`, not the filename. Keep it compact: this module is a source fixture, not a dataset.
CURATED_VISUAL: list[dict[str, Any]] = [
    {
        "label": "银色镜面猫眼",
        "tags": ["银色", "镜面", "猫眼", "金属感", "辣妹风"],
        "conceptQuery": "银色镜面质感，猫眼光泽，长甲或杏仁形，派对感、辣妹风、金属感强",
        "sourceImage": "trendpack/silver-mirror-cat-eye.jpg",
        "strength": 0.88,
    },
    {
        "label": "暗黑哥特蝴蝶",
        "tags": ["暗黑", "黑色", "蝴蝶", "Y2K", "酷感"],
        "conceptQuery": "黑色暗黑风，美式哥特或 Y2K，蝴蝶/十字/银饰元素，适合酷感长甲",
        "sourceImage": "trendpack/dark-goth-butterfly.jpg",
        "strength": 0.82,
    },
    {
        "label": "水光果冻渐变",
        "tags": ["果冻感", "透色", "渐变", "水光", "清冷感"],
        "conceptQuery": "透色果冻质感，水光渐变，低饱和粉紫蓝，清透日常但有细闪",
        "sourceImage": "trendpack/jelly-aurora-gradient.jpg",
        "strength": 0.78,
    },
    {
        "label": "奶油裸色微法式",
        "tags": ["法式风", "裸色", "奶油色", "极简", "通勤"],
        "conceptQuery": "裸色或奶油色底，极细微笑线法式，短甲/方圆形，干净通勤新娘风",
        "sourceImage": "trendpack/micro-french-nude.jpg",
        "strength": 0.76,
    },
    {
        "label": "甜酷蝴蝶结珍珠",
        "tags": ["甜美", "蝴蝶结", "珍珠", "粉色", "可爱"],
        "conceptQuery": "粉色甜美风，蝴蝶结、珍珠、小钻装饰，甜酷/可爱，适合约会和拍照",
        "sourceImage": "trendpack/bow-pearl-sweet.jpg",
        "strength": 0.72,
    },
]
# Legacy name used by old eval scripts and docs. Same deterministic visual pack.
FIXTURE = CURATED_VISUAL

_token: str | None = None


def _pinterest_token() -> str:
    """Get a bearer token, cached per process. Preference order:
      1. refresh_token grant (user-authorized; the only path that reaches /trends) → fresh access token
      2. a directly-supplied PINTEREST_ACCESS_TOKEN
      3. client_credentials (app-only; mints a token but 401s on /trends — last resort)."""
    global _token
    if _token:
        return _token
    creds = base64.b64encode(
        f"{config.PINTEREST_APP_ID}:{config.PINTEREST_APP_SECRET}".encode()
    ).decode()
    if config.PINTEREST_REFRESH_TOKEN:
        data = {"grant_type": "refresh_token", "refresh_token": config.PINTEREST_REFRESH_TOKEN}
    elif config.PINTEREST_ACCESS_TOKEN:
        _token = config.PINTEREST_ACCESS_TOKEN
        return _token
    else:
        data = {"grant_type": "client_credentials", "scope": "ads:read"}
    resp = httpx.post(
        f"{config.PINTEREST_BASE_URL}/oauth/token",
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
        data=data,
        timeout=20.0,
    )
    resp.raise_for_status()
    _token = resp.json()["access_token"]
    return _token


def _strength_from_growth(mom: float | None) -> float:
    """Pinterest month-over-month growth % → [0.3, 1.0] trend strength. Log-scaled because growth spans
    ~1%–6500% (a linear map would saturate). mom 10→0.55, 100→0.70, 1000→0.85, 6500→0.97. Flat/declining
    → floor 0.3; missing → 0.6 (neutral, == the fixture's implicit default in trend_opportunities)."""
    if mom is None:
        return 0.6
    if mom <= 0:
        return 0.3
    return max(0.3, min(1.0, 0.4 + 0.15 * math.log10(mom)))


_VALID_TREND_TYPES = ("growing", "monthly", "seasonal", "yearly")


def _fetch_pinterest(limit: int = 8, trend_type: str = "growing") -> list[dict[str, Any]]:
    """GET /trends/keywords/{region}/top/{trend_type}, scoped to an interest category (PINTEREST_INTERESTS,
    default "beauty") — without the interests filter the endpoint returns generic pop-culture noise
    (TV shows, holidays); beauty-scoped, ~21/25 keywords are nail-domain. trend_type is the time window
    (growing=fastest risers now, monthly, seasonal=current-season spikes, yearly); unknown → growing.
    Each row carries growth % (pct_growth_wow/mom/yoy) which we keep as `growth` + fold MoM into a
    `strength` the ranker uses. Field names vary by API version, so we extract defensively."""
    tt = trend_type if trend_type in _VALID_TREND_TYPES else "growing"
    tok = _pinterest_token()
    resp = httpx.get(
        f"{config.PINTEREST_BASE_URL}/trends/keywords/{config.PINTEREST_REGION}/top/{tt}",
        headers={"Authorization": f"Bearer {tok}"},
        params={"limit": limit, "interests": config.PINTEREST_INTERESTS},
        timeout=20.0,
    )
    resp.raise_for_status()
    data = resp.json()
    rows = data.get("trends") or data.get("items") or data.get("data") or []
    out: list[dict[str, Any]] = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            out.append({"label": str(row), "tags": [str(row)]})
            continue
        kw = row.get("keyword") or row.get("term") or row.get("name")
        if not kw:
            continue
        growth = {"wow": row.get("pct_growth_wow"), "mom": row.get("pct_growth_mom"), "yoy": row.get("pct_growth_yoy")}
        out.append({
            "label": kw,
            "tags": [t for t in str(kw).split() if t],
            "conceptQuery": str(kw),
            "strength": round(_strength_from_growth(growth["mom"]), 2),
            "growth": growth,
        })
    return out or CURATED_VISUAL


def get_external_trends(trend_type: str | None = None) -> list[dict[str, Any]]:
    """The 选品 agent's external trends. `curated_visual` is the demo path. `pinterest` is optional live
    keyword telemetry; trend_type picks the Pinterest window (defaults to PINTEREST_TREND_TYPE). Any
    Pinterest error degrades to the curated visual pack."""
    if config.TREND_SOURCE == "pinterest":
        try:
            return _fetch_pinterest(trend_type=trend_type or config.PINTEREST_TREND_TYPE)
        except Exception:
            return CURATED_VISUAL  # degrade — live ingestion must never break the round
    return CURATED_VISUAL
