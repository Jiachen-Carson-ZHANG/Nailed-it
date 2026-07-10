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
        # 编排 (ADR-0013 P1) orchestrator-only dispatch tools
        "dispatch_agent", "dispatch_many",
        # 监测回流 + 记忆 + 修订 (ADR-0013 P2/P3)
        "get_campaign_outcomes", "record_memory", "get_agent_memory", "read_blackboard", "request_revision",
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
    # ADR-0013 P0: propose_listing supersedes older rounds' pending proposals on its first call.
    supersedes = []
    monkeypatch.setattr(bus, "expire_stale_proposals", lambda sb, **kw: supersedes.append(kw) or 3)
    c = tools.RunContext(sb=object(), run_id="run-test", merchant_id="m-test")
    c.writes = writes  # expose for assertions
    c.supersedes = supersedes
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


# ── ADR-0013 P0: proposal hygiene — supersede / dedupe / cap ─────────────────────────────────────

def test_propose_listing_supersedes_older_rounds_once(ctx):
    tools.propose_listing("金属感", "外部趋势上升且库内无匹配")
    tools.propose_listing("暗黑", "平台热榜缺口")
    # supersede fires exactly once per run, excluding this run's own rows
    assert ctx.supersedes == [{"exclude_run_id": "run-test"}]


def test_propose_listing_dedupes_same_tag_within_the_round(ctx):
    tools.propose_listing("金属感", "理由一")
    out = tools.propose_listing("金属感", "理由二（重复）")
    assert "Duplicate skipped" in out
    assert len([w for w in ctx.writes if w["action_type"] == "draft_upload"]) == 1


def test_propose_listing_caps_pending_proposals(ctx, monkeypatch):
    from nailed_agents import config
    monkeypatch.setattr(config, "MAX_PENDING_PROPOSALS", 2)
    tools.propose_listing("tag-a", "理由 a")
    tools.propose_listing("tag-b", "理由 b")
    with pytest.raises(ValueError, match="proposal_cap_reached"):
        tools.propose_listing("tag-c", "理由 c")
    assert len(ctx.writes) == 2  # the third never wrote


# ── ADR-0013 P1: dispatch tools — orchestrator-only, guardrailed ─────────────────────────────────

def _round_state():
    from nailed_agents.orchestrator import RoundState
    state = RoundState(dispatch_fn=None, budget=3)
    calls = []

    def fake_dispatch(slug, task, parent):
        calls.append({"slug": slug, "task": task, "parent": parent})
        return f"run-{slug}", f"{slug} 完成"

    state.dispatch_fn = fake_dispatch
    state.calls = calls
    return state


def test_dispatch_refused_outside_the_orchestrator(ctx):
    # Lane agents carry round=None — a hallucinated dispatch must die before any side effect.
    with pytest.raises(ValueError, match="dispatch_not_allowed"):
        tools.dispatch_agent("ad", "投广", "decision")
    assert ctx.writes == []


def test_dispatch_agent_runs_and_records_the_lineage_step(ctx):
    ctx.round = _round_state()
    out = tools.dispatch_agent("insight", "分析最近 7 天数据", "")
    assert "run-insight" in out and "insight 完成" in out
    assert ctx.round.dispatched == {"insight": "run-insight"}
    step = ctx.transcript[-1]
    assert step["tool"] == "dispatch_agent"
    assert step["input"] == {"agent": "insight", "parent": None}
    assert step["output"]["runId"] == "run-insight"


def test_dispatch_guardrails_one_per_agent_and_budget(ctx):
    ctx.round = _round_state()
    tools.dispatch_agent("insight", "任务", "")
    with pytest.raises(ValueError, match="already_dispatched"):
        tools.dispatch_agent("insight", "再来一次", "")
    with pytest.raises(ValueError, match="unknown_agent"):
        tools.dispatch_agent("hacker", "越权", "")
    tools.dispatch_agent("trend", "任务", "insight")
    tools.dispatch_agent("decision", "任务", "trend")
    with pytest.raises(ValueError, match="dispatch_budget_exhausted"):
        tools.dispatch_agent("ad", "任务", "decision")  # budget=3 spent


def test_dispatch_many_validates_the_whole_batch_before_running(ctx):
    ctx.round = _round_state()
    import json as _json
    out = tools.dispatch_many(_json.dumps([
        {"agent": "ad", "task": "落地投广", "parent": "decision"},
        {"agent": "coupon", "task": "落地团购", "parent": "decision"},
    ]))
    assert "run-ad" in out and "run-coupon" in out
    assert set(ctx.round.dispatched) == {"ad", "coupon"}
    # duplicates in one batch are rejected atomically — nothing runs
    ctx2_round = _round_state()
    ctx.round = ctx2_round
    with pytest.raises(ValueError, match="duplicate_agents_in_batch"):
        tools.dispatch_many(_json.dumps([{"agent": "ad", "task": "x"}, {"agent": "ad", "task": "y"}]))
    assert ctx2_round.calls == []


# ── ADR-0013 P2: memory tools ────────────────────────────────────────────────────────────────────

def test_record_memory_upserts_a_windowed_entity_keyed_verdict(ctx, monkeypatch):
    rows = []
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: rows.append(row))
    tools.record_memory("ad_outcome", "ad-style-1", "7 天实测 ROAS 2.1，估算 4.1 —— 高估约 2 倍", "ad-style-1", 7)
    assert len(rows) == 1
    r = rows[0]
    assert r["kind"] == "ad_outcome" and r["key"] == "ad-style-1"
    assert r["content"] == {"verdict": "7 天实测 ROAS 2.1，估算 4.1 —— 高估约 2 倍"}
    assert r["entity_type"] == "style_ad" and r["entity_id"] == "ad-style-1"
    assert r["evidence_run_id"] == "run-test"
    assert r["window_start"] < r["window_end"] <= r["expires_at"]


def test_record_memory_rejects_unknown_kind(ctx, monkeypatch):
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: (_ for _ in ()).throw(AssertionError("must not write")))
    with pytest.raises(ValueError, match="kind_invalid"):
        tools.record_memory("raw_metrics_dump", "k", "v")


# ── ADR-0013 P3: the revision edge ───────────────────────────────────────────────────────────────

def _revision_port(actions: dict, monkeypatch, dispatched: list):
    from nailed_agents.orchestrator import RevisionPort
    monkeypatch.setattr(bus, "fetch_action", lambda sb, action_id, merchant_id: actions.get(action_id))
    superseded = []
    monkeypatch.setattr(bus, "supersede_action", lambda sb, action_id: superseded.append(action_id))
    port = RevisionPort(
        sb=object(), merchant_id="m-test", monitor_run_id="run-monitor",
        dispatch_fn=lambda slug, task, parent: (dispatched.append({"slug": slug, "task": task, "parent": parent}) or ("run-rev", f"{slug} 修订完成")),
    )
    port.superseded = superseded
    return port


def test_revision_refused_outside_the_monitor(ctx):
    with pytest.raises(ValueError, match="revision_not_allowed"):
        tools.request_revision("act-1", "预算太高")


def test_revision_redispatches_the_executor_once_and_supersedes_the_action(ctx, monkeypatch):
    dispatched = []
    port = _revision_port({
        "act-1": {"id": "act-1", "type": "place_ad", "risk": "reversible", "status": "applied",
                  "entity_id": "ad-style-1", "payload": {"styleId": "style-1", "budgetCents": 20000}},
    }, monkeypatch, dispatched)
    ctx.revision = port
    out = tools.request_revision("act-1", "实测 ROAS 仅 1.2，日预算从 200 降到 80")
    assert "run-rev" in out
    assert port.superseded == ["act-1"]
    assert dispatched[0]["slug"] == "ad" and dispatched[0]["parent"] == "run-monitor"
    assert "日预算从 200 降到 80" in dispatched[0]["task"]
    # second attempt on the same action is refused before anything runs
    with pytest.raises(ValueError, match="action_already_revised"):
        tools.request_revision("act-1", "再改一次")
    assert len(dispatched) == 1


def test_revision_refuses_irreversible_and_entityless_actions(ctx, monkeypatch):
    dispatched = []
    port = _revision_port({
        "msg-1": {"id": "msg-1", "type": "send_customer_message", "risk": "irreversible", "status": "applied",
                  "entity_id": None, "payload": {}},
        "gone-1": {"id": "gone-1", "type": "place_ad", "risk": "reversible", "status": "undone",
                   "entity_id": "ad-x", "payload": {}},
    }, monkeypatch, dispatched)
    ctx.revision = port
    with pytest.raises(ValueError, match="action_not_revisable"):
        tools.request_revision("msg-1", "撤回消息")  # a sent message cannot be unsent, let alone revised
    with pytest.raises(ValueError, match="action_not_revisable"):
        tools.request_revision("gone-1", "已撤销的动作不能修订")
    assert dispatched == [] and port.superseded == []


def test_revision_budget_caps_per_round(ctx, monkeypatch):
    acts = {f"act-{i}": {"id": f"act-{i}", "type": "place_ad", "risk": "reversible", "status": "applied",
                          "entity_id": f"ad-{i}", "payload": {}} for i in range(3)}
    dispatched = []
    port = _revision_port(acts, monkeypatch, dispatched)
    ctx.revision = port
    tools.request_revision("act-0", "反馈 0")
    tools.request_revision("act-1", "反馈 1")
    with pytest.raises(ValueError, match="revision_budget_exhausted"):
        tools.request_revision("act-2", "反馈 2")
    assert len(dispatched) == 2
