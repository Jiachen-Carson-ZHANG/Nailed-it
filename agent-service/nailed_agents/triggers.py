"""Business-event triggers — the three ways a round can be born (ADR-0016 trigger layer).

A trigger answers one question from business state: *should a round fire now, and why?* The answer is
a pure function; the WHEN-to-ask is cron-invoked (a lightweight watch cron), settlement-invoked (after
advance-clock), or manual. There is deliberately NO persistent daemon and NO worker queue — those solve
concurrent multi-worker claiming (lease/heartbeat/stale-recovery), which does not exist at single-
merchant demo scale (ADR-0007/0013). Evaluating a threshold and deciding to run one round needs none of
that machinery.

Three trigger kinds:
  1. cadence          — the weekly baseline (run-weekly-round.sh + a crontab line).
  2. evidence_matured — an action's observation window filled with data → eligible to be judged.
  3. threshold_alarm  — a live campaign crossed a bad line (budget burning, zero conversion) → don't
                        wait for Friday. Thresholds are MERCHANT-owned data; the check is runtime code.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import bus, config


@dataclass(frozen=True)
class TriggerSignal:
    kind: str      # cadence | evidence_matured | threshold_alarm
    reason: str    # human sentence, cites the numbers
    urgency: str   # routine | urgent
    entity_id: str | None = None


# Merchant-owned alarm thresholds (would live in merchant_policy in the multi-merchant product; the
# defaults here are the demo's). The VALUES are data; evaluate_threshold_alarm is the runtime code.
@dataclass
class AlarmThresholds:
    spend_floor_cents: int = 5000        # ignore noise below ¥50 spent
    zero_conversion_clicks: int = 50     # clicks ≥ this with 0 bookings = conversion failure
    cac_multiple: float = 2.0            # measured CAC > this × the hypothesis low bound = economic alarm


def evaluate_threshold_alarm(
    campaigns: list[dict[str, Any]],
    thresholds: AlarmThresholds | None = None,
) -> list[TriggerSignal]:
    """A live campaign burning budget with no conversion, or blowing past its forecast CAC, should
    trigger a round immediately rather than waiting for the weekly cadence. Pure over fetched rows."""
    t = thresholds or AlarmThresholds()
    signals: list[TriggerSignal] = []
    for c in campaigns:
        if c.get("status") != "active":
            continue
        spend = int(c.get("spend_cents") or 0)
        if spend < t.spend_floor_cents:
            continue  # too little data to alarm on
        clicks = int(c.get("clicks") or 0)
        bookings = int(c.get("bookings") or 0)
        cid = str(c.get("id"))
        if clicks >= t.zero_conversion_clicks and bookings == 0:
            signals.append(TriggerSignal(
                "threshold_alarm",
                f"{cid}：{clicks} 次点击、0 预约、已花 ¥{spend / 100:g} — 转化失败，应立即复盘而非等周期",
                "urgent", cid,
            ))
            continue
        # economic alarm: measured CAC far above the launch hypothesis low bound (payload.hypothesis)
        if bookings > 0:
            measured_cac = spend / bookings
            lo = _hypothesis_cac_low(c)
            if lo is not None and measured_cac > lo * t.cac_multiple:
                signals.append(TriggerSignal(
                    "threshold_alarm",
                    f"{cid}：实测获客成本 ¥{measured_cac / 100:g}，超预测下限 ¥{lo / 100:g} 的 {t.cac_multiple:g} 倍 — 经济告警",
                    "urgent", cid,
                ))
    return signals


def _hypothesis_cac_low(campaign: dict[str, Any]) -> float | None:
    """The launch forecast's CAC low bound, if the campaign carries a hypothesis snapshot. The snapshot
    lives on the place_ad action payload, not the campaign row, so callers that want the CAC alarm pass
    it through `hypothesis_cac_low_cents`; absent → None (the zero-conversion alarm still fires)."""
    h = campaign.get("hypothesis_cac_low_cents")
    return float(h) if isinstance(h, (int, float)) and h > 0 else None


def evaluate_evidence_matured(due_actions: list[dict[str, Any]]) -> list[TriggerSignal]:
    """Any past action whose campaign now has data is eligible for the monitor to judge. Pull-based:
    this is what a round PICKS UP (the due-review list), surfaced here as a first-class trigger so the
    watcher can decide to run a round when work has matured rather than only on the weekly cadence."""
    if not due_actions:
        return []
    n = len(due_actions)
    return [TriggerSignal(
        "evidence_matured",
        f"{n} 个历史动作观测窗已积累数据，可供监测复盘",
        "routine",
    )]


def evaluate_cadence(hours_since_last_round: float | None, cadence_days: int = 7) -> list[TriggerSignal]:
    """The weekly baseline. None (never run) or ≥ the cadence window → due."""
    if hours_since_last_round is None or hours_since_last_round >= cadence_days * 24:
        return [TriggerSignal("cadence", f"距上一轮已达 {cadence_days} 天周期，应运行周度经营计划", "routine")]
    return []


def evaluate_triggers(sb, merchant_id: str, *, thresholds: AlarmThresholds | None = None) -> list[TriggerSignal]:
    """Fetch business state and evaluate all three trigger kinds. The watcher/cron calls this; a
    non-empty urgent signal means 'fire a round now'."""
    campaigns = bus.fetch_campaign_outcomes(sb, merchant_id)
    due = bus.fetch_due_actions(sb, merchant_id)
    signals: list[TriggerSignal] = []
    signals += evaluate_threshold_alarm(campaigns, thresholds)
    signals += evaluate_evidence_matured(due)
    # cadence needs the last round time; degrade quietly if the round table is pre-migration
    try:
        rounds = (
            sb.table("agent_rounds").select("started_at")
            .eq("merchant_id", merchant_id).order("started_at", desc=True).limit(1).execute()
        )
        last = (rounds.data or [{}])[0].get("started_at")
        if last:
            from datetime import datetime, timezone
            delta_h = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() / 3600
            signals += evaluate_cadence(delta_h)
        else:
            signals += evaluate_cadence(None)
    except Exception:  # noqa: BLE001 — cadence is best-effort telemetry, never blocks the alarm path
        pass
    return signals
