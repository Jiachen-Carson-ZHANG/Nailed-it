"""选品 trend logic in Python — the LIVE path the agent uses (the TS src/domain/intelligence/trends.ts
is now a tested reference that has DIVERGED: this version de-floods internal trends and makes price_test
a style-level signal — see below; mirror or retire the TS copy separately).

Combines external trend concepts + internal-rising demand → match to the catalog (concept matcher or
tag fallback) → classify into an action bucket → score → rank. Plus platform-hot (cross-merchant tag
reach). Pure functions over inputs the tools fetch (insights from the TS read model; styles from the TS
styles endpoint; external trends from trends_source) — we do NOT re-derive internal grounded metrics
here (ADR-0006)."""
from __future__ import annotations

from typing import Any

_COMMERCIAL_VALUE = 0.5  # flat proxy (no margin data yet)
_GAP_FIT = 0.3  # a gap has no matched style; a modest fixed fit so it can still rank
_PRICE_TEST_SCORE = 0.30  # style-level coupon candidate — actionable, ranks between amplify and gap
_MIN_INTERNAL_RISE = 0.05  # a demand tag must rise ≥5% wk/wk to count as a trend (kills +1-count noise)
_MAX_INTERNAL_TRENDS = 6  # keep only the strongest internal risers — stops every tag becoming a "trend"


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
    match_fn: Any = None,
) -> dict[str, Any]:
    """Returns {opportunities: [...ranked], prune: [...]}. styles: [{id,title,merchantId,tags:[...]}].

    match_fn(label, tags) -> [(style_id, score), ...] | None injects the matcher (MATCH_MODE=concept:
    VLM-concept embed+rerank; score is the 0..1 rerank relevance). None (default, or per-trend degrade)
    → tag-overlap fallback, where score is the tag-hit ratio. `fit` in the output is whichever ran."""
    design = insights.get("designPerformance", {}) or {}
    perf_styles = design.get("styles", []) or []
    low_conv_styles = design.get("highInterestLowConversion", []) or []
    demand_trends = insights.get("demandTrends", []) or []

    style_tag_sets = {s["id"]: {_norm(t) for t in s.get("tags", [])} for s in styles}

    # 1) canonical trends: external + internal-rising, deduped by label
    canon: dict[str, dict[str, Any]] = {}

    def add(
        label: str,
        tags: list[str],
        source: str,
        strength: float,
        growth: dict[str, Any] | None = None,
        concept_query: str | None = None,
    ) -> None:
        key = _norm(label)
        if key in canon:
            c = canon[key]
            c["tags"].update(_norm(t) for t in tags)
            c["sources"].add(source)
            c["strength"] = min(1.0, c["strength"] + strength)
            if growth and not c.get("growth"):
                c["growth"] = growth
            if concept_query and not c.get("conceptQuery"):
                c["conceptQuery"] = concept_query
        else:
            canon[key] = {"label": label, "tags": {_norm(t) for t in tags}, "sources": {source},
                          "strength": strength, "growth": growth, "conceptQuery": concept_query}

    for t in external_trends:
        # external trends carry their own momentum-derived strength when available (Pinterest growth %);
        # the fixture has none → default 0.6 (the prior flat value, so fixture behavior is unchanged).
        concept_query = t.get("conceptQuery") or t.get("concept_query")
        add(
            t.get("label", ""),
            t.get("tags", []),
            "external",
            float(t.get("strength", 0.6)),
            t.get("growth"),
            str(concept_query) if concept_query else None,
        )
    # internal demand: only MEANINGFUL risers, capped — not every tag that ticked up by 1. Without this,
    # ~21 micro-rising attributes each become a "trend" matching 20+ styles → a wall of near-identical rows.
    rising_internal = sorted(
        (t for t in demand_trends
         if t.get("direction") == "up" and (t.get("delta", 0) / max(t.get("previous", 0), 1)) >= _MIN_INTERNAL_RISE),
        key=lambda t: -t.get("delta", 0),
    )[:_MAX_INTERNAL_TRENDS]
    for t in rising_internal:
        add(t.get("label", ""), [t.get("label", "")], "internal", 0.4)

    # 2-4) match + classify + score
    present_ids = {s["id"] for s in styles}
    opportunities: list[dict[str, Any]] = []
    for c in canon.values():
        # Curated visual trends carry a VLM-authored conceptQuery. In concept mode, match the concept
        # text against style_concept rows; the display label remains short and merchant-readable.
        query = str(c.get("conceptQuery") or c["label"])
        scored = match_fn(query, sorted(c["tags"])) if match_fn else None
        match_why: str | None = None
        if scored is None:
            # tag-overlap (default, or per-trend degrade from the concept matcher)
            match_source = "tag"
            best_fit = 0.0
            matched = []
            for s in styles:
                f = _overlap(c["tags"], style_tag_sets[s["id"]])
                if f > 0:
                    matched.append(s["id"])
                    best_fit = max(best_fit, f)
        else:
            # concept matcher ran. Items are (style_id, score[, why]); tolerate 2-tuples (test stubs).
            match_source = "concept"
            pairs = [(item[0], item[1], item[2] if len(item) > 2 else None)
                     for item in scored if item[0] in present_ids]
            matched = [sid for sid, _, _ in pairs]
            best = max(pairs, key=lambda p: p[1], default=None)
            best_fit = round(best[1], 2) if best else 0.0
            match_why = best[2] if best else None  # concept_text of the top match — the auditable "why"
        if not matched:
            action, reason, best_fit = "gap", f"需求上升但库内无匹配款式（{'+'.join(sorted(c['sources']))}）→ 提醒上架", _GAP_FIT
        else:
            action, reason = "amplify", "匹配款契合上升趋势 → 投广放大"
        opportunities.append({
            "trendLabel": c["label"],
            "tags": sorted(c["tags"]),
            "sources": sorted(c["sources"]),
            "strength": round(c["strength"], 2),
            "conceptQuery": c.get("conceptQuery"),
            "growth": c.get("growth"),  # raw Pinterest % (wow/mom/yoy) when external; None for fixture/internal
            "matchedStyleIds": matched,
            "fit": round(best_fit, 2),
            "matchSource": match_source,  # 'concept' (matcher ran) | 'tag' (default or per-trend degrade)
            "matchWhy": match_why,        # concept_text of the top concept match (audit #5); None for tag
            "action": action,
            "score": round(c["strength"] * best_fit * _COMMERCIAL_VALUE, 2),
            "reason": reason,
        })

    # price_test is a STYLE-level signal, not a per-trend one: a high-interest-low-conversion style is a
    # coupon (团购试价) candidate on its own merits, regardless of which trends happen to touch it. One row
    # per such style — this also removes the old "any trend touching a low-conv style → price_test" rule
    # that let a single over-tagged style stamp price_test onto every trend (the other half of the flood).
    style_title = {s["id"]: s.get("title", s["id"]) for s in styles}
    for s in low_conv_styles:
        sid = s.get("styleId")
        opportunities.append({
            "trendLabel": style_title.get(sid, sid),
            "tags": [], "sources": ["internal"], "strength": None, "growth": None,
            "matchedStyleIds": [sid], "fit": None,
            "action": "price_test", "score": _PRICE_TEST_SCORE,
            "reason": "高意向低转化 → 团购券试价",
        })

    opportunities.sort(key=lambda o: -o["score"])

    # 5) prune: low-conversion styles on no trend. This is an exposure-allocation signal, not deletion.
    on_trend = {mid for o in opportunities for mid in o["matchedStyleIds"]}
    prune = [
        {"styleId": s["styleId"], "title": s.get("title", s["styleId"]), "reason": "长期低转化且不在任何上升趋势上 → 降低推荐曝光候选"}
        for s in perf_styles
        if (s.get("tryOns", 0) >= 1 and (s.get("conversionRate") or 0) < 0.1 and s.get("styleId") not in on_trend)
    ]
    return {"opportunities": opportunities, "prune": prune}
