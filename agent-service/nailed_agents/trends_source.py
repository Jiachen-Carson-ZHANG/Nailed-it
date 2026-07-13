"""External-trend source for the 选品 agent (design spec §4). One seam, two sources via TREND_SOURCE:

  - "fixture"   (default): authored CN-flavored trends — deterministic, no key, matches the CN catalog.
  - "pinterest" (live):    Pinterest Trends API (user-authorized token). NOTE: regions are Western only
                           (US, GB+IE, CA, AU+NZ, DE, FR, …) — NO China/Asia. Scoped to interest=beauty
                           so keywords are nail-domain, but they're English and rarely overlap the CN
                           catalog tags, so live mode mostly surfaces gaps. Use fixture for CN-relevant
                           matching; pinterest to prove live ingestion of a real external trend signal.

Returns a list of {"label": str, "tags": [str, ...]} either way — the shape the trend logic consumes.
"""
from __future__ import annotations

import base64
import math
from typing import Any

import httpx

from . import config

# CN-flavored authored trends (mirrors src/mock/external-trends.ts).
FIXTURE: list[dict[str, Any]] = [
    {"label": "金属感", "tags": ["金属感", "镜面", "银色"]},
    {"label": "暗黑", "tags": ["暗黑", "Y2K", "黑色"]},
    {"label": "镜面猫眼", "tags": ["镜面", "猫眼", "金属感"]},
    {"label": "法式裸色", "tags": ["法式风", "裸色", "清冷感"]},
    {"label": "甜美奶茶", "tags": ["甜美", "奶茶", "可爱"]},
]

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
            "strength": round(_strength_from_growth(growth["mom"]), 2),
            "growth": growth,
        })
    return out or FIXTURE


def get_external_trends(trend_type: str | None = None) -> list[dict[str, Any]]:
    """The 选品 agent's external trends. trend_type picks the Pinterest window (defaults to
    PINTEREST_TREND_TYPE; ignored for the fixture source). Degrades to the fixture on any Pinterest
    error (never blocks)."""
    if config.TREND_SOURCE == "pinterest":
        try:
            return _fetch_pinterest(trend_type=trend_type or config.PINTEREST_TREND_TYPE)
        except Exception:
            return FIXTURE  # degrade — live ingestion must never break the round
    return FIXTURE
