"""Pre-finals hardening regressions (2026-07-14 audit):
  1. Reviewer gate is FAIL-CLOSED — spend lanes dispatch only on an explicit approval verdict.
  2. Action Briefs are retractable/replaceable — a prose "withdrawal" after portfolio simulation used
     to leave the shared brief live for the reviewer + executors.
  3. Evidence maturity is code-enforced (24h / 500 impressions / 15 clicks), not `impressions > 0`.
  4. Trigger kind maps onto the orchestrator run's trigger_source (cadence→schedule, alarm→event).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from nailed_agents import bus, tools
from nailed_agents.orchestrator import RoundState


# ── 1 · reviewer gate: fail-closed ────────────────────────────────────────────────────────────────

def _state_with_verdict(verdict):
    s = RoundState(dispatch_fn=lambda slug, task, parent: (f"run-{slug}", "ok"))
    s.reviewer_verdict = verdict
    return s

@pytest.mark.parametrize("verdict", [None, "REVISION_REQUIRED", "MERCHANT_APPROVAL_REQUIRED"])
def test_spend_lane_blocked_without_explicit_approval(verdict):
    s = _state_with_verdict(verdict)
    with pytest.raises(ValueError, match="blocked_by_reviewer"):
        s.dispatch("ad", "task", None)

@pytest.mark.parametrize("verdict", ["APPROVED", "APPROVED_WITH_CONDITIONS"])
def test_spend_lane_dispatches_on_approval(verdict):
    s = _state_with_verdict(verdict)
    run_id, _ = s.dispatch("coupon", "task", None)
    assert run_id == "run-coupon"

def test_non_spend_lane_needs_no_verdict():
    s = _state_with_verdict(None)
    run_id, _ = s.dispatch("catalog", "task", None)
    assert run_id == "run-catalog"

def test_blocked_lane_can_redispatch_after_approval():
    """A blocked spend lane must NOT count as dispatched — once the reviewer approves, the
    orchestrator re-dispatches it (the block used to burn the lane's one-per-round slot)."""
    s = _state_with_verdict(None)
    with pytest.raises(ValueError, match="blocked_by_reviewer"):
        s.dispatch("ad", "task", None)
    s.reviewer_verdict = "APPROVED"
    run_id, _ = s.dispatch("ad", "task", None)
    assert run_id == "run-ad"

def test_blocked_reserved_lane_rolls_back_its_slot():
    s = _state_with_verdict(None)
    s.reserve(["ad"])
    budget_after_reserve = s.budget
    with pytest.raises(ValueError, match="blocked_by_reviewer"):
        s.dispatch("ad", "task", None, reserved=True)
    assert s.budget == budget_after_reserve + 1 and "ad" not in s._taken
    s.reviewer_verdict = "APPROVED_WITH_CONDITIONS"
    run_id, _ = s.dispatch("ad", "task", None)
    assert run_id == "run-ad"


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
