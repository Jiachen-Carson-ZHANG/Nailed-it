"""Ad Sandbox engine tests (ADR-0016) — the sandbox is more surface to keep honest, so its math is
pinned here: fatigue forces real trade-offs, hidden state produces the reproducible divergence the
demo depends on, and the state machine refuses illegal transitions."""
import pytest

from nailed_agents import sandbox


STYLE = dict(style_cvr=0.09, service_minutes=70, contribution_profit_cents=6800)


def _fc(audience: str, budget: int, days: int = 4):
    return sandbox.forecast(audience=audience, total_budget_cents=budget, duration_days=days, **STYLE)


def test_forecast_returns_ranges_not_point_estimates():
    fc = _fc("try_on_no_booking", 9000)
    for key in ("expected_impressions", "expected_clicks", "expected_bookings",
                "expected_cost_per_booking_cents", "expected_booked_minutes"):
        lo, hi = fc[key]
        assert lo < hi, key  # a range, never a magic number
    assert fc["expected_bookings"][0] >= 2  # high-intent retargeting is genuinely viable


def test_fatigue_makes_budget_escalation_lose():
    """The core trade-off: on a 450-person audience, tripling the budget must WORSEN expected CPA —
    otherwise the ad agent's only move is 'raise budget' and the loop is theater."""
    small = _fc("try_on_no_booking", 3300)
    big = _fc("try_on_no_booking", 30000)
    assert big["saturation"] == "high" and small["saturation"] != "high"
    assert big["expected_cost_per_booking_cents"][0] > small["expected_cost_per_booking_cents"][0]
    assert any("饱和" in w for w in big["warnings"])


def test_forecast_warns_when_bookings_unreachable():
    fc = _fc("broad_local_interest", 2000)  # tiny budget on a low-intent pool
    assert fc["expected_bookings"][1] < 2
    assert any("无法" in w or "不足 1 个预约" in w for w in fc["warnings"])


def test_delivery_applies_hidden_state_forecast_never_sees():
    """Finals Scenario A: broad traffic forecasts okay but converts to ~zero (quality 0.55 ×
    friction 1.4) while retargeting over-delivers (1.35). Same seed → same story, every run."""
    common = dict(daily_budget_cents=1500, total_budget_cents=6000, spent_cents=0,
                  style_cvr=STYLE["style_cvr"], hours=72, clock_hours=0, scenario="finals-a")
    broad = sandbox.deliver(campaign_id="cam-broad", audience="broad_local_interest", **common)
    retgt = sandbox.deliver(campaign_id="cam-retgt", audience="try_on_no_booking", **common)
    assert broad["clicks"] >= 30          # delivery succeeded — clicks arrived
    assert broad["bookings"] == 0          # …and converted to NOTHING (the on-stage 打脸)
    assert retgt["bookings"] >= 2          # retargeting genuinely works in the same market
    # determinism: identical seed and clock reproduce identical numbers
    assert broad == sandbox.deliver(campaign_id="cam-broad", audience="broad_local_interest", **common)


def test_delivery_respects_budget_caps():
    d = sandbox.deliver(campaign_id="c", audience="saved_or_viewed", daily_budget_cents=2000,
                        total_budget_cents=3000, spent_cents=2500, style_cvr=0.09,
                        hours=72, clock_hours=0)
    assert d["spend_cents"] <= 500  # total-budget cap beats the daily drip
    empty = sandbox.deliver(campaign_id="c", audience="saved_or_viewed", daily_budget_cents=2000,
                            total_budget_cents=3000, spent_cents=3000, style_cvr=0.09,
                            hours=24, clock_hours=72)
    assert empty == {"impressions": 0, "clicks": 0, "bookings": 0, "spend_cents": 0}


def test_campaign_state_machine():
    assert sandbox.can_transition("draft", "active")
    assert sandbox.can_transition("active", "paused")
    assert sandbox.can_transition("paused", "active")
    assert not sandbox.can_transition("ended", "active")     # no resurrection
    assert not sandbox.can_transition("draft", "paused")     # can't pause what never ran
    with pytest.raises(ValueError, match="audience_unknown"):
        sandbox.forecast(audience="everyone", total_budget_cents=1000, duration_days=3, **STYLE)
