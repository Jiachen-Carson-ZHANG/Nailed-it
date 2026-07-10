"""Tests for the tool layer — schema derivation, registry integrity, side-effects, and the gate.
All network-free: bus I/O is monkeypatched, so no Supabase / model calls."""
import json

import pytest

from nailed_agents import bus, tools


# ── schema derivation (the auto-generated OpenAI schemas — single source of truth) ──────────────

def test_openai_schema_types_and_required():
    s = tools.OPENAI_TOOLS["place_ad"]["function"]
    assert s["name"] == "place_ad"
    assert s["description"]  # pulled from the docstring
    props = s["parameters"]["properties"]
    assert props["style_id"]["type"] == "string"
    assert props["budget_cents"]["type"] == "integer"
    assert set(s["parameters"]["required"]) == {"style_id", "slot", "budget_cents"}


def test_openai_schema_optional_params_excluded_from_required():
    # range_days has a default → optional
    assert tools.OPENAI_TOOLS["get_merchant_insights"]["function"]["parameters"]["required"] == []
    send = tools.OPENAI_TOOLS["send_customer_message"]["function"]["parameters"]
    assert set(send["required"]) == {"customer_name", "body"}
    assert "style_id" not in send["properties"]  # removed — no grounded recommendation source (audit)


def test_registries_cover_the_same_tools():
    expected = {
        "get_merchant_insights", "get_customer_intelligence", "place_ad", "set_group_buy_coupon",
        "list_style", "delist_style", "propose_listing", "send_customer_message",
        # 选品 (trend) read tools
        "get_external_trends", "get_platform_hot", "get_trend_opportunities",
        # 运营 (catalog) grounded-candidates read tool
        "get_catalog_actions",
        # 决策 (ADR-0012) grounded decision-brain read tool
        "get_style_business_decisions",
    }
    assert set(tools.IMPL) == expected
    assert set(tools.BETA_TOOLS) == expected
    assert set(tools.OPENAI_TOOLS) == expected


# ── side-effects: action tools write an agent_action + record transcript steps ────────────────────

@pytest.fixture
def ctx(monkeypatch):
    """A RunContext bound as the active context, with bus writes/reads captured (no network)."""
    writes = []
    monkeypatch.setattr(bus, "write_action",
                        lambda sb, **kw: writes.append(kw))
    monkeypatch.setattr(bus, "fetch_briefing", lambda range_days=7: {"insights": {"trendingUp": ["金属感"]}})
    monkeypatch.setattr(bus, "fetch_customers", lambda: {"customers": [{"name": "Amy Lim", "lastVisitDaysAgo": 40}]})
    # place_ad / set_group_buy_coupon now create REAL entities through the TS routes (ADR-0012) — stub the hop.
    monkeypatch.setattr(bus, "post_propose_ad", lambda style_id, *a, **k: {"ok": True, "id": f"ad-{style_id}", "status": "active"})
    monkeypatch.setattr(bus, "post_propose_groupbuy", lambda style_id, *a, **k: {"ok": True, "deal": {"id": f"gb-{style_id}"}})
    c = tools.RunContext(sb=object(), run_id="run-test", merchant_id="m-test")
    c.writes = writes  # expose for assertions
    token = tools.use_context(c)
    yield c
    tools.reset_context(token)


def test_place_ad_creates_a_real_campaign_and_links_the_action(ctx):
    """ADR-0012: the ad tool creates a StyleAd campaign and the action links FORWARD to it (entity_type /
    entity_id), mirroring its live state — it is no longer a fire-and-forget applied log row."""
    out = tools.place_ad("style-1", "top_funnel", 5000)
    assert "ad-style-1" in out and "launched" in out  # budget within the auto-launch cap → active
    assert ctx.writes == [{
        "run_id": "run-test", "action_type": "place_ad",
        "payload": {"styleId": "style-1", "slot": "top_funnel", "budgetCents": 5000},
        "status": "applied", "entity_type": "style_ad", "entity_id": "ad-style-1",
    }]
    kinds = [s["kind"] for s in ctx.transcript]
    assert kinds == ["tool_call", "action"]
    assert ctx.transcript[-1]["status"] == "applied"


def test_set_group_buy_coupon_proposes_a_real_draft_never_pretends_it_is_live(ctx):
    """ADR-0012: the coupon tool creates a REAL editable draft deal the merchant publishes — the action is
    'proposed' and linked to the deal, not an 'applied' row claiming the deal already exists."""
    out = tools.set_group_buy_coupon("style-1", 7040)
    assert "gb-style-1" in out and "awaiting merchant publish" in out
    assert ctx.writes == [{
        "run_id": "run-test", "action_type": "set_group_buy_coupon",
        "payload": {"styleId": "style-1", "priceCents": 7040},
        "status": "proposed", "entity_type": "groupbuy_deal", "entity_id": "gb-style-1",
    }]
    assert [s["kind"] for s in ctx.transcript] == ["tool_call", "action"]
    assert ctx.transcript[-1]["status"] == "proposed"


def test_action_tools_validate_model_supplied_payloads_before_write(ctx):
    with pytest.raises(ValueError, match="slot_invalid"):
        tools.place_ad("style-1", "bad_slot", 5000)
    with pytest.raises(ValueError, match="budget_cents_must_be_positive"):
        tools.place_ad("style-1", "top_funnel", -1)
    with pytest.raises(ValueError, match="style_id_invalid"):
        tools.set_group_buy_coupon("../style", 6800)
    with pytest.raises(ValueError, match="body_too_long"):
        tools.send_customer_message("Melissa Tan", "x" * 281)

    assert ctx.writes == []
    assert ctx.transcript == []


def test_propose_listing_is_gated(ctx):
    """The one human gate (ADR-0007 §4): proposes (not applies), sets awaiting_approval."""
    tools.propose_listing("暗黑", "高搜索低供给")
    assert ctx.awaiting_approval is True
    w = ctx.writes[0]
    assert w["action_type"] == "draft_upload"
    assert w["risk"] == "irreversible"
    assert w["status"] == "proposed"
    assert ctx.transcript[-1] == {
        "kind": "action", "actionType": "draft_upload", "status": "proposed",
        "summary": ctx.transcript[-1]["summary"],
    }


def test_read_tool_returns_json_and_records_tool_call(ctx):
    out = tools.get_merchant_insights(7)
    assert json.loads(out) == {"trendingUp": ["金属感"]}
    assert ctx.writes == []  # read-only → no action
    assert ctx.transcript[0]["kind"] == "tool_call"
    assert ctx.transcript[0]["tool"] == "get_merchant_insights"
