"""Entry points.

  python -m nailed_agents                       # run one round of the team
  python -m nailed_agents advance-clock 72      # advance the business clock (ADR-0016 sandbox):
                                                # runs the delivery simulator for every ACTIVE
                                                # campaign and accumulates actual metrics
  python -m nailed_agents set-scenario finals-a # pick the hidden-market scenario seed

The clock is DEMO infrastructure, deliberately not an agent tool — agents live inside business time;
only the operator (or the UI's "advance clock" button) moves it.
"""
import sys

from . import bus, config, sandbox
from .orchestrator import run_round


def advance_clock(hours: int) -> None:
    config.require_env()
    sb = bus.supabase()
    state = bus.fetch_sim_state(sb, config.MERCHANT_ID) or {"clock_hours": 0, "scenario_seed": "default"}
    clock = int(state.get("clock_hours") or 0)
    scenario = str(state.get("scenario_seed") or "default")

    campaigns = bus.fetch_campaign_outcomes(sb, config.MERCHANT_ID)
    delivered = 0
    for c in campaigns:
        if c.get("status") != "active" or not c.get("audience"):
            continue  # drafts/paused don't spend; legacy slot-based campaigns aren't simulated
        total = c.get("total_budget_cents") or (c.get("daily_budget_cents") or 0) * (c.get("duration_days") or 4)
        # style CVR from the business engine facts (same source the forecast used)
        facts = None
        try:
            brain = bus.fetch_decisions() or {}
            facts = next((d for d in brain.get("decisions", []) if d.get("styleId") == c.get("merchant_style_id")), None)
        except Exception:
            pass
        style_cvr = ((facts or {}).get("ad") or {}).get("clickToBookingRate") or 0.03
        deltas = sandbox.deliver(
            campaign_id=str(c["id"]), audience=str(c["audience"]),
            daily_budget_cents=int(c.get("daily_budget_cents") or 0),
            total_budget_cents=int(total), spent_cents=int(c.get("spend_cents") or 0),
            style_cvr=float(style_cvr), hours=hours, clock_hours=clock, scenario=scenario,
        )
        bus.apply_campaign_delivery(sb, str(c["id"]), config.MERCHANT_ID, deltas)
        delivered += 1
        print(f"  {c['id']}: +{deltas['impressions']} imp, +{deltas['clicks']} clicks, "
              f"+{deltas['bookings']} bookings, +{deltas['spend_cents']}分 spend")
    bus.set_sim_state(sb, config.MERCHANT_ID, clock_hours=clock + hours)
    print(f"clock: {clock}h → {clock + hours}h (scenario={scenario}, {delivered} active campaigns delivered)")

    # Settlement produces DATA; it does NOT reason. Report which triggers the settled numbers just
    # tripped — a threshold alarm here is the business event that should fire the NEXT round (where
    # the monitor actually reasons). Deciding to run is the operator's / cron's, not settlement's.
    from . import triggers
    signals = triggers.evaluate_triggers(sb, config.MERCHANT_ID)
    if signals:
        print("triggers now active (a round would react to these):")
        for s in signals:
            print(f"  [{s.urgency}] {s.kind}: {s.reason}")
    else:
        print("no triggers active — nothing warrants a round yet")


def check_triggers(run: bool = False) -> None:
    """Evaluate the three business triggers against current state (the watch-cron entry point).
    With --run, fire a round when any URGENT signal is present. Without a persistent daemon, this is
    invoked periodically by cron or manually — the trigger LOGIC is real and tested; only the
    'continuously watching' deployment is cron-driven rather than a live daemon."""
    from . import triggers
    config.require_env()
    sb = bus.supabase()
    signals = triggers.evaluate_triggers(sb, config.MERCHANT_ID)
    if not signals:
        print("no triggers active")
        return
    # P0 cross-round cooldown: drop signals whose (kind:entity) fingerprint already fired a round within
    # TRIGGER_COOLDOWN_MINUTES. Stops a threshold_alarm that stays red (or evidence that stays mature)
    # from re-firing every cron tick. cadence has no entity → its fingerprint is global. The round row
    # itself carries the fingerprint (blackboard.triggerFingerprint), so no separate store is needed.
    cooling = {
        s.entity_id or s.kind: bus.trigger_fired_recently(
            sb, config.MERCHANT_ID, bus.trigger_fingerprint(s.kind, s.entity_id),
            config.TRIGGER_COOLDOWN_MINUTES)
        for s in signals
    }
    fresh = [s for s in signals if not cooling[s.entity_id or s.kind]]
    for s in signals:
        cool = cooling[s.entity_id or s.kind]
        print(f"[{s.urgency}] {s.kind}: {s.reason}" + (" (cooldown — skip)" if cool else ""))
    if not fresh:
        print("→ all active triggers are within cooldown — no round (idempotent)")
        return
    urgent = [s for s in fresh if s.urgency == "urgent"]
    to_fire = urgent[0] if urgent else fresh[0]
    if run:
        # P0: don't stack a round on top of one already in flight (run_round re-checks at the entry).
        if bus.has_active_round(sb, config.MERCHANT_ID):
            print("→ a round is already in flight — skipping (one round per merchant)")
            return
        extra = f"（另有 {len(urgent) - 1} 个并发信号）" if urgent and len(urgent) > 1 else ""
        label = "urgent" if urgent else "routine"
        print(f"→ {label} signal — firing a round ({to_fire.kind})")
        run_round(trigger_kind=to_fire.kind, trigger_reason=f"{to_fire.reason}{extra}",
                  trigger_entity=to_fire.entity_id)
    elif urgent:
        print(f"→ {len(urgent)} urgent signal(s); pass --run to fire a round")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["advance-clock"]:
        advance_clock(int(args[1]) if len(args) > 1 else 24)
    elif args[:1] == ["check-triggers"]:
        check_triggers(run="--run" in args)
    elif args[:1] == ["set-scenario"]:
        config.require_env()
        seed = args[1] if len(args) > 1 else "default"
        if seed not in sandbox.SCENARIOS:
            raise SystemExit(f"unknown scenario '{seed}' — available: {', '.join(sandbox.SCENARIOS)}")
        sb = bus.supabase()
        state = bus.fetch_sim_state(sb, config.MERCHANT_ID) or {"clock_hours": 0}
        bus.set_sim_state(sb, config.MERCHANT_ID, clock_hours=int(state.get("clock_hours") or 0), scenario_seed=seed)
        print(f"scenario set: {seed}")
    else:
        run_round()
