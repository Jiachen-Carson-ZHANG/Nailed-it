"""Trigger-layer tests (ADR-0016): the three business events that can birth a round. Pure functions
over already-fetched rows — the whole point is that trigger LOGIC is testable without a daemon."""
from nailed_agents import triggers
from nailed_agents.triggers import AlarmThresholds


def _camp(**kw):
    base = {"id": "ad-x", "status": "active", "spend_cents": 6000, "clicks": 0, "bookings": 0}
    base.update(kw)
    return base


def test_zero_conversion_fires_urgent_alarm():
    """A live campaign with clicks but no bookings, past the spend floor, is the demo's 打脸 — it
    must trigger a round immediately, not wait for the weekly cadence."""
    sig = triggers.evaluate_threshold_alarm([_camp(clicks=52, bookings=0, spend_cents=5800)])
    assert len(sig) == 1
    assert sig[0].kind == "threshold_alarm" and sig[0].urgency == "urgent"
    assert sig[0].entity_id == "ad-x" and "0 预约" in sig[0].reason


def test_no_alarm_below_spend_floor_or_when_converting():
    # too little spent to judge → no noise
    assert triggers.evaluate_threshold_alarm([_camp(clicks=60, bookings=0, spend_cents=1000)]) == []
    # healthy conversion, no hypothesis → no alarm
    assert triggers.evaluate_threshold_alarm([_camp(clicks=60, bookings=5, spend_cents=8000)]) == []
    # draft/paused never alarm (only active campaigns spend)
    assert triggers.evaluate_threshold_alarm([_camp(status="draft", clicks=99, bookings=0)]) == []


def test_cac_multiple_alarm_uses_hypothesis():
    """Economic alarm: measured CAC far above the launch forecast's low bound (carried through as
    hypothesis_cac_low_cents) fires even when bookings are non-zero."""
    c = _camp(clicks=40, bookings=2, spend_cents=8000, hypothesis_cac_low_cents=1000)  # measured 4000 > 2×1000
    sig = triggers.evaluate_threshold_alarm([c], AlarmThresholds(cac_multiple=2.0))
    assert len(sig) == 1 and "经济告警" in sig[0].reason
    # within tolerance → silent
    c2 = _camp(clicks=40, bookings=5, spend_cents=8000, hypothesis_cac_low_cents=1000)  # measured 1600 < 2×1000
    assert triggers.evaluate_threshold_alarm([c2], AlarmThresholds(cac_multiple=2.0)) == []


def test_evidence_matured_is_routine():
    assert triggers.evaluate_evidence_matured([]) == []
    sig = triggers.evaluate_evidence_matured([{"id": "a1"}, {"id": "a2"}])
    assert len(sig) == 1 and sig[0].kind == "evidence_matured" and sig[0].urgency == "routine"
    assert "2 个" in sig[0].reason


def test_cadence_due_when_never_run_or_past_window():
    assert triggers.evaluate_cadence(None)[0].kind == "cadence"      # never run → due
    assert triggers.evaluate_cadence(24 * 7)[0].kind == "cadence"    # exactly at window → due
    assert triggers.evaluate_cadence(24 * 3) == []                   # mid-week → not due
