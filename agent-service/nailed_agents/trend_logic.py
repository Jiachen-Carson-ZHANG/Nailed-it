"""选品 trend logic in Python (mirrors the tested TS reference src/domain/intelligence/trends.ts).

Combines external trends + internal-rising demand → match to the catalog (tag overlap) → classify into
an action bucket → score → rank. Plus platform-hot (cross-merchant tag reach). Pure functions over
inputs the tools fetch (insights from the TS read model; styles from the TS styles endpoint; external
trends from trends_source) — we do NOT re-derive internal grounded metrics here (ADR-0006)."""
from __future__ import annotations

from typing import Any

_COMMERCIAL_VALUE = 0.5  # flat proxy (no margin data yet)
_GAP_FIT = 0.3  # a gap has no matched style; a modest fixed fit so it can still rank


def _norm(s: str) -> str:
    return s.strip().lower()


def _overlap(trend_tags: set[str], style_tags: set[str]) -> float:
    if not trend_tags:
        return 0.0
    hit = sum(1 for t in trend_tags if t in style_tags)
    return hit / len(trend_tags)


def platform_hot(styles: list[dict[str, Any]], top_n: int = 12) -> list[dict[str, Any]]:
    """Cross-merchant tag reach over all published styles. styles: [{merchantId, tags:[...]}]."""
    style_count: dict[str, int] = {}
    merchants: dict[str, set[str]] = {}
    for s in styles:
        seen: set[str] = set()
        for tag in s.get("tags", []):
            t = str(tag).strip()
            if not t or t in seen:
                continue
            seen.add(t)
            style_count[t] = style_count.get(t, 0) + 1
            merchants.setdefault(t, set()).add(s.get("merchantId", ""))
    rows = [
        {"tag": t, "styleCount": c, "merchantCount": len(merchants[t])}
        for t, c in style_count.items()
    ]
    rows.sort(key=lambda r: (-r["merchantCount"], -r["styleCount"], r["tag"]))
    return rows[:top_n]


def trend_opportunities(
    external_trends: list[dict[str, Any]],
    insights: dict[str, Any],
    styles: list[dict[str, Any]],
) -> dict[str, Any]:
    """Returns {opportunities: [...ranked], prune: [...]}. styles: [{id,title,merchantId,tags:[...]}]."""
    design = insights.get("designPerformance", {}) or {}
    perf_styles = design.get("styles", []) or []
    low_conv_ids = {s.get("styleId") for s in design.get("highInterestLowConversion", []) or []}
    demand_trends = insights.get("demandTrends", []) or []

    style_tag_sets = {s["id"]: {_norm(t) for t in s.get("tags", [])} for s in styles}

    # 1) canonical trends: external + internal-rising, deduped by label
    canon: dict[str, dict[str, Any]] = {}

    def add(label: str, tags: list[str], source: str, strength: float) -> None:
        key = _norm(label)
        if key in canon:
            c = canon[key]
            c["tags"].update(_norm(t) for t in tags)
            c["sources"].add(source)
            c["strength"] = min(1.0, c["strength"] + strength)
        else:
            canon[key] = {"label": label, "tags": {_norm(t) for t in tags}, "sources": {source}, "strength": strength}

    for t in external_trends:
        add(t.get("label", ""), t.get("tags", []), "external", 0.6)
    for t in demand_trends:
        if t.get("direction") == "up":
            add(t.get("label", ""), [t.get("label", "")], "internal", 0.4)

    # 2-4) match + classify + score
    opportunities: list[dict[str, Any]] = []
    for c in canon.values():
        best_fit = 0.0
        matched: list[str] = []
        for s in styles:
            f = _overlap(c["tags"], style_tag_sets[s["id"]])
            if f > 0:
                matched.append(s["id"])
                best_fit = max(best_fit, f)
        if not matched:
            action, reason, best_fit = "gap", f"需求上升但库内无匹配款式（{'+'.join(sorted(c['sources']))}）→ 提醒上架", _GAP_FIT
        elif any(mid in low_conv_ids for mid in matched):
            action, reason = "price_test", "匹配款高意向低转化 → 团购券试价"
        else:
            action, reason = "amplify", "匹配款契合上升趋势 → 投广放大"
        opportunities.append({
            "trendLabel": c["label"],
            "tags": sorted(c["tags"]),
            "sources": sorted(c["sources"]),
            "strength": round(c["strength"], 2),
            "matchedStyleIds": matched,
            "fit": round(best_fit, 2),
            "action": action,
            "score": round(c["strength"] * best_fit * _COMMERCIAL_VALUE, 2),
            "reason": reason,
        })
    opportunities.sort(key=lambda o: -o["score"])

    # 5) prune: low-conversion styles on no trend
    on_trend = {mid for o in opportunities for mid in o["matchedStyleIds"]}
    prune = [
        {"styleId": s["styleId"], "title": s.get("title", s["styleId"]), "reason": "长期低转化且不在任何上升趋势上 → 下架候选"}
        for s in perf_styles
        if (s.get("tryOns", 0) >= 1 and (s.get("conversionRate") or 0) < 0.1 and s.get("styleId") not in on_trend)
    ]
    return {"opportunities": opportunities, "prune": prune}
