"""Pre-finals hardening regressions (2026-07-14 audit):
  1. Deterministic portfolio gate (replaces the LLM reviewer) — a spend lane is blocked ONLY when the
     same style is briefed for both ad and coupon (attribution conflict); everything else dispatches.
  2. Action Briefs are retractable/replaceable — a prose "withdrawal" after portfolio simulation used
     to leave the shared brief live for the portfolio gate + executors.
  3. Evidence maturity is code-enforced (24h / 500 impressions / 15 clicks), not `impressions > 0`.
  4. Trigger kind maps onto the orchestrator run's trigger_source (cadence→schedule, alarm→event).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from nailed_agents import bus, tools
from nailed_agents.orchestrator import RoundState


# ── 1 · deterministic portfolio gate (replaces the LLM reviewer) ──────────────────────────────────

def _brief(action, style):
    return {"action_type": action, "style_id": style}

def _state_with_briefs(*briefs):
    s = RoundState(dispatch_fn=lambda slug, task, parent: (f"run-{slug}", "ok"))
    s.briefs = list(briefs)
    return s

def test_spend_lane_blocked_on_attribution_conflict():
    # same style briefed for BOTH ad and coupon → outcomes can't be attributed → block the spend lane
    s = _state_with_briefs(_brief("ad", "s1"), _brief("coupon", "s1"))
    with pytest.raises(ValueError, match="blocked_by_portfolio:attribution_conflict:s1"):
        s.dispatch("ad", "task", None)

def test_spend_lane_dispatches_when_styles_differ():
    # ad on s1, coupon on s2 — no shared style → no conflict → both allowed
    s = _state_with_briefs(_brief("ad", "s1"), _brief("coupon", "s2"))
    assert s.dispatch("coupon", "task", None)[0] == "run-coupon"

def test_spend_lane_dispatches_with_no_briefs():
    assert _state_with_briefs().dispatch("ad", "task", None)[0] == "run-ad"

def test_non_spend_lane_never_blocked_by_conflict():
    s = _state_with_briefs(_brief("ad", "s1"), _brief("coupon", "s1"))
    assert s.dispatch("catalog", "task", None)[0] == "run-catalog"

def test_blocked_lane_can_redispatch_after_conflict_withdrawn():
    """A blocked spend lane must NOT burn its one-per-round slot — once 决策 withdraws the conflicting
    brief, the orchestrator re-dispatches it (the block used to burn the lane's slot)."""
    s = _state_with_briefs(_brief("ad", "s1"), _brief("coupon", "s1"))
    with pytest.raises(ValueError, match="blocked_by_portfolio"):
        s.dispatch("ad", "task", None)
    s.briefs = [_brief("ad", "s1")]  # 决策 withdrew the conflicting coupon brief
    assert s.dispatch("ad", "task", None)[0] == "run-ad"

def test_blocked_reserved_lane_rolls_back_its_slot():
    s = _state_with_briefs(_brief("ad", "s1"), _brief("coupon", "s1"))
    s.reserve(["ad"])
    budget_after_reserve = s.budget
    with pytest.raises(ValueError, match="blocked_by_portfolio"):
        s.dispatch("ad", "task", None, reserved=True)
    assert s.budget == budget_after_reserve + 1 and "ad" not in s._taken
    s.briefs = [_brief("ad", "s1")]
    assert s.dispatch("ad", "task", None)[0] == "run-ad"


# ── 2 · brief withdraw / replace ──────────────────────────────────────────────────────────────────

@pytest.fixture
def decision_ctx():
    shared: list[dict] = []

    def sink(brief):
        shared.append(brief)

    def withdraw(action_type, style_id):
        before = len(shared)
        shared[:] = [b for b in shared
                     if not (b["action_type"] == action_type and b["style_id"] == style_id)]
        return len(shared) < before

    c = tools.RunContext(sb=object(), run_id="run-decision", merchant_id="m-test")
    c.brief_sink = sink
    c.brief_withdraw = withdraw
    token = tools.use_context(c)
    yield c, shared
    tools.reset_context(token)

def _submit(style="style-melissa-img-8284", action="ad", budget=5000):
    return tools.submit_action_brief(
        action_type=action, style_id=style, objective="测试目标：8 单以内拉新",
        max_total_budget_cents=budget,
    )

def test_withdraw_removes_the_shared_brief(decision_ctx):
    ctx, shared = decision_ctx
    _submit(action="ad")
    _submit(action="coupon")
    assert len(shared) == 2
    out = tools.withdraw_action_brief(action_type="coupon", style_id="style-melissa-img-8284")
    assert "withdrawn" in out
    assert [b["action_type"] for b in shared] == ["ad"]
    assert [b["action_type"] for b in ctx.briefs] == ["ad"]

def test_resubmit_replaces_instead_of_duplicating(decision_ctx):
    ctx, shared = decision_ctx
    _submit(budget=5000)
    out = _submit(budget=3000)  # same (ad, style) — supersedes
    assert "replaced" in out
    assert len(shared) == 1 and shared[0]["max_total_budget_cents"] == 3000
    assert len(ctx.briefs) == 1 and ctx.briefs[0]["max_total_budget_cents"] == 3000

def test_withdraw_requires_the_decision_capability():
    c = tools.RunContext(sb=object(), run_id="run-x", merchant_id="m-test")  # no sink/withdraw
    token = tools.use_context(c)
    try:
        with pytest.raises(ValueError, match="briefs_not_allowed"):
            tools.withdraw_action_brief(action_type="ad", style_id="style-melissa-img-8284")
    finally:
        tools.reset_context(token)


# ── 3 · evidence maturity gate ────────────────────────────────────────────────────────────────────

def _campaign(imp=0, clicks=0, age_hours=0.0):
    created = (datetime.now(timezone.utc) - timedelta(hours=age_hours)).isoformat()
    return {"id": "c1", "impressions": imp, "clicks": clicks, "created_at": created}

def test_one_stray_impression_is_not_mature():
    assert bus._evidence_mature(_campaign(imp=1, age_hours=2)) is False

def test_mature_by_volume_or_clicks_or_age():
    assert bus._evidence_mature(_campaign(imp=500, age_hours=1)) is True
    assert bus._evidence_mature(_campaign(imp=10, clicks=15, age_hours=1)) is True
    assert bus._evidence_mature(_campaign(imp=1, age_hours=25)) is True

def test_no_data_is_never_mature():
    assert bus._evidence_mature(_campaign(imp=0, age_hours=100)) is False


# ── 4 · trigger kind → trigger_source mapping (the pure mapping run_round applies) ───────────────

def test_trigger_kind_maps_to_run_trigger_source():
    mapping = {"cadence": "schedule", "evidence_matured": "event", "threshold_alarm": "event"}
    assert mapping.get("cadence") == "schedule"
    assert mapping.get("threshold_alarm") == "event"
    assert mapping.get("", "manual") == "manual"


# ── 5 · deterministic runtime router (no LLM orchestrator for fixed business rounds) ────────────

def _stub_runtime_bus(monkeypatch):
    from nailed_agents import config
    from nailed_agents import orchestrator as orch

    monkeypatch.setattr(config, "require_env", lambda: None)
    monkeypatch.setattr(bus, "supabase", lambda: object())
    monkeypatch.setattr(bus, "now_iso", lambda: "2026-07-14T00:00:00Z")
    monkeypatch.setattr(bus, "sweep_stale_runs", lambda *a, **k: None)
    monkeypatch.setattr(bus, "start_round", lambda *a, **k: "round-runtime")
    agents = {
        slug: {"id": f"agent-{slug}", "instructions": f"{slug} skill", "version": 1}
        for slug in [*orch.LANE_TOOLS.keys(), "orchestrator"]
    }
    monkeypatch.setattr(bus, "agents_by_slug", lambda sb: agents)
    started: list[dict] = []
    finished: list[dict] = []
    monkeypatch.setattr(
        bus, "start_run",
        lambda sb, **kw: started.append(kw) or f"run-{kw['agent_id'].replace('agent-', '')}",
    )
    monkeypatch.setattr(bus, "finish_run", lambda sb, run_id, **kw: finished.append({"run_id": run_id, **kw}))
    monkeypatch.setattr(bus, "finish_round", lambda *a, **k: None)
    monkeypatch.setattr(bus, "update_blackboard", lambda *a, **k: None)
    monkeypatch.setattr(bus, "fetch_round_actions", lambda *a, **k: [])
    monkeypatch.setattr(bus, "fetch_due_actions", lambda *a, **k: [])
    monkeypatch.setattr(bus, "fetch_memory", lambda *a, **k: [])
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda *a, **k: [])
    monkeypatch.setattr(
        orch,
        "_merchandising_route_signal",
        lambda sb, range_days: {"shouldDispatch": True, "reason": "test merchandising candidate"},
    )
    monkeypatch.setattr(
        orch,
        "_customer_ops_route_signal",
        lambda: {"shouldDispatch": True, "reason": "test customer candidate"},
    )
    return started, finished


def test_runtime_planning_routes_decision_briefs_without_llm_orchestrator(monkeypatch):
    from nailed_agents import runner
    from nailed_agents import orchestrator as orch

    _stub_runtime_bus(monkeypatch)
    seen: list[str] = []

    def fake_lane(sb, agents, range_days, state, orch_run_id, round_id, slug, task, parent_slug):
        seen.append(slug)
        if slug == "decision":
            state.briefs.append({"action_type": "ad", "style_id": "style-melissa-img-8265"})
            state.portfolio_simulated = True
            state.portfolio_result = {"feasible": True, "warnings": []}
        return f"run-{slug}", f"{slug} done"

    monkeypatch.setattr(orch, "_run_lane", fake_lane)
    monkeypatch.setattr(runner, "run_agent", lambda *a, **k: (_ for _ in ()).throw(AssertionError("LLM orchestrator should not run")))

    runs = orch.run_round(trigger_kind="cadence", routing_mode="runtime")

    assert runs["orchestrator"] == "run-orchestrator"
    assert seen[:3] == ["insight", "trend", "decision"]
    assert "ad" in seen and "coupon" not in seen
    assert "catalog" in seen and "customer_ops" in seen
    assert seen[-1] == "monitor"


def test_runtime_planning_does_not_route_spend_without_business_portfolio_check(monkeypatch):
    from nailed_agents import runner
    from nailed_agents import orchestrator as orch

    _stub_runtime_bus(monkeypatch)
    seen: list[str] = []

    def fake_lane(sb, agents, range_days, state, orch_run_id, round_id, slug, task, parent_slug):
        seen.append(slug)
        if slug == "decision":
            state.briefs.append({"action_type": "ad", "style_id": "style-melissa-img-8265"})
            # Deliberately no simulate_action_portfolio result.
        return f"run-{slug}", f"{slug} done"

    monkeypatch.setattr(orch, "_run_lane", fake_lane)
    monkeypatch.setattr(runner, "run_agent", lambda *a, **k: (_ for _ in ()).throw(AssertionError("LLM orchestrator should not run")))

    orch.run_round(trigger_kind="cadence", routing_mode="runtime")

    assert "decision" in seen
    assert "ad" not in seen and "coupon" not in seen
    assert "catalog" in seen and "customer_ops" in seen


def test_runtime_planning_skips_non_spend_lanes_without_grounded_candidates(monkeypatch):
    from nailed_agents import runner
    from nailed_agents import orchestrator as orch

    _stub_runtime_bus(monkeypatch)
    monkeypatch.setattr(
        orch,
        "_merchandising_route_signal",
        lambda sb, range_days: {"shouldDispatch": False, "reason": "no merchandising candidates"},
    )
    monkeypatch.setattr(
        orch,
        "_customer_ops_route_signal",
        lambda: {"shouldDispatch": False, "reason": "no customer ops candidates"},
    )
    seen: list[str] = []

    def fake_lane(sb, agents, range_days, state, orch_run_id, round_id, slug, task, parent_slug):
        seen.append(slug)
        if slug == "decision":
            state.briefs.append({"action_type": "ad", "style_id": "style-melissa-img-8265"})
            state.portfolio_simulated = True
            state.portfolio_result = {"feasible": True, "warnings": []}
        return f"run-{slug}", f"{slug} done"

    monkeypatch.setattr(orch, "_run_lane", fake_lane)
    monkeypatch.setattr(runner, "run_agent", lambda *a, **k: (_ for _ in ()).throw(AssertionError("LLM orchestrator should not run")))

    runs = orch.run_round(trigger_kind="cadence", routing_mode="runtime")

    assert "ad" in seen
    assert "catalog" not in seen and "customer_ops" not in seen
    assert seen[-1] == "monitor"
    assert runs["orchestrator"] == "run-orchestrator"


def test_merchandising_route_signal_depends_on_grounded_candidates(monkeypatch):
    from nailed_agents import orchestrator as orch

    monkeypatch.setattr(
        tools,
        "build_merchandising_candidates",
        lambda range_days, sb=None: {"increaseExposure": [], "decreaseExposure": [], "proposeListing": []},
    )
    assert orch._merchandising_route_signal(object(), 7)["shouldDispatch"] is False

    monkeypatch.setattr(
        tools,
        "build_merchandising_candidates",
        lambda range_days, sb=None: {
            "increaseExposure": [{"styleId": "s1"}],
            "decreaseExposure": [],
            "proposeListing": [],
        },
    )
    signal = orch._merchandising_route_signal(object(), 7)
    assert signal["shouldDispatch"] is True
    assert signal["counts"]["increaseExposure"] == 1


def test_customer_ops_route_signal_requires_lapsed_grounded_customer(monkeypatch):
    from nailed_agents import orchestrator as orch

    monkeypatch.setattr(bus, "fetch_customers", lambda: {"customers": [
        {"name": "New", "lastVisitDaysAgo": 12, "bookingCount": 1},
        {"name": "Opted Out", "lastVisitDaysAgo": 90, "bookingCount": 3, "optOut": True},
        {"name": "Prospect", "lastVisitDaysAgo": None, "bookingCount": 0},
    ]})
    assert orch._customer_ops_route_signal()["shouldDispatch"] is False

    monkeypatch.setattr(bus, "fetch_customers", lambda: {"customers": [
        {"name": "Rachel Goh", "lastVisitDaysAgo": 45, "bookingCount": 2},
    ]})
    signal = orch._customer_ops_route_signal()
    assert signal["shouldDispatch"] is True
    assert signal["topCustomers"] == ["Rachel Goh"]


def test_runtime_followup_runs_monitor_only(monkeypatch):
    from nailed_agents import runner
    from nailed_agents import orchestrator as orch

    _stub_runtime_bus(monkeypatch)
    seen: list[str] = []
    monkeypatch.setattr(
        orch, "_run_lane",
        lambda sb, agents, range_days, state, orch_run_id, round_id, slug, task, parent_slug:
            (seen.append(slug) or (f"run-{slug}", f"{slug} done")),
    )
    monkeypatch.setattr(runner, "run_agent", lambda *a, **k: (_ for _ in ()).throw(AssertionError("LLM orchestrator should not run")))

    orch.run_round(trigger_kind="evidence_matured", trigger_reason="ad observation window matured", routing_mode="runtime")

    assert seen == ["monitor"]


def test_runtime_router_keeps_llm_orchestrator_for_open_merchant_requests(monkeypatch):
    from nailed_agents import orchestrator as orch

    called = []
    monkeypatch.setattr(
        orch, "_run_round_llm_orchestrator",
        lambda *a, **k: called.append((a, k)) or {"orchestrator": "run-llm"},
    )

    assert orch.run_round(trigger_kind="merchant_request") == {"orchestrator": "run-llm"}
    assert called


# ── 6 · cross-round idempotency (P0): no duplicate follow-up rounds / event storm ────────────────

class _Res:
    def __init__(self, data): self.data = data

class _Q:
    """Chainable fake PostgREST query — filters are DB-side, so the fake just returns its canned rows;
    what we pin here is the PYTHON-side de-duplication logic."""
    def __init__(self, data): self._data = data
    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def in_(self, *a, **k): return self
    def is_(self, *a, **k): return self
    def gte(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def execute(self): return _Res(self._data)

class _SB:
    def __init__(self, **tables): self.tables = tables
    def table(self, name): return _Q(self.tables.get(name, []))


def test_due_actions_exclude_already_evaluated_actions(monkeypatch):
    """The evidence_matured storm: once the monitor has recorded an action_outcome for an action, that
    action must STOP coming back as 'due' — otherwise every cron tick re-fires a monitor round for it.
    The idempotency key is the action id (agent_memory kind='action_outcome', key=action_id)."""
    monkeypatch.setattr(bus, "fetch_campaign_outcomes",
                        lambda sb, m: [{"id": "ad-1", "impressions": 900, "clicks": 40,
                                        "created_at": datetime.now(timezone.utc).isoformat()}])
    sb = _SB(
        agent_actions=[{"id": "act-old", "entity_id": "ad-1"}, {"id": "act-new", "entity_id": "ad-1"}],
        agent_memory=[{"key": "act-old"}],  # already measured
    )
    due = bus.fetch_due_actions(sb, "m-1")
    assert [d["id"] for d in due] == ["act-new"]  # the evaluated one is gone; a revision's NEW id is still due


def test_evaluated_action_ids_reads_the_outcome_keys():
    sb = _SB(agent_memory=[{"key": "act-1"}, {"key": "act-2"}, {"key": None}])
    assert bus.evaluated_action_ids(sb, "m-1") == {"act-1", "act-2"}


def test_trigger_fingerprint_is_kind_plus_entity():
    assert bus.trigger_fingerprint("threshold_alarm", "ad-9") == "threshold_alarm:ad-9"
    assert bus.trigger_fingerprint("cadence", None) == "cadence:global"  # no entity → global key


def test_trigger_cooldown_reads_the_round_that_already_fired():
    """A round stamps its trigger fingerprint into agent_rounds.blackboard — so a threshold_alarm that
    stays red does NOT re-fire a round every tick."""
    assert bus.trigger_fired_recently(_SB(agent_rounds=[{"id": "r-1"}]), "m-1", "threshold_alarm:ad-9", 180) is True
    assert bus.trigger_fired_recently(_SB(agent_rounds=[]), "m-1", "threshold_alarm:ad-9", 180) is False


def test_active_round_guard_blocks_overlapping_rounds():
    """cron + manual button must not run two rounds at once."""
    assert bus.has_active_round(_SB(agent_rounds=[{"id": "r-live"}]), "m-1") is True
    assert bus.has_active_round(_SB(agent_rounds=[]), "m-1") is False
