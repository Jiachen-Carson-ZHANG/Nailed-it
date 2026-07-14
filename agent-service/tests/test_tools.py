"""Tests for the tool layer — schema derivation, registry integrity, side-effects, and the gate.
All network-free: bus I/O is monkeypatched, so no Supabase / model calls."""
import json

import pytest

from nailed_agents import bus, config, tools


# ── schema derivation (the auto-generated OpenAI schemas — single source of truth) ──────────────

def test_openai_schema_types_and_required():
    s = tools.OPENAI_TOOLS["place_ad"]["function"]
    assert s["name"] == "place_ad"
    assert s["description"]  # pulled from the docstring
    props = s["parameters"]["properties"]
    assert props["style_id"]["type"] == "string"
    assert props["total_budget_cents"]["type"] == "integer"
    assert set(s["parameters"]["required"]) == {"style_id", "audience", "total_budget_cents"}


def test_openai_schema_optional_params_excluded_from_required():
    # range_days has a default → optional
    assert tools.OPENAI_TOOLS["get_merchant_insights"]["function"]["parameters"]["required"] == []
    send = tools.OPENAI_TOOLS["send_automated_notification"]["function"]["parameters"]
    assert set(send["required"]) == {"customer_name", "kind", "body"}
    assert "style_id" not in send["properties"]  # removed — no grounded recommendation source (audit)


def test_registries_cover_the_same_tools():
    expected = {
        "get_merchant_insights", "get_customer_intelligence", "place_ad", "set_group_buy_coupon",
        # 投广沙盒 (ADR-0016): forecast loop + in-place campaign mutation
        "get_ad_account_state", "list_available_audiences", "forecast_ad_plan",
        "update_ad_campaign", "pause_ad_campaign",
        # 团购模板 + 陈列动词 + 消息分级 (ADR-0016 Stage 3)
        "get_coupon_constraints", "feature_style", "deprioritize_style", "propose_listing",
        "send_automated_notification", "send_relationship_message",
        # 选品 (trend) read tools
        "get_external_trends", "get_platform_hot", "get_trend_opportunities",
        # 陈列运营 grounded-candidates read tools (new preferred + legacy compatibility)
        "get_merchandising_candidates", "get_catalog_actions",
        # 数分 structured Analysis Brief (candidate narrowing) + 决策 candidate/all facts
        "submit_analysis_brief", "get_candidate_business_facts",
        # 决策 (ADR-0016) business-engine facts + the Action Brief output contract + portfolio sim
        "get_style_business_facts", "submit_action_brief", "withdraw_action_brief", "simulate_action_portfolio",
        # 编排 (ADR-0013 P1) orchestrator-only dispatch tools
        "dispatch_agent", "dispatch_many",
        # 监测回流 + 记忆 v2 + 修订 (ADR-0013 P2/P3, ADR-0015)
        "get_campaign_outcomes", "record_action_outcome", "record_round_verdict", "search_memory",
        "request_revision",
    }
    assert set(tools.IMPL) == expected
    assert set(tools.BETA_TOOLS) == expected
    assert set(tools.OPENAI_TOOLS) == expected


def test_agent_tools_json_is_valid_against_the_registry():
    """agent-tools.json is the single source for allow-lists (Python runtime + TS seed).
    A typo'd or unknown tool name there must fail here, not at dispatch time."""
    from nailed_agents import orchestrator

    assert set(orchestrator.LANE_TOOLS) == {
        "insight", "trend", "decision", "ad", "coupon", "catalog", "customer_ops", "monitor",
    }
    for lane, names in orchestrator.LANE_TOOLS.items():
        assert names, f"lane {lane} has an empty allow-list"
        unknown = set(names) - set(tools.IMPL)
        assert not unknown, f"lane {lane} lists unknown tools: {sorted(unknown)}"
    assert orchestrator.ORCHESTRATOR_TOOLS
    unknown = set(orchestrator.ORCHESTRATOR_TOOLS) - set(tools.IMPL)
    assert not unknown, f"orchestrator lists unknown tools: {sorted(unknown)}"
    # dispatch stays orchestrator-only: no lane may ever hold a dispatch tool
    for lane, names in orchestrator.LANE_TOOLS.items():
        assert not {"dispatch_agent", "dispatch_many"} & set(names), lane


# ── side-effects: action tools write an agent_action + record transcript steps ────────────────────

@pytest.fixture
def ctx(monkeypatch):
    """A RunContext bound as the active context, with bus writes/reads captured (no network)."""
    writes = []
    monkeypatch.setattr(bus, "write_action",
                        lambda sb, **kw: writes.append(kw))
    monkeypatch.setattr(bus, "deliver_customer_message", lambda sb, name, body: None)  # chat mirror — no-op in tests
    monkeypatch.setattr(bus, "fetch_briefing", lambda range_days=7: {"insights": {"trendingUp": ["金属感"]}})
    monkeypatch.setattr(bus, "fetch_customers", lambda: {"customers": [{"name": "Amy Lim", "lastVisitDaysAgo": 40}]})
    # place_ad / set_group_buy_coupon now create REAL entities through the TS routes (ADR-0012) — stub the hop.
    monkeypatch.setattr(bus, "post_propose_ad", lambda style_id, *a, **k: {"ok": True, "id": f"ad-{style_id}", "status": "active"})
    monkeypatch.setattr(bus, "post_propose_groupbuy", lambda style_id, *a, **k: {"ok": True, "deal": {"id": f"gb-{style_id}"}})
    # hypothesis snapshot (ADR-0015) reads the brain route — stub it empty so tests never depend on
    # whether the dev server happens to be running (it bit us: payloads silently grew a hypothesis).
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {})
    monkeypatch.setattr(bus, "update_campaign", lambda sb, cid, m, fields: None)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [])
    # ADR-0013 P0: propose_listing supersedes older rounds' pending proposals on its first call.
    supersedes = []
    monkeypatch.setattr(bus, "expire_stale_proposals", lambda sb, **kw: supersedes.append(kw) or 3)
    c = tools.RunContext(sb=object(), run_id="run-test", merchant_id="m-test")
    c.writes = writes  # expose for assertions
    c.supersedes = supersedes
    token = tools.use_context(c)
    yield c
    tools.reset_context(token)


def test_get_merchandising_candidates_returns_safe_exposure_buckets(ctx, monkeypatch):
    """陈列运营 consumes SAFE candidates: raise exposure, lower exposure, or propose a listing.
    It must not present itself as deleting/unlisting assets."""
    monkeypatch.setattr(config, "MATCH_MODE", "tag")
    monkeypatch.setattr(bus, "fetch_briefing", lambda range_days=7: {"insights": {
        "designPerformance": {
            "styles": [{"styleId": "style-dead", "title": "旧款", "tryOns": 5, "conversionRate": 0.0}],
            "highInterestLowConversion": [],
        },
        "demandTrends": [],
    }})
    monkeypatch.setattr(bus, "fetch_styles", lambda: {"styles": [
        {"id": "style-hot", "title": "银色猫眼", "merchantId": config.MERCHANT_ID, "tags": ["银色", "镜面"]},
        {"id": "style-dead", "title": "旧款", "merchantId": config.MERCHANT_ID, "tags": ["卡通"]},
    ]})
    monkeypatch.setattr(tools.trends_source, "get_external_trends", lambda trend_type=None: [
        {"label": "银色镜面猫眼", "tags": ["银色", "镜面"], "strength": 0.8},
        {"label": "暗黑哥特蝴蝶", "tags": ["暗黑"], "strength": 0.8},
    ])

    out = json.loads(tools.get_merchandising_candidates())
    assert out["increaseExposure"][0]["styleId"] == "style-hot"
    assert out["decreaseExposure"][0]["styleId"] == "style-dead"
    assert out["proposeListing"][0]["tag"] == "暗黑哥特蝴蝶"
    assert ctx.transcript[-1]["tool"] == "get_merchandising_candidates"


def test_place_ad_creates_a_real_campaign_and_links_the_action(ctx):
    """ADR-0016: the ad tool takes audience + TOTAL budget, snapshots its own forecast as the
    hypothesis, creates the campaign, and links the action forward to it."""
    out = tools.place_ad("style-1", "try_on_no_booking", 16000, 4)  # 4000分/day ≤ auto-launch cap
    assert "ad-style-1" in out and "launched" in out
    w = ctx.writes[0]
    assert w["action_type"] == "place_ad" and w["entity_id"] == "ad-style-1"
    p = w["payload"]
    assert p["audience"] == "try_on_no_booking" and p["totalBudgetCents"] == 16000
    assert p["dailyBudgetCents"] == 4000 and p["durationDays"] == 4
    # the CHOSEN plan's forecast is the hypothesis the monitor later measures against
    assert p["hypothesis"]["audience"] == "try_on_no_booking"
    assert len(p["hypothesis"]["expectedBookings"]) == 2  # a range, never a point estimate
    kinds = [s["kind"] for s in ctx.transcript]
    assert kinds == ["tool_call", "action"]
    assert ctx.transcript[-1]["status"] == "applied"


def test_place_ad_enforces_the_action_brief_as_law(ctx):
    """ADR-0016 §2: when briefs exist, off-brief styles and over-ceiling budgets are refused before
    any side effect — the brief is the executor's hard boundary, not a suggestion."""
    ctx.briefs = [{"action_type": "ad", "style_id": "style-1", "max_total_budget_cents": 12000}]
    with pytest.raises(ValueError, match="style_not_in_brief"):
        tools.place_ad("style-other", "try_on_no_booking", 6000)
    with pytest.raises(ValueError, match="budget_exceeds_brief"):
        tools.place_ad("style-1", "try_on_no_booking", 20000)
    assert ctx.writes == []
    tools.place_ad("style-1", "try_on_no_booking", 12000, 4)  # at the ceiling is legal
    assert ctx.writes[0]["payload"]["totalBudgetCents"] == 12000
    # dispatched as an executor lane (briefs list present) with NO ad brief filed → nothing lawful
    # to execute; a decision run's prose claims must never become spend (observed live: 决策
    # narrated "已提交" with zero submit_action_brief calls).
    ctx.briefs = [{"action_type": "coupon", "style_id": "style-1", "max_total_budget_cents": 7000}]
    with pytest.raises(ValueError, match="no_ad_brief_filed"):
        tools.place_ad("style-1", "try_on_no_booking", 6000)


def test_place_ad_refuses_what_the_wallet_cannot_honor(ctx, monkeypatch):
    """ADR-0016: brief ceilings bound each action separately, but they compete for ONE marketing
    wallet — placement (and a budget-raising revision) refuse an ask beyond what remains. Committed
    = draft full ask + active unspent remainder; spent money is history, not a commitment."""
    monkeypatch.setattr(config, "MARKETING_BUDGET_CENTS", 18000)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [
        {"id": "ad-live", "merchant_style_id": "style-live", "status": "active",
         "total_budget_cents": 12000, "spend_cents": 2000},   # commits 10000 → remaining 8000
        {"id": "ad-done", "merchant_style_id": "style-done", "status": "ended",
         "total_budget_cents": 80000, "spend_cents": 56000},  # history commits nothing
    ])
    with pytest.raises(ValueError, match="budget_exceeds_wallet:remaining_cents=8000"):
        tools.place_ad("style-1", "try_on_no_booking", 9000)
    assert ctx.writes == []
    tools.place_ad("style-1", "try_on_no_booking", 8000, 4)  # exactly the remainder is legal
    # raising a live campaign's budget re-checks the wallet against its own unspent delta
    with pytest.raises(ValueError, match="budget_exceeds_wallet"):
        tools.update_ad_campaign("ad-live", total_budget_cents=40000)


def test_place_ad_one_campaign_per_style_is_law(ctx, monkeypatch):
    """A live campaign must be revised (update_ad_campaign), never silently reconfigured by a second
    placement. A style whose campaign ENDED may run again — a fresh run of the same stable entity:
    version bumps and the old run's measured history resets instead of being inherited."""
    monkeypatch.setattr(config, "MARKETING_BUDGET_CENTS", 18000)
    updates = []
    monkeypatch.setattr(bus, "update_campaign", lambda sb, cid, m, fields: updates.append((cid, fields)))
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [
        {"id": "ad-style-1", "merchant_style_id": "style-1", "status": "active",
         "total_budget_cents": 4000, "spend_cents": 4000, "version": 1},
        {"id": "ad-style-2", "merchant_style_id": "style-2", "status": "ended",
         "total_budget_cents": 9000, "spend_cents": 9000, "version": 2, "clicks": 52},
    ])
    with pytest.raises(ValueError, match="campaign_exists_for_style"):
        tools.place_ad("style-1", "try_on_no_booking", 3000)
    assert ctx.writes == []
    tools.place_ad("style-2", "saved_or_viewed", 6000, 4)
    cid, fields = updates[-1]
    assert cid == "ad-style-2" and fields["version"] == 3
    assert fields["clicks"] == 0 and fields["spend_cents"] == 0


def test_get_ad_account_state_exposes_live_metrics(ctx, monkeypatch):
    """修改在投活动前，投广要看到实测指标和每个活动的剩余预算——否则无法判断还能动多少钱。"""
    monkeypatch.setattr(config, "MARKETING_BUDGET_CENTS", 18000)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [
        {"id": "ad-x", "merchant_style_id": "style-x", "status": "active", "audience": "saved_or_viewed",
         "total_budget_cents": 8000, "spend_cents": 5800, "clicks": 52, "bookings": 0,
         "impressions": 2100, "daily_budget_cents": 2000, "version": 1},
    ])
    out = json.loads(tools.get_ad_account_state())
    c = out["campaigns"][0]
    assert c["clicks"] == 52 and c["bookings"] == 0 and c["spend_cents"] == 5800 and c["impressions"] == 2100
    assert c["remaining_budget_cents"] == 2200  # 8000 − 5800


def test_update_ad_campaign_rejects_total_below_spent(ctx, monkeypatch):
    """已花的钱是历史：不能把总预算改到低于已花（会让剩余为负、状态自相矛盾）。"""
    monkeypatch.setattr(config, "MARKETING_BUDGET_CENTS", 18000)
    monkeypatch.setattr(bus, "update_campaign", lambda sb, cid, m, fields: None)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [
        {"id": "ad-x", "merchant_style_id": "style-x", "status": "active",
         "total_budget_cents": 8000, "spend_cents": 5800, "version": 1},
    ])
    with pytest.raises(ValueError, match="budget_below_spent:spent_cents=5800"):
        tools.update_ad_campaign("ad-x", total_budget_cents=4000)
    # 高于已花仍合法
    tools.update_ad_campaign("ad-x", total_budget_cents=7000)


def _coupon_facts(monkeypatch, floor=6000, price=8800):
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {"decisions": [
        {"styleId": "style-1", "priceCents": price, "durationMin": 60,
         "coupon": {"floorPriceCents": floor, "referencePriceCents": round(price * 0.8)},
         "ad": {}},
    ]})


def test_set_group_buy_coupon_configures_from_merchant_template(ctx, monkeypatch):
    """ADR-0016 Stage 3: the agent picks a TEMPLATE and restrictions; CODE computes the price. The
    deal is a real draft the merchant publishes — never claimed live, never a promised booking count."""
    _coupon_facts(monkeypatch)
    out = tools.set_group_buy_coupon("style-1", "weekday_10_off", "weekday_afternoon", 4, 7)
    assert "gb-style-1" in out and "awaiting merchant publish" in out
    w = ctx.writes[0]
    assert w["status"] == "proposed" and w["entity_id"] == "gb-style-1"
    p = w["payload"]
    assert p["priceCents"] == 7920           # 8800 × 0.9 — computed by code, not the model
    assert p["templateId"] == "weekday_10_off" and p["redemptionWindow"] == "weekday_afternoon"
    assert p["maxCoupons"] == 4 and p["hypothesis"]["floorPriceCents"] == 6000


def test_set_group_buy_coupon_refuses_invented_discounts_and_below_floor(ctx, monkeypatch):
    _coupon_facts(monkeypatch, floor=8500)  # even 10% off (7920) is below this floor
    with pytest.raises(ValueError, match="template_unknown"):
        tools.set_group_buy_coupon("style-1", "custom_13_7_off")  # inventing a discount is not a capability
    with pytest.raises(ValueError, match="price_below_profit_floor"):
        tools.set_group_buy_coupon("style-1", "weekday_10_off")
    _coupon_facts(monkeypatch, floor=None)  # full price already below the profit floor
    with pytest.raises(ValueError, match="price_below_profit_floor"):
        tools.set_group_buy_coupon("style-1", "weekday_10_off")
    assert ctx.writes == []


def test_awaiting_approval_is_derived_from_any_proposed_action(ctx, monkeypatch):
    """The one human gate (ADR-0007 §4) is DERIVED from the transcript, not a per-tool flag. Every path
    that writes a status='proposed' action must gate the run — including the two that previously set no
    flag: a 团购 draft, and an ad campaign above the auto-execute limit (lands as a draft)."""
    # 团购 draft — always proposed
    _coupon_facts(monkeypatch)
    tools.set_group_buy_coupon("style-1", "weekday_10_off", "weekday_afternoon", 4, 7)
    assert ctx.awaiting_approval is True


def test_over_budget_ad_draft_gates_the_run(ctx, monkeypatch):
    """A campaign above the merchant's auto-execute limit lands as a DRAFT (status='proposed'); the run
    must finalize as awaiting_approval. Previously this path set no flag → the gate was silently skipped."""
    monkeypatch.setattr(bus, "post_propose_ad",
                        lambda style_id, *a, **k: {"ok": True, "id": f"ad-{style_id}", "status": "draft"})
    tools.place_ad("style-1", "try_on_no_booking", 16000, 4)
    assert ctx.transcript[-1]["status"] == "proposed"
    assert ctx.awaiting_approval is True


def test_applied_only_run_is_not_awaiting_approval(ctx):
    """The negative: a run whose actions all went live (applied) needs no merchant approval."""
    tools.place_ad("style-1", "try_on_no_booking", 16000, 4)  # fixture stub → active → applied
    assert ctx.transcript[-1]["status"] == "applied"
    assert ctx.awaiting_approval is False


# ── 数分 Analysis Brief → 决策 candidate facts (search-space narrowing) ───────────────────────────

def test_get_candidate_business_facts_filters_to_the_focus_styles(ctx, monkeypatch):
    """决策's preferred first read: facts for ONLY the analyst's focus styles, never all 38."""
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {
        "decisions": [{"styleId": "s1"}, {"styleId": "s2"}, {"styleId": "s3"}],
        "capacity": {"band": "very_idle"}})
    out = json.loads(tools.get_candidate_business_facts("s1, s3, s9"))
    assert [d["styleId"] for d in out["decisions"]] == ["s1", "s3"]
    assert out["missing"] == ["s9"] and out["capacity"]["band"] == "very_idle"
    with pytest.raises(ValueError, match="style_ids_required"):
        tools.get_candidate_business_facts("")  # empty → widen via get_style_business_facts, not empty-call


def test_submit_analysis_brief_files_style_and_customer_candidates(ctx):
    filed = {}
    ctx.analysis_sink = lambda b: filed.update(b)
    alerts = json.dumps([{"type": "underexposed_high_conversion", "style_id": "s1", "evidence": {"cvr": 0.24}}])
    customers = json.dumps([{"name": "Rachel Goh", "reason": "60 天未到店＋偏好甜美"},
                            {"name": "Amy Lim", "reason": "49 天未到店＋偏好金属感"}])
    out = tools.submit_analysis_brief("s1, s2", alerts, "s7:样本太薄", True, customers)
    assert "2 focus styles" in out and "2 focus customers" in out
    assert filed["focus_style_ids"] == ["s1", "s2"]
    assert [c["name"] for c in filed["focus_customers"]] == ["Rachel Goh", "Amy Lim"]
    assert filed["evidence_gaps"] == ["s7:样本太薄"] and filed["memory_check_recommended"] is True


def test_submit_analysis_brief_is_insight_only(ctx):
    ctx.analysis_sink = None  # no sink = not the insight lane
    with pytest.raises(ValueError, match="analysis_brief_not_allowed"):
        tools.submit_analysis_brief("s1")


def test_submit_analysis_brief_rejects_non_array_alerts_or_customers(ctx):
    ctx.analysis_sink = lambda b: None
    with pytest.raises(ValueError, match="must_be_json_arrays"):
        tools.submit_analysis_brief("s1", '{"not": "a list"}')
    with pytest.raises(ValueError, match="must_be_json_arrays"):
        tools.submit_analysis_brief("s1", "[]", "", False, '{"not": "a list"}')


def test_customer_messages_both_classes_auto_send_labeled(ctx):
    """Both message classes now AUTO-SEND, always LABELED as the assistant (never impersonating the
    boss). Transactional stays whitelisted-kind; relationship sends freely via send_relationship_message."""
    tools.send_automated_notification("Amy Lim", "appointment_reminder", "明天 14:00 见！")
    sent = ctx.writes[0]
    assert sent["action_type"] == "send_customer_message" and sent["risk"] == "irreversible"
    assert sent["payload"]["body"].startswith("【Nailed-it 商家助手】")  # authorship never misleads
    with pytest.raises(ValueError, match="notification_kind_invalid"):
        tools.send_automated_notification("Amy Lim", "win_back_marketing", "好久不见")  # marketing not a transactional kind
    tools.send_relationship_message("Amy Lim", "好久不见，新到金属感系列…", "60 天未到店＋偏好金属感")
    rel = ctx.writes[1]
    assert rel["action_type"] == "send_customer_message" and rel["risk"] == "irreversible"
    assert rel["payload"]["body"].startswith("【Nailed-it 商家助手】")  # relationship msgs are labeled too
    assert ctx.awaiting_approval is False  # autonomous send — no merchant gate


def test_action_tools_validate_model_supplied_payloads_before_write(ctx):
    with pytest.raises(ValueError, match="audience_unknown"):
        tools.place_ad("style-1", "everyone_on_earth", 5000)
    with pytest.raises(ValueError, match="total_budget_cents_must_be_positive"):
        tools.place_ad("style-1", "try_on_no_booking", -1)
    with pytest.raises(ValueError, match="style_id_invalid"):
        tools.set_group_buy_coupon("../style", "weekday_10_off")
    with pytest.raises(ValueError, match="body_too_long"):
        tools.send_automated_notification("Melissa Tan", "aftercare", "x" * 281)

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
        tools.dispatch_agent("catalog", "任务", "decision")  # budget=3 spent (catalog is non-spend, so
        # the deterministic portfolio gate can't mask this budget-exhaustion check)


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


def test_dispatch_many_reports_per_lane_and_never_loses_siblings(ctx):
    """A lane crashing MID-RUN must not erase its siblings' completed work (pool.map used to raise
    and drop everything, sending the orchestrator into blind retries that burned its iteration
    budget). The batch reports per-lane: successes recorded, the failure named."""
    ctx.round = _round_state()
    real = ctx.round.dispatch_fn

    def flaky(slug, task, parent):
        if slug == "coupon":
            raise RuntimeError("model_dead_response")
        return real(slug, task, parent)

    ctx.round.dispatch_fn = flaky
    import json as _json
    out = tools.dispatch_many(_json.dumps([
        {"agent": "ad", "task": "落地投广", "parent": "decision"},
        {"agent": "coupon", "task": "落地团购", "parent": "decision"},
    ]))
    assert "run-ad" in out                      # the survivor's result is kept and recorded
    assert "[coupon] FAILED" in out and "model_dead_response" in out
    assert "do not dispatch them again" in out  # the model is told exactly what not to retry
    assert ctx.round.dispatched.get("ad") == "run-ad"


def test_dispatch_many_retries_stale_connections_once(ctx):
    """Connection-class errors get ONE retry on a fresh socket (a shared httpx pool hands stale
    connections to parallel threads after idling — measured live: a whole batch died on
    RemoteProtocolError). Non-connection errors do not retry."""
    ctx.round = _round_state()
    real = ctx.round.dispatch_fn
    attempts = {"ad": 0}

    class RemoteProtocolError(Exception):
        pass

    def flaky(slug, task, parent):
        if slug == "ad":
            attempts["ad"] += 1
            if attempts["ad"] == 1:
                raise RemoteProtocolError("Server disconnected")
        return real(slug, task, parent)

    ctx.round.dispatch_fn = flaky
    import json as _json
    out = tools.dispatch_many(_json.dumps([{"agent": "ad", "task": "投广", "parent": "decision"}]))
    assert attempts["ad"] == 2 and "run-ad" in out  # died once, retried, succeeded


def test_portfolio_conflict_blocks_spend_lanes():
    """ADR-0016 §6 确定性组合门（取代 LLM 风控）：同款同时投广+团购（归因冲突）时，代码拒绝分派
    花钱执行者（ad/coupon）。不花营销钱包的 catalog/customer_ops 放行。"""
    from nailed_agents.orchestrator import RoundState

    st = RoundState(dispatch_fn=lambda slug, task, parent: (f"run-{slug}", f"{slug} 完成"), budget=9)
    st.briefs = [
        {"action_type": "ad", "style_id": "style-melissa-img-8284"},
        {"action_type": "coupon", "style_id": "style-melissa-img-8284"},  # 同款——归因冲突
    ]
    with pytest.raises(ValueError, match="blocked_by_portfolio:attribution_conflict"):
        st.dispatch("ad", "投广", "decision")
    with pytest.raises(ValueError, match="blocked_by_portfolio"):
        st.dispatch("coupon", "团购", "decision")
    _, t = st.dispatch("catalog", "陈列", "decision")  # 不花钱，放行
    assert "catalog" in t


def test_no_portfolio_conflict_lets_spend_through():
    from nailed_agents.orchestrator import RoundState

    st = RoundState(dispatch_fn=lambda slug, task, parent: (f"run-{slug}", f"{slug} done"), budget=9)
    st.briefs = [
        {"action_type": "ad", "style_id": "style-melissa-img-8265"},
        {"action_type": "coupon", "style_id": "style-melissa-img-8284"},  # 不同款——无冲突
    ]
    _, t = st.dispatch("ad", "投广", "decision")  # 无冲突放行
    assert "ad" in t


# ── ADR-0015: memory v2 tools — agent judges, code anchors identity + evidence ───────────────────

_ACTION_ROW = {
    "id": "act-1", "run_id": "r-ad", "type": "place_ad", "risk": "reversible", "status": "applied",
    "entity_type": "style_ad", "entity_id": "ad-style-1", "created_at": "2026-07-04T00:00:00+00:00",
    "payload": {"styleId": "style-1", "slot": "top_funnel", "budgetCents": 5000,
                "hypothesis": {"expectedRoas": 4.1, "costPerBookingCents": 8000}},
}
_CAMPAIGN_ROW = {"id": "ad-style-1", "impressions": 4000, "clicks": 120, "bookings": 2, "spend_cents": 56000}


def test_record_action_outcome_derives_identity_and_comparison_from_the_action(ctx, monkeypatch):
    rows = []
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: rows.append(row))
    monkeypatch.setattr(bus, "fetch_action", lambda sb, aid, m: _ACTION_ROW if aid == "act-1" else None)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [_CAMPAIGN_ROW])
    tools.record_action_outcome("act-1", "实测每单花费 280 元，决策预测 80 元——低估约 3.5 倍", "high")
    r = rows[0]
    assert r["kind"] == "action_outcome" and r["key"] == "act-1" and r["domain"] == "ad"
    assert r["scope_type"] == "style" and r["scope_id"] == "style-1"
    assert r["source_action_id"] == "act-1" and r["entity_id"] == "ad-style-1"
    # code-derived comparison: measured 56000/2=28000 vs predicted 8000 → ratio 3.5, cost underestimated
    assert r["comparison"]["measured"]["spend_per_booking_cents"] == 28000
    assert r["comparison"]["ratio"] == 3.5 and r["comparison"]["direction"] == "underestimated_cost"
    assert r["window_start"] == _ACTION_ROW["created_at"] and r["confidence"] == "high"


def test_record_action_outcome_refuses_immature_window_and_bad_inputs(ctx, monkeypatch):
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: (_ for _ in ()).throw(AssertionError("must not write")))
    monkeypatch.setattr(bus, "fetch_action", lambda sb, aid, m: {**_ACTION_ROW} if aid == "act-1" else None)
    monkeypatch.setattr(bus, "fetch_campaign_outcomes",
                        lambda sb, m: [{**_CAMPAIGN_ROW, "impressions": 0}])
    with pytest.raises(ValueError, match="observation_window_immature"):
        tools.record_action_outcome("act-1", "太早", "low")  # no data yet → pending in prose, not memory
    with pytest.raises(ValueError, match="action_not_found"):
        tools.record_action_outcome("act-nope", "x", "low")
    with pytest.raises(ValueError, match="confidence_invalid"):
        tools.record_action_outcome("act-1", "x", "certain")


def test_record_round_verdict_requires_real_evidence(ctx, monkeypatch):
    rows = []
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: rows.append(row))
    monkeypatch.setattr(bus, "fetch_action", lambda sb, aid, m: _ACTION_ROW if aid == "act-1" else None)
    with pytest.raises(ValueError, match="evidence_required"):
        tools.record_round_verdict("没有证据的观点", "", "high")
    with pytest.raises(ValueError, match="evidence_action_not_found"):
        tools.record_round_verdict("引用了不存在的动作", "act-ghost", "high")
    tools.record_round_verdict("满产能时仍投广，新增预约接不住", "act-1", "medium")
    r = rows[0]
    assert r["kind"] == "round_verdict" and r["scope_type"] == "merchant"
    assert r["content"]["evidenceActionIds"] == ["act-1"]
    # confidence drives TTL: medium = 14d < high = 30d
    assert r["expires_at"] > r["window_end"]


def test_memory_write_is_monitor_only(ctx, monkeypatch):
    monkeypatch.setattr(bus, "upsert_memory", lambda sb, row: (_ for _ in ()).throw(AssertionError("must not write")))
    ctx.agent_slug = "decision"  # a non-monitor lane trying to write experience
    with pytest.raises(ValueError, match="memory_write_not_allowed"):
        tools.record_action_outcome("act-1", "x", "low")
    with pytest.raises(ValueError, match="memory_write_not_allowed"):
        tools.record_round_verdict("x", "act-1", "low")


def test_search_memory_ranks_by_relevance_and_respects_domain_access(ctx, monkeypatch):
    mems = [
        {"id": "m-exact", "kind": "action_outcome", "domain": "ad", "scope_type": "style",
         "scope_id": "style-1", "scope_tags": [], "claim": "exact", "confidence": "low",
         "created_at": "2026-07-01", "content": {}},
        {"id": "m-tag", "kind": "action_outcome", "domain": "ad", "scope_type": "tag",
         "scope_id": None, "scope_tags": ["金属感"], "claim": "tag", "confidence": "low",
         "created_at": "2026-07-02", "content": {}},
        {"id": "m-cust", "kind": "action_outcome", "domain": "customer_ops", "scope_type": "segment",
         "scope_id": "seg-1", "scope_tags": [], "claim": "other-domain", "confidence": "high",
         "created_at": "2026-07-03", "content": {}},
    ]
    monkeypatch.setattr(bus, "fetch_memory", lambda sb, m, limit=200: mems)
    ctx.agent_slug = "trend"  # allowed: {ad, catalog} — customer_ops rows must be invisible
    out = json.loads(tools.search_memory(scope_refs="style-1", scope_tags="金属感", limit=5))
    ids = [m["memoryId"] for m in out["memories"]]
    assert ids[0] == "m-exact"          # +100 exact ref beats +50 tag
    assert "m-cust" not in ids          # domain access filter
    ctx.agent_slug = "ad"               # executors don't re-interpret strategy
    with pytest.raises(ValueError, match="memory_access_denied"):
        tools.search_memory(scope_refs="style-1")


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


# ── context routing (ADR-0014): deterministic multi-source injection ──────────────────────────────

def test_upstream_context_routes_parent_then_policy_extras_once():
    from nailed_agents.orchestrator import _upstream_context

    results = {"insight": "简报结论", "trend": "机会结论", "decision": "动作结论"}
    # decision parented to trend gets trend (parent) + insight (policy extra), each once
    assert _upstream_context("decision", "trend", results) == [
        ("trend", "机会结论"), ("insight", "简报结论"),
    ]
    # parent==policy source deduped; missing sources skipped silently
    assert _upstream_context("decision", "insight", {"insight": "简报结论"}) == [("insight", "简报结论")]
    # monitor gets decision even when its dispatch parent is an executor
    assert _upstream_context("monitor", "ad", {"ad": "投广结论", "decision": "动作结论"}) == [
        ("ad", "投广结论"), ("decision", "动作结论"),
    ]
    # lanes without a policy stay single-parent
    assert _upstream_context("ad", "decision", results) == [("decision", "动作结论")]


def test_execution_context_carries_action_ids_for_revision():
    from nailed_agents.orchestrator import _execution_context

    text = _execution_context([
        {"id": "act-1", "run_id": "r1", "type": "place_ad", "status": "applied", "risk": "reversible",
         "entity_id": "ad-style-1", "payload": {"budgetCents": 5000}, "extra_noise": "dropped"},
    ])
    data = json.loads(text.split("：\n", 1)[1])
    assert data == [{"id": "act-1", "type": "place_ad", "status": "applied", "risk": "reversible",
                     "entity_id": "ad-style-1", "created_at": None, "payload": {"budgetCents": 5000},
                     "revisionable": True}]
    assert "request_revision" in text  # the injection tells the monitor what the ids are FOR


def test_monitor_snapshot_barrier_rejects_parallel_batch():
    """ADR-0014 invariant: the monitor's execution list is built at run start — batching it with any
    other lane risks a partial snapshot, so reserve() must reject the batch atomically."""
    from nailed_agents.orchestrator import RoundState

    state = RoundState(dispatch_fn=lambda s, t, p: (f"run-{s}", "ok"))
    initial_budget = state.budget
    with pytest.raises(ValueError, match="monitor_must_not_run_in_parallel"):
        state.reserve(["ad", "monitor"])
    assert state.budget == initial_budget and not state._taken  # atomic: nothing reserved on rejection
    state.reserve(["monitor"])  # alone is fine — prior dispatches are blocking, hence terminal
    assert "monitor" in state._taken


def test_execution_context_marks_revisionable_and_orders_fields():
    from nailed_agents.orchestrator import _execution_context

    text = _execution_context([
        {"id": "a1", "type": "place_ad", "status": "applied", "risk": "reversible",
         "entity_id": "ad-x", "created_at": "2026-07-11T01:00:00Z", "payload": {}},
        {"id": "a2", "type": "send_customer_message", "status": "applied", "risk": "irreversible",
         "entity_id": None, "created_at": "2026-07-11T01:00:01Z", "payload": {}},
    ])
    data = json.loads(text.split("：\n", 1)[1])
    assert data[0]["revisionable"] is True and data[1]["revisionable"] is False
    assert data[0]["created_at"] == "2026-07-11T01:00:00Z"


# ── ADR-0016 Stage 2: portfolio simulation — deterministic conflict checks ────────────────────────

def test_simulate_action_portfolio_flags_conflicts_budget_and_capacity(ctx, monkeypatch):
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [
        {"status": "active", "total_budget_cents": 12000},
    ])
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {"capacity": {"utilizationPct": 82}})
    ctx.brief_sink = lambda b: None
    ctx.briefs = [
        {"action_type": "ad", "style_id": "s-1", "max_total_budget_cents": 10000, "target_bookings_max": 4},
        {"action_type": "coupon", "style_id": "s-1", "max_total_budget_cents": 1, "target_bookings_max": 3},
    ]
    captured = []
    ctx.portfolio_sink = captured.append
    out = json.loads(tools.simulate_action_portfolio())
    assert out["feasible"] is False
    assert captured == [out]
    text = " ".join(out["warnings"])
    assert "归因冲突" in text        # ad + coupon on the same style
    assert "预算竞争" in text        # 10001 > 18000-12000=6000
    assert "产能压力" in text        # 82% util with booking targets
    assert out["budget"]["remaining_cents"] == 6000


def test_simulate_action_portfolio_is_decision_only_and_passes_clean_plans(ctx, monkeypatch):
    with pytest.raises(ValueError, match="portfolio_simulation_not_allowed"):
        tools.simulate_action_portfolio()  # no brief_sink → not the decision agent
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [])
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {"capacity": {"utilizationPct": 40}})
    ctx.brief_sink = lambda b: None
    ctx.briefs = [{"action_type": "ad", "style_id": "s-1", "max_total_budget_cents": 9000, "target_bookings_max": 4}]
    out = json.loads(tools.simulate_action_portfolio())
    assert out["feasible"] is True and out["warnings"] == []
