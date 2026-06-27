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
    # style_id has a default → optional; the others required
    send = tools.OPENAI_TOOLS["send_customer_message"]["function"]["parameters"]
    assert set(send["required"]) == {"customer_name", "body"}
    assert "style_id" in send["properties"]


def test_registries_cover_the_same_eight_tools():
    expected = {
        "get_merchant_insights", "get_customer_intelligence", "place_ad", "set_group_buy_coupon",
        "list_style", "delist_style", "propose_listing", "send_customer_message",
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
    c = tools.RunContext(sb=object(), run_id="run-test", merchant_id="m-test")
    c.writes = writes  # expose for assertions
    token = tools.use_context(c)
    yield c
    tools.reset_context(token)


def test_place_ad_writes_reversible_action_and_two_steps(ctx):
    out = tools.place_ad("style-1", "top_funnel", 5000)
    assert "reversible" in out
    assert ctx.writes == [{
        "run_id": "run-test", "action_type": "place_ad",
        "payload": {"styleId": "style-1", "slot": "top_funnel", "budgetCents": 5000},
    }]
    kinds = [s["kind"] for s in ctx.transcript]
    assert kinds == ["tool_call", "action"]
    assert ctx.transcript[-1]["status"] == "applied"


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
