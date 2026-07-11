"""Ad Sandbox — the Merchant Operations Simulation Environment (ADR-0016 §3).

PURE deterministic engine: no DB, no network. Tools assemble inputs (style facts from the briefing,
campaign rows from Supabase) and persist outputs; this module only does the math, so every formula
is unit-testable and every demo seed reproduces exactly.

Two strictly separated halves:
  forecast()  — what the platform would PROMISE pre-launch: historical priors only, returns RANGES
                + saturation + warnings. Never sees hidden state.
  deliver()   — what the market ACTUALLY does as the business clock advances: applies the scenario's
                hidden parameters (delivery_factor / audience_quality / booking_friction). Agents
                never see these; the monitor sees only their consequences.

The gap between the two halves is the whole point: it gives the monitor something real to diagnose
(delivery vs engagement vs conversion failure) and makes "just raise the budget" measurably wrong
(frequency fatigue degrades CPA past ~2 impressions/user).
"""
from __future__ import annotations

import hashlib
from typing import Any

# ── audiences (code constants — audience implies funnel stage; ADR-0016 kills the slot arg) ──────

AUDIENCES: dict[str, dict[str, Any]] = {
    "broad_local_interest": {
        "size": 5000, "intent": "low", "funnel": "top_funnel",
        "base_ctr": 0.018, "intent_factor": 0.35, "base_cpc_cents": 85,
        "description": "本地泛美甲兴趣用户 — 覆盖大、意向浅，适合造势不适合催单",
    },
    "saved_or_viewed": {
        "size": 1200, "intent": "medium", "funnel": "mid_funnel",
        "base_ctr": 0.032, "intent_factor": 0.80, "base_cpc_cents": 95,
        "description": "近 30 天收藏或浏览过详情的用户",
    },
    "try_on_no_booking": {
        "size": 450, "intent": "high", "funnel": "lower_funnel",
        "base_ctr": 0.045, "intent_factor": 1.60, "base_cpc_cents": 110,
        "description": "近 14 天试戴/询价但未预约的用户 — 量小、意向强",
    },
}

# ── hidden scenario state (agents NEVER see this; same seed → same market) ───────────────────────

SCENARIOS: dict[str, dict[str, Any]] = {
    # Finals Scenario A: broad traffic looks fine in forecast but converts terribly (quality 0.55 ×
    # friction 1.4) while retargeting over-performs — the reproducible on-stage 打脸.
    "finals-a": {
        "competition": 1.15,
        "delivery_factor": 0.95,
        "audience_quality": {"broad_local_interest": 0.55, "saved_or_viewed": 1.00, "try_on_no_booking": 1.35},
        "booking_friction": 1.40,
    },
    # Neutral market: actuals land inside forecast ranges — for rehearsals and regression runs.
    "default": {
        "competition": 1.0,
        "delivery_factor": 1.0,
        "audience_quality": {"broad_local_interest": 1.0, "saved_or_viewed": 1.0, "try_on_no_booking": 1.0},
        "booking_friction": 1.0,
    },
}

_RANGE = 0.20  # forecast uncertainty band (±20%) — ranges, never magic point estimates


def _fatigue(impressions: float, audience_size: int) -> float:
    """Frequency fatigue: past ~2 impressions/user, extra spend buys repeat eyeballs, not intent.
    This is what forces a real budget trade-off instead of monotonic escalation."""
    freq = impressions / max(audience_size, 1)
    if freq <= 2.0:
        return 1.0
    if freq <= 3.0:
        return 0.85
    return 0.65


def _band(x: float) -> list[int]:
    return [max(0, round(x * (1 - _RANGE))), max(0, round(x * (1 + _RANGE)))]


def forecast(
    *,
    audience: str,
    total_budget_cents: int,
    duration_days: int,
    style_cvr: float,          # the style's historical click→booking rate (from the briefing)
    service_minutes: int,
    contribution_profit_cents: int,  # per-booking contribution profit (price − variable costs)
    competition: float = 1.0,        # PUBLIC prior (market season), not the hidden multiplier
) -> dict[str, Any]:
    """Pre-launch promise, from observable priors only. Returns ranges + saturation + warnings."""
    if audience not in AUDIENCES:
        raise ValueError("audience_unknown")
    a = AUDIENCES[audience]
    cpc = a["base_cpc_cents"] * competition
    clicks = total_budget_cents / cpc
    impressions = clicks / a["base_ctr"]
    fat = _fatigue(impressions, a["size"])
    cvr = style_cvr * a["intent_factor"] * fat
    bookings = clicks * cvr
    spend = float(total_budget_cents)
    cpa = spend / bookings if bookings > 0.05 else None
    profit = bookings * contribution_profit_cents - spend

    freq = impressions / a["size"]
    saturation = "low" if freq <= 1.5 else "medium" if freq <= 2.5 else "high"
    warnings: list[str] = []
    if saturation == "high":
        warnings.append("受众已饱和：继续加预算主要买到重复曝光，CPA 会变差。")
    if bookings < 1.0:
        warnings.append("该配置预计不足 1 个预约——目标大概率无法通过此方案达成。")
    if duration_days < 2:
        warnings.append("投放期过短，实测样本可能不足以判断效果。")

    return {
        "audience": audience,
        "expected_impressions": _band(impressions),
        "expected_clicks": _band(clicks),
        "expected_bookings": [round(bookings * (1 - _RANGE), 1), round(bookings * (1 + _RANGE), 1)],
        "expected_cost_per_booking_cents": None if cpa is None else _band(cpa),
        "expected_booked_minutes": _band(bookings * service_minutes),
        "expected_incremental_profit_cents": [round(profit * (1 + _RANGE) if profit < 0 else profit * (1 - _RANGE)),
                                              round(profit * (1 - _RANGE) if profit < 0 else profit * (1 + _RANGE))],
        "saturation": saturation,
        "confidence": 0.72 if saturation != "high" else 0.55,
        "warnings": warnings,
    }


def _jitter(campaign_id: str, clock_hours: int, lo: float = 0.9, hi: float = 1.1) -> float:
    """Deterministic per-(campaign, clock) noise — same seed replays identically."""
    h = int(hashlib.sha256(f"{campaign_id}:{clock_hours}".encode()).hexdigest()[:8], 16)
    return lo + (h % 1000) / 1000 * (hi - lo)


def deliver(
    *,
    campaign_id: str,
    audience: str,
    daily_budget_cents: int,
    total_budget_cents: int,
    spent_cents: int,          # already-delivered spend (cumulative)
    style_cvr: float,
    hours: int,                # how many hours the clock advances
    clock_hours: int,          # clock position BEFORE this advance (for deterministic jitter)
    scenario: str = "default",
) -> dict[str, int]:
    """What the hidden market actually does over `hours`. Returns metric DELTAS to accumulate onto
    the campaign row. Spend is capped by both the daily drip and the remaining total budget."""
    if audience not in AUDIENCES:
        raise ValueError("audience_unknown")
    a = AUDIENCES[audience]
    hidden = SCENARIOS.get(scenario, SCENARIOS["default"])

    budget_left = max(0, total_budget_cents - spent_cents)
    spend = min(daily_budget_cents * hours / 24.0, float(budget_left))
    if spend <= 0:
        return {"impressions": 0, "clicks": 0, "bookings": 0, "spend_cents": 0}

    cpc = a["base_cpc_cents"] * hidden["competition"]
    clicks = spend / cpc * _jitter(campaign_id, clock_hours)
    impressions = clicks / a["base_ctr"] * hidden["delivery_factor"]
    fat = _fatigue(impressions, a["size"])
    quality = hidden["audience_quality"].get(audience, 1.0)
    cvr = style_cvr * a["intent_factor"] * fat * quality / hidden["booking_friction"]
    bookings = clicks * cvr * _jitter(campaign_id, clock_hours + 1)

    return {
        "impressions": round(impressions),
        "clicks": round(clicks),
        "bookings": int(bookings),  # floor — a 0.8 expected booking is measured as zero, honestly
        "spend_cents": round(spend),
    }


# ── campaign state machine (ADR-0016 §3) ─────────────────────────────────────────────────────────

CAMPAIGN_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"active", "ended"},            # merchant launches, or declines
    "active": {"paused", "ended"},
    "paused": {"active", "ended"},
    "ended": set(),
}


def can_transition(current: str, target: str) -> bool:
    return target in CAMPAIGN_TRANSITIONS.get(current, set())
