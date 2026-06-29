"""External-trend source for the 选品 agent (design spec §4). One seam, two sources via TREND_SOURCE:

  - "fixture"   (default): authored CN-flavored trends — deterministic, no key, matches the CN catalog.
  - "pinterest" (live):    Pinterest Trends API (app-only client_credentials token). NOTE: Pinterest
                           Trends has NO China region (US/UK/CA + ~30) → Western keywords; they rarely
                           overlap the CN catalog tags, so live mode mostly surfaces gaps. Use fixture
                           for CN-relevant matching; pinterest to prove live ingestion.

Returns a list of {"label": str, "tags": [str, ...]} either way — the shape the trend logic consumes.
"""
from __future__ import annotations

import base64
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


def _fetch_pinterest(limit: int = 8) -> list[dict[str, Any]]:
    """GET /trends/keywords/{region}/top/{trend_type}. Response field names vary by API version, so we
    extract the keyword defensively. Each keyword → one trend with itself as the tag."""
    tok = _pinterest_token()
    resp = httpx.get(
        f"{config.PINTEREST_BASE_URL}/trends/keywords/{config.PINTEREST_REGION}/top/growing",
        headers={"Authorization": f"Bearer {tok}"},
        params={"limit": limit},
        timeout=20.0,
    )
    resp.raise_for_status()
    data = resp.json()
    rows = data.get("trends") or data.get("items") or data.get("data") or []
    out: list[dict[str, Any]] = []
    for row in rows[:limit]:
        kw = row.get("keyword") or row.get("term") or row.get("name") if isinstance(row, dict) else str(row)
        if not kw:
            continue
        out.append({"label": kw, "tags": [t for t in str(kw).split() if t]})
    return out or FIXTURE


def get_external_trends() -> list[dict[str, Any]]:
    """The 选品 agent's external trends. Degrades to the fixture on any Pinterest error (never blocks)."""
    if config.TREND_SOURCE == "pinterest":
        try:
            return _fetch_pinterest()
        except Exception:
            return FIXTURE  # degrade — live ingestion must never break the round
    return FIXTURE
