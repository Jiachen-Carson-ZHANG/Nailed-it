"""trend_logic regression: the flood fixes + the injected match_fn (concept mode) vs tag fallback.
Network-free — the concept matcher is stubbed, so these lock in behavior without Cohere/VLM."""
from nailed_agents import trend_logic as tl


def _insights(demand=None, low_conv=None):
    return {"designPerformance": {"styles": [], "highInterestLowConversion": low_conv or []},
            "demandTrends": demand or []}


# ── flood fixes ──────────────────────────────────────────────────────────────────────────────────

def test_internal_trends_filtered_by_rise_and_capped():
    demand = [{"label": f"c{i}", "direction": "up", "current": 100 + i * 20, "previous": 100, "delta": i * 20}
              for i in range(1, 9)]
    demand.append({"label": "noise", "direction": "up", "current": 431, "previous": 430, "delta": 1})  # +0.2%
    styles = [{"id": "s1", "title": "S1", "merchantId": "m", "tags": ["c8"]}]
    rep = tl.trend_opportunities([], _insights(demand), styles)
    internal = [o for o in rep["opportunities"] if o["sources"] == ["internal"]]
    assert len(internal) <= tl._MAX_INTERNAL_TRENDS
    assert all(o["trendLabel"] != "noise" for o in internal)  # micro-rise dropped


def test_price_test_is_style_level_and_trends_stay_amplify():
    low = [{"styleId": "s1"}]
    styles = [{"id": "s1", "title": "鎏金", "merchantId": "m", "tags": ["裸色"]}]
    demand = [{"label": "裸色", "direction": "up", "current": 200, "previous": 100, "delta": 100}]
    rep = tl.trend_opportunities([], _insights(demand, low), styles)
    price = [o for o in rep["opportunities"] if o["action"] == "price_test"]
    assert len(price) == 1 and price[0]["matchedStyleIds"] == ["s1"]
    amp = [o for o in rep["opportunities"] if o["trendLabel"] == "裸色"]
    assert amp and amp[0]["action"] == "amplify"  # the trend is NOT stamped price_test by one low-conv style


# ── matcher injection: concept vs tag fallback ───────────────────────────────────────────────────

def test_tag_overlap_used_when_no_match_fn():
    styles = [{"id": "s1", "title": "法式", "merchantId": "m", "tags": ["法式风"]},
              {"id": "s2", "title": "金属", "merchantId": "m", "tags": ["金属感"]}]
    ext = [{"label": "法式风", "tags": ["法式风"], "strength": 0.6}]
    rep = tl.trend_opportunities(ext, _insights(), styles)
    o = next(o for o in rep["opportunities"] if o["trendLabel"] == "法式风")
    assert o["matchedStyleIds"] == ["s1"] and o["action"] == "amplify"


def test_concept_match_fn_overrides_tag_overlap():
    # tag-overlap would match s1 (shares 法式风); the concept matcher says s2 with a high rerank score.
    styles = [{"id": "s1", "title": "A", "merchantId": "m", "tags": ["法式风"]},
              {"id": "s2", "title": "B", "merchantId": "m", "tags": ["其它"]}]
    ext = [{"label": "法式 french", "tags": ["法式"], "strength": 0.6}]
    match_fn = lambda label, tags: [("s2", 0.95)] if "法式" in label else []
    rep = tl.trend_opportunities(ext, _insights(), styles, match_fn=match_fn)
    o = next(o for o in rep["opportunities"] if o["trendLabel"] == "法式 french")
    assert o["matchedStyleIds"] == ["s2"]   # concept won, not tag-overlap
    assert o["fit"] == 0.95 and o["action"] == "amplify"


def test_match_fn_returning_none_falls_back_to_tags():
    styles = [{"id": "s1", "title": "A", "merchantId": "m", "tags": ["法式风"]}]
    ext = [{"label": "法式风", "tags": ["法式风"], "strength": 0.6}]
    rep = tl.trend_opportunities(ext, _insights(), styles, match_fn=lambda l, t: None)
    o = next(o for o in rep["opportunities"] if o["trendLabel"] == "法式风")
    assert o["matchedStyleIds"] == ["s1"]  # per-trend degrade → tag fallback


def test_concept_match_empty_is_a_gap():
    styles = [{"id": "s1", "title": "A", "merchantId": "m", "tags": ["法式风"]}]
    ext = [{"label": "chrome", "tags": ["chrome"], "strength": 0.9}]
    rep = tl.trend_opportunities(ext, _insights(), styles, match_fn=lambda l, t: [])
    o = next(o for o in rep["opportunities"] if o["trendLabel"] == "chrome")
    assert o["matchedStyleIds"] == [] and o["action"] == "gap"


# ── match transparency: matchSource + concept "why" (audit #4/#5) ─────────────────────────────────

def test_concept_match_carries_source_and_why():
    styles = [{"id": "s1", "title": "A", "merchantId": "m", "tags": ["其它"]}]
    ext = [{"label": "法式 french", "tags": ["法式"], "strength": 0.6}]
    match_fn = lambda l, t: [("s1", 0.9, "杏仁形，法式微笑线，银色亮片")]  # 3-tuple with why
    o = next(o for o in tl.trend_opportunities(ext, _insights(), styles, match_fn=match_fn)["opportunities"]
             if o["trendLabel"] == "法式 french")
    assert o["matchSource"] == "concept" and o["matchWhy"] == "杏仁形，法式微笑线，银色亮片"


def test_tag_path_marks_source_tag_and_no_why():
    styles = [{"id": "s1", "title": "A", "merchantId": "m", "tags": ["法式风"]}]
    ext = [{"label": "法式风", "tags": ["法式风"], "strength": 0.6}]
    o = next(o for o in tl.trend_opportunities(ext, _insights(), styles)["opportunities"]
             if o["trendLabel"] == "法式风")
    assert o["matchSource"] == "tag" and o["matchWhy"] is None
