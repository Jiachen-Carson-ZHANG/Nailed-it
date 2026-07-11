"""The agents' tools — ONE plain-Python source of truth, exposed to BOTH model backends.

Each tool body does its I/O (fetch a grounded read, or write an agent_action side-effect), records its
own step into the current run's transcript, and returns a short result string. Tools read the active
RunContext from a contextvar set by the runner before the loop.

The same plain functions are surfaced two ways (see the registries at the bottom):
  - BETA_TOOLS  — wrapped with anthropic.beta_tool for the `tool_runner` loop (Anthropic backend).
  - OPENAI_TOOLS — JSON function-schemas auto-derived from the same functions (OpenRouter backend).
  - IMPL        — the plain callables both loops invoke to actually run a tool.
No per-backend duplication of logic — only the schema representation differs."""
from __future__ import annotations

import inspect
import json
import re
import typing
from datetime import datetime, timedelta, timezone
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, Callable

from anthropic import beta_tool

from . import bus, config, sandbox, trend_logic, trends_source

__all__ = [
    "RunContext",
    "use_context",
    "reset_context",
    "IMPL",
    "BETA_TOOLS",
    "OPENAI_TOOLS",
]


@dataclass
class RunContext:
    """Per-run state the tools mutate: the Supabase client, the run id (so action tools can write
    agent_actions), the merchant, and the accumulating thinking-chain transcript. `awaiting_approval`
    is set by a gated tool (propose_listing) so the orchestrator finalizes that run as
    awaiting_approval instead of completed (ADR-0007 §4 — the one human gate)."""
    sb: Any
    run_id: str
    merchant_id: str
    range_days: int = 7
    # ADR-0015: which agent this run is — memory tools scope search domains and write permission by it.
    agent_slug: str = ""
    transcript: list[dict[str, Any]] = field(default_factory=list)
    awaiting_approval: bool = False
    # ADR-0013 P0 proposal hygiene: first propose_listing of the run supersedes older rounds' pending
    # proposals; `proposed_tags` dedupes within the run; the cap lives in config.MAX_PENDING_PROPOSALS.
    proposals_reset: bool = False
    proposed_tags: set[str] = field(default_factory=set)
    # ADR-0013 P1: set ONLY on the orchestrator's context — the RoundState the dispatch tools drive.
    # None for every lane agent, so a hallucinated dispatch from a non-orchestrator run is refused.
    round: Any = None
    # ADR-0013 P2: the agent_rounds row this run belongs to (None = 0030 unapplied / eval).
    round_id: str | None = None
    # ADR-0013 P3: set ONLY on the monitor's context — the bounded revision port. None everywhere else,
    # so no other lane can trigger a revision.
    revision: Any = None
    # ADR-0016 §2: set ONLY on the decision agent's context — a callable that files an Action Brief
    # onto the round. None everywhere else, so no other lane can author briefs.
    brief_sink: Any = None
    # ADR-0016 §2: the briefs governing THIS executor run (ad/coupon lanes) — place_ad/update enforce
    # their ceilings as hard law; empty for non-executor lanes and revision re-runs predating briefs.
    briefs: list[dict[str, Any]] = field(default_factory=list)
    # every tool invocation ATTEMPTED (name + args + ok/error), recorded by the runner around execution
    # — so invalid-arg attempts are visible to the eval even though tool bodies only append to
    # `transcript` after validation passes. This is what the tool-call-correctness gate reads (audit).
    tool_attempts: list[dict[str, Any]] = field(default_factory=list)


_current: ContextVar[RunContext] = ContextVar("nailed_agent_run")


def use_context(ctx: RunContext) -> Token:
    return _current.set(ctx)


def reset_context(token: Token) -> None:
    _current.reset(token)


def _ctx() -> RunContext:
    return _current.get()


_STYLE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
_MAX_AD_BUDGET_CENTS = 200_000
_MAX_COUPON_PRICE_CENTS = 100_000
_MAX_TEXT_CHARS = 280
_MAX_TAG_CHARS = 40


def _clean_text(value: str, *, field: str, max_chars: int = _MAX_TEXT_CHARS) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field}_invalid")
    cleaned = " ".join(value.strip().split())
    if not cleaned:
        raise ValueError(f"{field}_required")
    if len(cleaned) > max_chars:
        raise ValueError(f"{field}_too_long")
    return cleaned


def _clean_style_id(value: str, *, required: bool = True) -> str:
    if not isinstance(value, str):
        raise ValueError("style_id_invalid")
    cleaned = value.strip()
    if not cleaned:
        if required:
            raise ValueError("style_id_required")
        return ""
    if not _STYLE_ID_RE.fullmatch(cleaned):
        raise ValueError("style_id_invalid")
    return cleaned


def _bounded_int(value: int, *, field: str, maximum: int) -> int:
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # JSON has no int type — Gemini's function-calling emits 7.0 for 7
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field}_invalid")
    if value <= 0:
        raise ValueError(f"{field}_must_be_positive")
    if value > maximum:
        raise ValueError(f"{field}_too_large")
    return value


# ── tool bodies (plain functions — type hints + docstrings drive BOTH schemas) ──────────────────

def get_merchant_insights(range_days: int = 7) -> str:
    """Return the merchant's grounded demand insights (snapshot, demand trends, catalog gaps, and
    design performance including high-interest/low-conversion styles). These numbers are pre-computed
    by the intelligence layer — use them as-is, never invent metrics. range_days: 1 (today) or 7 (this
    week)."""
    ctx = _ctx()
    insights = bus.fetch_briefing(range_days).get("insights", {})
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_merchant_insights",
         "input": {"rangeDays": range_days}, "output": insights}
    )
    return json.dumps(insights, ensure_ascii=False)


def get_customer_intelligence() -> str:
    """Return the merchant's grounded customer roster (most-lapsed first): name, personaNote,
    bookingCount, lastVisitDaysAgo, lastStyleTitle. Pre-computed from booking history — use it to
    pick a re-engagement target, never invent customer signals."""
    ctx = _ctx()
    customers = bus.fetch_customers().get("customers", [])
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_customer_intelligence", "input": {}, "output": customers}
    )
    return json.dumps(customers, ensure_ascii=False)


def get_external_trends(trend_type: str = "growing") -> str:
    """Return external/platform nail trends (each: label + tags; live Pinterest rows also carry growth %
    — wow/mom/yoy — and a momentum-derived strength). Source is fixture (CN-flavored) or live Pinterest
    per TREND_SOURCE. trend_type picks the Pinterest window: 'growing' (fastest risers now), 'monthly',
    'seasonal' (current-season/holiday spikes — good for salons), 'yearly'. Ignored for the fixture
    source. Use to spot what's trending to match against the catalog — never invent trends."""
    ctx = _ctx()
    trends = trends_source.get_external_trends(trend_type)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_external_trends", "input": {"trendType": trend_type}, "output": trends}
    )
    return json.dumps(trends, ensure_ascii=False)


def get_platform_hot() -> str:
    """Return 平台热门: cross-merchant tag popularity (merchantCount + styleCount) over every published
    style on the platform. Use to spot tags the platform is hot on that this shop under-stocks."""
    ctx = _ctx()
    styles = bus.fetch_styles().get("styles", [])
    hot = trend_logic.platform_hot(styles)
    ctx.transcript.append({"kind": "tool_call", "tool": "get_platform_hot", "input": {}, "output": hot})
    return json.dumps(hot, ensure_ascii=False)


def _trend_report(range_days: int, trend_type: str) -> dict:
    """Shared 选品 report builder — external + internal trends matched to THIS merchant's catalog and
    classified (amplify/price_test/gap) + a prune list. Applies MATCH_MODE (concept matcher or tag
    fallback) and attaches matchMeta. BOTH get_trend_opportunities and get_catalog_actions call this, so
    their prune/gap decisions can never diverge in concept mode (audit)."""
    ctx = _ctx()
    insights = bus.fetch_briefing(range_days).get("insights", {})
    # Match against THIS merchant's own catalog only — a gap must be a gap in OUR catalog, not hidden by a
    # filler shop's supply. (platform_hot stays cross-merchant.)
    hero = [s for s in bus.fetch_styles().get("styles", []) if s.get("merchantId") == config.MERCHANT_ID]
    external = trends_source.get_external_trends(trend_type)
    match_fn = None
    if config.MATCH_MODE == "concept":  # VLM-concept embed+rerank; degrades to tag-overlap per-trend on error
        from . import matching
        match_fn = matching.make_match_fn(sb=ctx.sb, merchant_id=config.MERCHANT_ID)
    report = trend_logic.trend_opportunities(external, insights, hero, match_fn=match_fn)
    # match transparency (concept-powered vs actually tag-fallback)
    opps = report.get("opportunities", [])
    meta: dict[str, Any] = {
        "matchModeRequested": config.MATCH_MODE,
        "conceptScored": sum(1 for o in opps if o.get("matchSource") == "concept"),
        "tagFallback": sum(1 for o in opps if o.get("matchSource") == "tag"),
    }
    if match_fn is not None:
        loaded = getattr(match_fn, "concepts_loaded", 0)
        meta["conceptsLoaded"] = loaded
        fb = getattr(match_fn, "fallbacks", [])
        if loaded == 0:
            meta["fallbackReason"] = "no style_concept rows (not enriched) → tag-overlap"
        elif fb:
            meta["fallbackReasons"] = fb[:5]
    report["matchMeta"] = meta
    return report


def get_trend_opportunities(range_days: int = 7, trend_type: str = "growing") -> str:
    """Return ranked trend opportunities — external trends + internal-rising demand, matched to the
    catalog and classified (amplify / price_test / gap) + a prune list. The precise menu 决策 acts on.
    trend_type picks the external (Pinterest) window: 'growing' (default, fastest risers now), 'monthly',
    'seasonal' (current-season/holiday spikes), 'yearly'. Pre-computed from grounded reads; use as-is,
    never invent."""
    ctx = _ctx()
    report = _trend_report(range_days, trend_type)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_trend_opportunities",
         "input": {"rangeDays": range_days, "trendType": trend_type, "matchMeta": report["matchMeta"]},
         "output": report}
    )
    return json.dumps(report, ensure_ascii=False)


def _decision_hypothesis(style_id: str, *, lever: str) -> dict[str, Any] | None:
    """Snapshot the decision brain's prediction for this style AT EXECUTION TIME (ADR-0015). The
    monitor later compares measured outcomes against it — that difference (not the outcome alone) is
    what calibration memory stores. Code-derived from the brain's own output; never parsed out of a
    model's prose. Absence is fine — the action proceeds, it just can't be calibrated later."""
    try:
        brain = bus.fetch_decisions() or {}
    except Exception:
        return None  # brain route down / eval without decisions fixture — not this tool's failure
    hypo: dict[str, Any] = {}
    band = (brain.get("capacity") or {}).get("band")
    if band:
        hypo["capacityBand"] = band
    for d in brain.get("decisions", []):
        if d.get("styleId") == style_id:
            if lever == "ad":
                ad = d.get("ad") or {}
                hypo.update({k: ad[k] for k in ("expectedRoas", "exposureRatio", "costPerBookingCents")
                             if ad.get(k) is not None})
            elif lever == "coupon" and d.get("suggestedCouponCents") is not None:
                hypo["suggestedCouponCents"] = d["suggestedCouponCents"]
            break
    return hypo or None


# ── ad sandbox tools (ADR-0016 §3-4) — the 投广 agent's world ────────────────────────────────────

def _style_facts(style_id: str) -> dict[str, Any]:
    """Forecast inputs from the business engine's facts. Unknown CVR degrades to a conservative
    default with a warning downstream — wide uncertainty, never a refusal to think."""
    try:
        brain = bus.fetch_decisions() or {}
    except Exception:
        brain = {}
    for d in brain.get("decisions", []):
        if d.get("styleId") == style_id:
            ad = d.get("ad") or {}
            return {
                "style_cvr": ad.get("clickToBookingRate") or 0.03,
                "cvr_measured": ad.get("clickToBookingRate") is not None,
                "service_minutes": d.get("durationMin") or 60,
                "contribution_profit_cents": ad.get("expectedProfitPerBookingCents")
                    or round((d.get("priceCents") or 8800) * 0.79),
            }
    return {"style_cvr": 0.03, "cvr_measured": False, "service_minutes": 60,
            "contribution_profit_cents": 6900}


def _my_briefs(ctx: RunContext, action_type: str) -> list[dict]:
    return [b for b in (ctx.briefs or []) if b.get("action_type") == action_type]


def get_ad_account_state() -> str:
    """The merchant's ad account: remaining marketing budget, committed budget on live/draft
    campaigns, the auto-execute limit (campaigns whose DAILY budget exceeds it become drafts awaiting
    the merchant), and every existing campaign (avoid duplicating a style that already has one —
    modify it with update_ad_campaign instead)."""
    ctx = _ctx()
    campaigns = bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id)
    committed = sum(
        (c.get("total_budget_cents") or (c.get("daily_budget_cents") or 0) * (c.get("duration_days") or 4))
        for c in campaigns if c.get("status") in ("active", "draft")
    )
    state = {
        "marketing_budget_cents": config.MARKETING_BUDGET_CENTS,
        "committed_budget_cents": committed,
        "remaining_budget_cents": max(0, config.MARKETING_BUDGET_CENTS - committed),
        "auto_execute_daily_limit_cents": 5000,
        "campaigns": [
            {k: c.get(k) for k in ("id", "merchant_style_id", "status", "audience",
                                    "daily_budget_cents", "total_budget_cents", "version")}
            for c in campaigns
        ],
    }
    ctx.transcript.append({"kind": "tool_call", "tool": "get_ad_account_state", "input": {}, "output": state})
    return json.dumps(state, ensure_ascii=False)


def list_available_audiences() -> str:
    """The targetable audience segments: size, intent level, funnel stage, description. Small
    high-intent pools convert far better but saturate fast (frequency fatigue) — bigger budgets on a
    small pool buy repeat eyeballs, not more intent."""
    ctx = _ctx()
    out = [
        {"audience": aid, "size": a["size"], "intent": a["intent"], "funnel": a["funnel"],
         "description": a["description"]}
        for aid, a in sandbox.AUDIENCES.items()
    ]
    ctx.transcript.append({"kind": "tool_call", "tool": "list_available_audiences", "input": {}, "output": out})
    return json.dumps(out, ensure_ascii=False)


def forecast_ad_plan(style_id: str, audience: str, total_budget_cents: int, duration_days: int = 4) -> str:
    """Pre-launch forecast for ONE candidate plan — expected impressions/clicks/bookings/CPA/booked
    minutes as RANGES with saturation + warnings. Compare plans by re-calling with different
    audience/budget/duration; forecasts are estimates from historical priors, actual results can and
    do diverge. Do NOT optimise for impressions — bookings, CPA, profit, and capacity fit are the
    goals that matter."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    total_budget_cents = _bounded_int(total_budget_cents, field="total_budget_cents", maximum=_MAX_AD_BUDGET_CENTS)
    duration_days = _bounded_int(duration_days, field="duration_days", maximum=30)
    facts = _style_facts(style_id)
    fc = sandbox.forecast(
        audience=audience, total_budget_cents=total_budget_cents, duration_days=duration_days,
        style_cvr=facts["style_cvr"], service_minutes=facts["service_minutes"],
        contribution_profit_cents=facts["contribution_profit_cents"],
    )
    if not facts["cvr_measured"]:
        fc["confidence"] = min(fc["confidence"], 0.4)
        fc["warnings"].append("该款没有实测点击→预约样本，预测使用保守默认值——不确定性很高。")
    # brief guardrails surface as warnings at forecast time (hard refusal happens at place time)
    for b in _my_briefs(ctx, "ad"):
        if b.get("style_id") == style_id:
            if total_budget_cents > b["max_total_budget_cents"]:
                fc["warnings"].append("该预算超出行动简报的硬上限——place_ad 会拒绝。")
            cap = b.get("max_cost_per_booking_cents")
            if cap and fc["expected_cost_per_booking_cents"] and fc["expected_cost_per_booking_cents"][0] > cap:
                fc["warnings"].append("预计每单成本区间下限已超简报 CAC 上限——考虑换受众或降预算。")
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "forecast_ad_plan",
         "input": {"styleId": style_id, "audience": audience, "totalBudgetCents": total_budget_cents,
                    "durationDays": duration_days},
         "output": fc}
    )
    return json.dumps(fc, ensure_ascii=False)


def place_ad(style_id: str, audience: str, total_budget_cents: int, duration_days: int = 4) -> str:
    """Create the campaign for your CHOSEN plan (run forecast_ad_plan first — the winning plan's
    forecast is snapshotted as the hypothesis the monitor later measures against). Hard rules enforced
    here: the Action Brief's budget ceiling, audience validity, one campaign per style (use
    update_ad_campaign to modify an existing one). Daily budget = total/duration; within the
    merchant's auto-execute limit it launches as a withdrawable drip, above it it lands as a draft the
    merchant must launch. If no viable plan exists inside the brief, do NOT place — report the
    objective infeasible with the forecast evidence instead."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    if audience not in sandbox.AUDIENCES:
        raise ValueError("audience_unknown")
    total_budget_cents = _bounded_int(total_budget_cents, field="total_budget_cents", maximum=_MAX_AD_BUDGET_CENTS)
    duration_days = _bounded_int(duration_days, field="duration_days", maximum=30)

    # Action Brief = hard law for the executor (ADR-0016 §2): when briefs exist, the target style
    # must be briefed and the budget must sit inside its ceiling.
    briefs = _my_briefs(ctx, "ad")
    if briefs:
        mine = next((b for b in briefs if b.get("style_id") == style_id), None)
        if mine is None:
            raise ValueError("style_not_in_brief")
        if total_budget_cents > mine["max_total_budget_cents"]:
            raise ValueError("budget_exceeds_brief")

    daily_budget_cents = max(1, round(total_budget_cents / duration_days))
    result = bus.post_propose_ad(style_id, daily_budget_cents, ctx.run_id)
    if not result.get("ok"):
        raise ValueError(f"propose_ad_failed: {result.get('errors')}")
    entity_id, entity_status = result["id"], result["status"]  # 'active' | 'draft'
    action_status = "applied" if entity_status == "active" else "proposed"

    # persist sandbox config on the campaign (audience/total budget/version) — pre-0033 degrades
    try:
        bus.update_campaign(ctx.sb, entity_id, ctx.merchant_id,
                            {"audience": audience, "total_budget_cents": total_budget_cents,
                             "duration_days": duration_days})
    except Exception:
        print("WARN campaign sandbox columns missing — apply migration 0033_ad_sandbox.sql")

    facts = _style_facts(style_id)
    fc = sandbox.forecast(audience=audience, total_budget_cents=total_budget_cents,
                          duration_days=duration_days, style_cvr=facts["style_cvr"],
                          service_minutes=facts["service_minutes"],
                          contribution_profit_cents=facts["contribution_profit_cents"])
    payload = {
        "styleId": style_id, "audience": audience, "totalBudgetCents": total_budget_cents,
        "durationDays": duration_days, "dailyBudgetCents": daily_budget_cents,
        # the CHOSEN plan's forecast is the hypothesis — measured outcomes are judged against it
        "hypothesis": {
            "expectedBookings": fc["expected_bookings"],
            "expectedCostPerBookingCents": fc["expected_cost_per_booking_cents"],
            "expectedClicks": fc["expected_clicks"],
            "audience": audience,
        },
    }
    bus.write_action(
        ctx.sb, run_id=ctx.run_id, action_type="place_ad", payload=payload,
        status=action_status, entity_type="style_ad", entity_id=entity_id,
    )
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "place_ad", "input": payload,
         "output": {"entityId": entity_id, "campaignStatus": entity_status}}
    )
    launched = entity_status == "active"
    ctx.transcript.append(
        {"kind": "action", "actionType": "place_ad", "status": action_status,
         "summary": f"投广：{style_id} · {audience} · 总预算 {total_budget_cents / 100:g}（{duration_days} 天）"
                    + ("（已投放，可随时暂停）" if launched else "（超出自动投放上限，待商家启动）")}
    )
    verb = "launched" if launched else "left as a draft for the merchant to launch"
    return (f"Ad campaign {entity_id} for {style_id} ({audience}, {total_budget_cents} cents total / "
            f"{duration_days}d) {verb}.")


def update_ad_campaign(campaign_id: str, total_budget_cents: int = 0, audience: str = "",
                       duration_days: int = 0) -> str:
    """Modify the SAME campaign in place — budget, audience, and/or duration (a revision NEVER forks a
    parallel campaign; the version increments). Allowed on draft/active/paused campaigns. Use after a
    monitor revision (e.g. broad audience delivered clicks but zero bookings → switch to retargeting
    with a lower budget) or when your own forecast comparison says the current config is wrong."""
    ctx = _ctx()
    campaign_id = _clean_text(campaign_id, field="campaign_id", max_chars=140)
    campaigns = {c["id"]: c for c in bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id)}
    cur = campaigns.get(campaign_id)
    if cur is None:
        raise ValueError("campaign_not_found")
    if cur.get("status") == "ended":
        raise ValueError("campaign_ended")
    fields: dict[str, Any] = {}
    changes: list[str] = []
    if audience:
        if audience not in sandbox.AUDIENCES:
            raise ValueError("audience_unknown")
        fields["audience"] = audience
        changes.append(f"受众→{audience}")
    if total_budget_cents:
        total_budget_cents = _bounded_int(total_budget_cents, field="total_budget_cents",
                                          maximum=_MAX_AD_BUDGET_CENTS)
        for b in _my_briefs(ctx, "ad"):
            if b.get("style_id") == cur.get("merchant_style_id") and total_budget_cents > b["max_total_budget_cents"]:
                raise ValueError("budget_exceeds_brief")
        days = duration_days or cur.get("duration_days") or 4
        fields["total_budget_cents"] = total_budget_cents
        fields["daily_budget_cents"] = max(1, round(total_budget_cents / days))
        changes.append(f"总预算→{total_budget_cents / 100:g}")
    if duration_days:
        fields["duration_days"] = _bounded_int(duration_days, field="duration_days", maximum=30)
        changes.append(f"时长→{duration_days}天")
    if not fields:
        raise ValueError("nothing_to_update")
    fields["version"] = (cur.get("version") or 1) + 1
    bus.update_campaign(ctx.sb, campaign_id, ctx.merchant_id, fields)

    payload = {"campaignId": campaign_id, "changes": fields,
               "styleId": cur.get("merchant_style_id")}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="update_ad_campaign", payload=payload,
                     status="applied", entity_type="style_ad", entity_id=campaign_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "update_ad_campaign", "input": payload,
                           "output": {"version": fields["version"]}})
    ctx.transcript.append({"kind": "action", "actionType": "update_ad_campaign", "status": "applied",
                           "summary": f"修改广告 {campaign_id}（v{fields['version']}）：{'、'.join(changes)}"})
    return f"Campaign {campaign_id} updated in place (v{fields['version']}): {', '.join(changes)}."


def pause_ad_campaign(campaign_id: str) -> str:
    """Pause an ACTIVE campaign — the stop-loss when continuing to spend is unjustifiable (e.g. the
    stop conditions in the brief were hit). Paused campaigns keep their history and can be resumed by
    the merchant; pausing is always reversible."""
    ctx = _ctx()
    campaign_id = _clean_text(campaign_id, field="campaign_id", max_chars=140)
    campaigns = {c["id"]: c for c in bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id)}
    cur = campaigns.get(campaign_id)
    if cur is None:
        raise ValueError("campaign_not_found")
    if not sandbox.can_transition(str(cur.get("status")), "paused"):
        raise ValueError(f"cannot_pause_{cur.get('status')}")
    bus.update_campaign(ctx.sb, campaign_id, ctx.merchant_id, {"status": "paused"})
    payload = {"campaignId": campaign_id, "styleId": cur.get("merchant_style_id")}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="pause_ad_campaign", payload=payload,
                     status="applied", entity_type="style_ad", entity_id=campaign_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "pause_ad_campaign", "input": payload,
                           "output": {"status": "paused"}})
    ctx.transcript.append({"kind": "action", "actionType": "pause_ad_campaign", "status": "applied",
                           "summary": f"暂停广告 {campaign_id}（止损，可恢复）"})
    return f"Campaign {campaign_id} paused."


def set_group_buy_coupon(style_id: str, price_cents: int) -> str:
    """Propose a 团购 (group-buy) deal for a published style at a post-coupon price in cents. This creates a
    REAL, editable draft deal — built from the style's title, its current price, and its catalog services —
    which the merchant reviews and publishes in 团购管理. It does NOT pretend the deal is already live."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    price_cents = _bounded_int(price_cents, field="price_cents", maximum=_MAX_COUPON_PRICE_CENTS)

    result = bus.post_propose_groupbuy(style_id, price_cents, ctx.run_id)
    if not result.get("ok"):
        raise ValueError(f"propose_groupbuy_failed: {result.get('errors')}")
    deal_id = result["deal"]["id"]

    payload = {"styleId": style_id, "priceCents": price_cents}
    hypothesis = _decision_hypothesis(style_id, lever="coupon")
    if hypothesis:
        payload["hypothesis"] = hypothesis  # prediction snapshot — the monitor's calibration baseline
    bus.write_action(
        ctx.sb, run_id=ctx.run_id, action_type="set_group_buy_coupon", payload=payload,
        status="proposed", entity_type="groupbuy_deal", entity_id=deal_id,
    )
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "set_group_buy_coupon", "input": payload,
         "output": {"dealId": deal_id, "dealStatus": "draft"}}
    )
    ctx.transcript.append(
        {"kind": "action", "actionType": "set_group_buy_coupon", "status": "proposed",
         "summary": f"团购草稿（待商家发布）：{style_id} · 券后 {price_cents / 100:g}"}
    )
    return f"Group-buy draft {deal_id} proposed for {style_id} at {price_cents} cents — awaiting merchant publish."


def list_style(style_id: str) -> str:
    """Re-list (publish) an EXISTING style that is currently archived. Reversible — the merchant can
    undo it from the panel. Use only for styles that already exist in the catalog."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    payload = {"styleId": style_id}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="list_style", payload=payload)
    ctx.transcript.append({"kind": "tool_call", "tool": "list_style", "input": payload, "output": {"ok": True}})
    ctx.transcript.append(
        {"kind": "action", "actionType": "list_style", "status": "applied", "summary": f"上架：{style_id}"}
    )
    return f"Style listed: {style_id} (reversible)."


def delist_style(style_id: str) -> str:
    """Delist (archive) an existing style that has been unproductive for a long time. Reversible — the
    merchant can undo it from the panel."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    payload = {"styleId": style_id}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="delist_style", payload=payload)
    ctx.transcript.append({"kind": "tool_call", "tool": "delist_style", "input": payload, "output": {"ok": True}})
    ctx.transcript.append(
        {"kind": "action", "actionType": "delist_style", "status": "applied", "summary": f"下架：{style_id}"}
    )
    return f"Style delisted: {style_id} (reversible)."


def propose_listing(gap_tag: str, reason: str) -> str:
    """Propose listing a NEW style for a demand gap that has NO matching internal style (external
    trending found nothing in-catalog). You CANNOT fabricate the design — this only PROPOSES the
    listing; it is written status='proposed' and the merchant must approve and supply the image in
    the panel before it goes live (ADR-0007 §4, the one human gate). At most
    MAX_PENDING_PROPOSALS per round — propose the highest-priority gaps first; when the cap is
    reached, STOP proposing and say so. gap_tag: the demand tag (e.g. '暗黑'); reason: one line of
    grounded justification."""
    ctx = _ctx()
    gap_tag = _clean_text(gap_tag, field="gap_tag", max_chars=_MAX_TAG_CHARS)
    reason = _clean_text(reason, field="reason")

    # ADR-0013 P0 hygiene — new-listing ideas track weekly trend sources, so the pending queue must not
    # outrun them. (1) This round SUPERSEDES the agent's older pending proposals; (2) same-tag repeats
    # within the round dedupe; (3) a hard cap stops the pile at config.MAX_PENDING_PROPOSALS.
    if not ctx.proposals_reset:
        expired = bus.expire_stale_proposals(ctx.sb, exclude_run_id=ctx.run_id)
        ctx.proposals_reset = True
        if expired:
            ctx.transcript.append(
                {"kind": "tool_call", "tool": "propose_listing", "input": {"supersede": True},
                 "output": {"expiredPriorProposals": expired}}
            )
    if gap_tag in ctx.proposed_tags:
        return f"Duplicate skipped — '{gap_tag}' is already proposed this round."
    if len(ctx.proposed_tags) >= config.MAX_PENDING_PROPOSALS:
        raise ValueError("proposal_cap_reached")

    payload = {"gapTag": gap_tag, "reason": reason}
    bus.write_action(
        ctx.sb, run_id=ctx.run_id, action_type="draft_upload",
        payload=payload, risk="irreversible", status="proposed",
    )
    ctx.proposed_tags.add(gap_tag)
    ctx.transcript.append({"kind": "tool_call", "tool": "propose_listing", "input": payload, "output": {"proposed": True}})
    ctx.transcript.append(
        {"kind": "action", "actionType": "draft_upload", "status": "proposed",
         "summary": f"提醒上架（待商家批准）：{gap_tag} 缺口 — {reason}"}
    )
    ctx.awaiting_approval = True
    return f"Listing proposed for gap '{gap_tag}' (awaiting merchant approval — you cannot list it yourself)."


def send_customer_message(customer_name: str, body: str) -> str:
    """Send a re-engagement / acquisition message to a customer as the boss (老板), with an AI note.
    IRREVERSIBLE — once sent, a message cannot be un-sent, so the UI must not offer an undo (it shows
    view-only). customer_name: from the roster; body: the message text.
    No style-card attachment: there is no grounded per-customer recommendation source yet, so we don't let
    the model invent a style id — add a grounded recommendation tool before re-introducing style_id."""
    ctx = _ctx()
    customer_name = _clean_text(customer_name, field="customer_name", max_chars=80)
    body = _clean_text(body, field="body")
    payload = {"customerName": customer_name, "body": body}
    bus.write_action(
        ctx.sb, run_id=ctx.run_id, action_type="send_customer_message", payload=payload, risk="irreversible"
    )
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "send_customer_message", "input": payload, "output": {"sent": True}}
    )
    ctx.transcript.append(
        {"kind": "action", "actionType": "send_customer_message", "status": "applied",
         "summary": f"发送消息（以老板身份）：→ {customer_name}"}
    )
    return f"Message sent to {customer_name} as boss (irreversible — cannot be un-sent)."


# ── registries: ONE list of functions → two backend representations + the executable impls ───────

def get_catalog_actions(range_days: int = 7, trend_type: str = "growing") -> str:
    """Grounded catalog candidates — styles to DELIST (long-term low-conversion & not on any rising trend)
    + gap tags to PROPOSE. Uses the SAME shared report builder as 选品 (so prune/gap match the trend agent,
    incl. MATCH_MODE=concept); ACT on these, do NOT re-judge delist decisions from raw metrics.
    Returns {delist:[{styleId,title,reason}], propose:[{tag,reason}], matchMeta}."""
    ctx = _ctx()
    report = _trend_report(range_days, trend_type)
    out = {
        "delist": report.get("prune", []),
        "propose": [{"tag": o["trendLabel"], "reason": o["reason"]}
                    for o in report.get("opportunities", []) if o.get("action") == "gap"],
        "matchMeta": report.get("matchMeta"),
    }
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_catalog_actions", "input": {"rangeDays": range_days}, "output": out}
    )
    return json.dumps(out, ensure_ascii=False)


def get_style_business_facts() -> str:
    """Grounded per-style business FACTS (ADR-0016 business engine — facts, never verdicts). For each
    published style: economics (profit/hour, margin), demand + conversion scores, next-week capacity
    fit, ad economics (`ad.expectedRoas` = contribution per ad dollar, `ad.costPerBookingCents`,
    `ad.exposureRatio` = impressions received vs demand earned), coupon economics
    (`coupon.referencePriceCents` 20%-off anchor, `coupon.floorPriceCents` = lowest price clearing the
    merchant's profit/hour floor), and machine SIGNAL tags — each an independently checkable fact
    (underexposed / roas_above_target / low_conversion / full_capacity / below_coupon_floor …) — plus
    the shared next-week capacity band. A null expectedRoas means it could not be measured, which is a
    NO, not a maybe. WHAT to do about these facts is YOUR judgment: synthesise across styles + the
    briefing + 选品 trends; do NOT re-derive the numbers. Doing nothing is valid."""
    ctx = _ctx()
    data = bus.fetch_decisions()
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_style_business_facts", "input": {}, "output": data}
    )
    return json.dumps(data, ensure_ascii=False)


_BRIEF_ACTIONS = {"ad", "coupon"}


def submit_action_brief(
    action_type: str,
    style_id: str,
    objective: str,
    max_total_budget_cents: int,
    target_bookings_min: int = 0,
    target_bookings_max: int = 0,
    max_cost_per_booking_cents: int = 0,
    max_booked_minutes: int = 0,
    allowed_period: str = "weekday",
    notes: str = "",
) -> str:
    """Submit ONE Action Brief (ADR-0016 §2) — the decision agent's output contract. A brief gives the
    executor an OBJECTIVE and HARD BOUNDARIES, never exact execution parameters: the executor finds its
    own audience/budget/duration inside them via forecast loops, and may report the objective
    infeasible. action_type: ad | coupon. objective: the business problem this action solves, in one
    sentence citing numbers. max_total_budget_cents: hard spend ceiling (ad) or price floor context
    (coupon). target_bookings_min/max: the outcome range that would count as success.
    max_cost_per_booking_cents: CAC ceiling. allowed_period: weekday | any (weekend stays protected).
    Call once per action; multiple briefs are allowed; no briefs (do nothing) is a valid round."""
    ctx = _ctx()
    if ctx.brief_sink is None:
        raise ValueError("briefs_not_allowed")  # only the decision agent's context carries the sink
    action_type = _clean_text(action_type, field="action_type", max_chars=20)
    if action_type not in _BRIEF_ACTIONS:
        raise ValueError("action_type_invalid")
    style_id = _clean_style_id(style_id)
    objective = _clean_text(objective, field="objective", max_chars=300)
    max_total_budget_cents = _bounded_int(max_total_budget_cents, field="max_total_budget_cents",
                                          maximum=_MAX_AD_BUDGET_CENTS)
    if allowed_period not in ("weekday", "any"):
        raise ValueError("allowed_period_invalid")
    brief = {
        "action_type": action_type,
        "style_id": style_id,
        "objective": objective,
        "max_total_budget_cents": max_total_budget_cents,
        "target_bookings_min": target_bookings_min or None,
        "target_bookings_max": target_bookings_max or None,
        "max_cost_per_booking_cents": max_cost_per_booking_cents or None,
        "max_booked_minutes": max_booked_minutes or None,
        "allowed_period": allowed_period,
        "notes": str(notes or "")[:300],
        "source_run_id": ctx.run_id,
    }
    ctx.brief_sink(brief)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "submit_action_brief", "input": brief, "output": {"accepted": True}}
    )
    return f"Action brief accepted ({action_type} / {style_id}) — the executor will plan within it."


# ── memory + measurement tools (ADR-0013 P2, rebuilt by ADR-0015) ────────────────────────────────
# Principle: the AGENT decides what was learned (claim + confidence); CODE decides identity and
# evidence (which action/entity, the prediction compared against, windows, expiry, scope).

_CONFIDENCE = {"low", "medium", "high"}
_ACTION_DOMAIN = {
    "place_ad": "ad", "update_ad_campaign": "ad", "pause_ad_campaign": "ad",
    "set_group_buy_coupon": "coupon",
    "list_style": "catalog", "delist_style": "catalog",
    "propose_listing": "catalog", "draft_upload": "catalog",
    "send_customer_message": "customer_ops",
}
# Which memory DOMAINS each agent may search. Executors (投广/团购) get none by design: history is
# synthesized into the plan by 决策 — an executor re-interpreting strategy mid-execution blurs who
# decided what. Empty ctx.agent_slug (unit tests, direct calls) is unrestricted.
MEMORY_ACCESS: dict[str, set[str]] = {
    "orchestrator": {"round", "merchant"},
    "insight": {"ad", "coupon", "catalog", "round"},
    "trend": {"ad", "catalog"},
    "decision": {"ad", "coupon", "catalog", "customer_ops", "round", "merchant"},
    "ad": set(),
    "coupon": set(),
    "catalog": {"catalog", "merchant"},
    "customer_ops": {"customer_ops", "merchant"},
    "monitor": {"ad", "coupon", "catalog", "customer_ops", "round", "merchant"},
}
_MEMORY_TTL_DAYS = {"high": 30, "medium": 14, "low": 7}


def _memory_view(r: dict[str, Any]) -> dict[str, Any]:
    """Slim row for model consumption. Legacy (pre-0032) rows surface their verdict as the claim."""
    return {
        "memoryId": r.get("id"),
        "kind": r.get("kind"),
        "domain": r.get("domain"),
        "scope": {"type": r.get("scope_type"), "id": r.get("scope_id"), "tags": r.get("scope_tags") or []},
        "claim": r.get("claim") or (r.get("content") or {}).get("verdict"),
        "comparison": r.get("comparison"),
        "applicability": r.get("applicability"),
        "confidence": r.get("confidence"),
        "source": {"actionId": r.get("source_action_id"), "entityId": r.get("entity_id"),
                   "windowEnd": r.get("window_end")},
        "expiresAt": r.get("expires_at"),
    }


def _score_memory(r: dict[str, Any], *, refs: set[str], tags: set[str], domains: set[str]) -> float:
    """Structured relevance (ADR-0015) — exact entity/action anchor beats style beats tag beats domain.
    No embeddings: our scopes are explicit ids and tags, so deterministic scoring is both cheaper and
    reproducible in eval."""
    score = 0.0
    row_refs = {r.get("scope_id"), r.get("entity_id"), r.get("source_action_id"), r.get("key")}
    if refs & {x for x in row_refs if x}:
        score += 100
    if tags & set(r.get("scope_tags") or []):
        score += 50
    if r.get("kind") == "merchant_preference":
        score += 60
    if domains and r.get("domain") in domains:
        score += 25
    if r.get("confidence") == "high":
        score += 20
    return score


def get_campaign_outcomes() -> str:
    """Read LIVE ad-campaign metrics (impressions, clicks, bookings, spend, status, daily budget) for
    every campaign of this merchant — the ground truth for measuring whether past ad decisions worked.
    Read-only; these tables are the source of truth that any memory verdict must cite."""
    ctx = _ctx()
    rows = bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "get_campaign_outcomes", "input": {}, "output": rows})
    return json.dumps(rows, ensure_ascii=False)


def _require_memory_writer(ctx: RunContext) -> None:
    # only the monitor writes memory — everyone else's conclusions are candidates, not experience.
    # (empty agent_slug = unit tests / direct calls; the monitor's RevisionPort doubles as evidence.)
    if ctx.agent_slug not in ("", "monitor") and ctx.revision is None:
        raise ValueError("memory_write_not_allowed")


def record_action_outcome(action_id: str, assessment: str, confidence: str) -> str:
    """Record the MEASURED outcome of ONE of the team's actions (ADR-0015). You provide only the
    judgment: action_id (from the execution list), assessment (one or two sentences citing measured
    numbers vs the prediction), confidence (low|medium|high). Code derives everything else from the
    action row — entity, scope, the decision's hypothesis snapshot, live campaign metrics at write
    time, windows and expiry. Re-recording the same action REPLACES the previous outcome. Refuses when
    the campaign has no data yet (immature observation window) — say "基线已记录，N 天后可测" in prose
    instead of writing a premature verdict."""
    ctx = _ctx()
    _require_memory_writer(ctx)
    action_id = _clean_text(action_id, field="action_id", max_chars=80)
    assessment = _clean_text(assessment, field="assessment", max_chars=600)
    confidence = _clean_text(confidence, field="confidence", max_chars=10)
    if confidence not in _CONFIDENCE:
        raise ValueError("confidence_invalid")

    action = bus.fetch_action(ctx.sb, action_id, ctx.merchant_id)
    if not action:
        raise ValueError("action_not_found")
    domain = _ACTION_DOMAIN.get(action.get("type", ""))
    if domain is None:
        raise ValueError("action_type_unmeasurable")
    payload = action.get("payload") or {}
    style_id = payload.get("styleId")
    hypothesis = payload.get("hypothesis")  # code-written at execution time (place_ad / coupon)

    # live metrics for the action's entity at write time — evidence, pinned into the comparison
    measured = None
    if action.get("entity_type") == "style_ad":
        for c in bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id):
            if c.get("id") == action.get("entity_id"):
                measured = {k: c.get(k) for k in ("impressions", "clicks", "bookings", "spend_cents")}
                if (c.get("bookings") or 0) > 0:
                    measured["spend_per_booking_cents"] = round(c["spend_cents"] / c["bookings"])
                break
        if not measured or not measured.get("impressions"):
            raise ValueError("observation_window_immature")  # nothing measured yet — record pending in prose

    comparison: dict[str, Any] = {"predicted": hypothesis, "measured": measured}
    predicted_cpb = (hypothesis or {}).get("costPerBookingCents")
    measured_cpb = (measured or {}).get("spend_per_booking_cents")
    if predicted_cpb and measured_cpb:
        comparison.update({
            "metric": "costPerBookingCents", "ratio": round(measured_cpb / predicted_cpb, 2),
            "direction": "underestimated_cost" if measured_cpb > predicted_cpb else "overestimated_cost",
        })

    now = datetime.now(timezone.utc)
    row = {
        "merchant_id": ctx.merchant_id,
        "agent_slug": "monitor",
        "kind": "action_outcome",
        "key": action_id,  # unique(merchant, kind, key) → re-measurement replaces
        "domain": domain,
        "scope_type": "style" if style_id else "entity",
        "scope_id": style_id or action.get("entity_id"),
        "claim": assessment,
        "content": {"verdict": assessment},  # legacy readers
        "comparison": comparison,
        "applicability": {"funnelSlot": payload.get("slot")} if payload.get("slot") else None,
        "confidence": confidence,
        "source_action_id": action_id,
        "entity_type": action.get("entity_type"),
        "entity_id": action.get("entity_id"),
        "window_start": action.get("created_at"),
        "window_end": now.isoformat(),
        "evidence_run_id": ctx.run_id,
        "expires_at": (now + timedelta(days=_MEMORY_TTL_DAYS[confidence])).isoformat(),
    }
    bus.upsert_memory(ctx.sb, row)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "record_action_outcome",
         "input": {"actionId": action_id, "assessment": assessment, "confidence": confidence},
         "output": {"recorded": True, "domain": domain, "comparison": comparison}}
    )
    return f"Action outcome recorded for {action_id} ({domain}, {confidence}) — future rounds will read it."


def record_round_verdict(verdict: str, evidence_action_ids: str, confidence: str) -> str:
    """Record a ROUND-LEVEL operational conclusion (ADR-0015) — e.g. "产能 92% 时仍投广，新增预约接不
    住；满产能应先提价控量而非获客". verdict: the conclusion. evidence_action_ids: comma-separated
    action ids backing it (at least one must exist — a verdict without evidence is opinion).
    confidence: low|medium|high (drives expiry: 7/14/30 days)."""
    ctx = _ctx()
    _require_memory_writer(ctx)
    verdict = _clean_text(verdict, field="verdict", max_chars=600)
    confidence = _clean_text(confidence, field="confidence", max_chars=10)
    if confidence not in _CONFIDENCE:
        raise ValueError("confidence_invalid")
    ids = [s.strip() for s in str(evidence_action_ids or "").split(",") if s.strip()]
    if not ids:
        raise ValueError("evidence_required")
    for aid in ids:
        if not bus.fetch_action(ctx.sb, aid, ctx.merchant_id):
            raise ValueError(f"evidence_action_not_found:{aid}")

    now = datetime.now(timezone.utc)
    row = {
        "merchant_id": ctx.merchant_id,
        "agent_slug": "monitor",
        "kind": "round_verdict",
        "key": f"round-{ctx.round_id or ctx.run_id}",
        "domain": "round",
        "scope_type": "merchant",
        "scope_id": ctx.merchant_id,
        "claim": verdict,
        "content": {"verdict": verdict, "evidenceActionIds": ids},
        "confidence": confidence,
        "window_end": now.isoformat(),
        "evidence_run_id": ctx.run_id,
        "expires_at": (now + timedelta(days=_MEMORY_TTL_DAYS[confidence])).isoformat(),
    }
    bus.upsert_memory(ctx.sb, row)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "record_round_verdict",
         "input": {"verdict": verdict, "evidenceActionIds": ids, "confidence": confidence},
         "output": {"recorded": True}}
    )
    return "Round verdict recorded — next round's orchestrator and 决策 will see it."


def search_memory(scope_refs: str = "", scope_tags: str = "", domains: str = "", limit: int = 5) -> str:
    """Search the team's long-term memory by RELEVANCE (ADR-0015), not recency. Use when historical
    evidence could materially change your ranking, action, budget, or confidence — e.g. after
    identifying candidate styles, check whether the team already measured them. scope_refs:
    comma-separated ids (style ids, entity ids like ad-style-…, action ids). scope_tags:
    comma-separated style tags (金属感, 法式…). domains: comma-separated (ad, coupon, catalog,
    customer_ops, round, merchant) — your agent's allowed domains apply regardless. Memory is
    historical prior, NOT current fact: live tools win every conflict; absence of memory is not
    evidence an action will work."""
    ctx = _ctx()
    limit = min(_bounded_int(limit, field="limit", maximum=10), 10)
    refs = {s.strip() for s in str(scope_refs or "").split(",") if s.strip()}
    tags = {s.strip() for s in str(scope_tags or "").split(",") if s.strip()}
    doms = {s.strip() for s in str(domains or "").split(",") if s.strip()}
    allowed = MEMORY_ACCESS.get(ctx.agent_slug) if ctx.agent_slug else None
    if allowed is not None:
        doms = (doms & allowed) if doms else set(allowed)
        if not doms and not allowed:
            raise ValueError("memory_access_denied")  # executors don't re-interpret strategy

    rows = bus.fetch_memory(ctx.sb, ctx.merchant_id)
    if allowed is not None:
        rows = [r for r in rows if r.get("domain") in allowed or r.get("domain") is None]
    if doms:
        rows = [r for r in rows if not r.get("domain") or r.get("domain") in doms]
    ranked = sorted(rows, key=lambda r: _score_memory(r, refs=refs, tags=tags, domains=doms), reverse=True)
    out = [_memory_view(r) for r in ranked[:limit]]
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "search_memory",
         "input": {"scopeRefs": sorted(refs), "scopeTags": sorted(tags), "domains": sorted(doms), "limit": limit},
         "output": out}
    )
    return json.dumps({"memories": out}, ensure_ascii=False)


def read_blackboard(sections: str = "") -> str:
    """Read this round's shared blackboard — the sections upstream lanes have concluded so far, plus
    the derived `executions` snapshot. Written deterministically by the orchestrator; agent_actions
    stays the authoritative store for executions. sections: comma-separated section names to read
    (e.g. "insight,trend" or "executions") — omit for the full board. Use for mid-run consultation;
    your required context is already injected into the task."""
    ctx = _ctx()
    if not ctx.round_id:
        return json.dumps({"note": "no blackboard this round (migration 0030 not applied)"}, ensure_ascii=False)
    board = bus.fetch_blackboard(ctx.sb, ctx.round_id)
    wanted = [s.strip() for s in str(sections or "").split(",") if s.strip()]
    if wanted:
        board = {"sections": {k: board.get(k) for k in wanted if k in board},
                 "missingSections": [k for k in wanted if k not in board]}
    ctx.transcript.append({"kind": "tool_call", "tool": "read_blackboard",
                           "input": {"sections": wanted}, "output": board})
    return json.dumps(board, ensure_ascii=False)


# ── revision edge (ADR-0013 P3) — available ONLY to the monitor run ──────────────────────────────

def request_revision(action_id: str, feedback: str) -> str:
    """Reject ONE of this round's actions and re-dispatch its executor ONCE with your feedback attached
    (ADR-0013 §4). Use only when the measured numbers clearly contradict the action (e.g. budget far above
    what measured ROAS supports). feedback: concrete and numeric — the executor will act on it verbatim.
    Only reversible, entity-backed actions (place_ad / set_group_buy_coupon) can be revised; published
    deals and sent messages cannot. The revision NEVER forks a new entity — the executor's re-run updates
    the same campaign/deal in place."""
    ctx = _ctx()
    if ctx.revision is None:
        raise ValueError("revision_not_allowed")  # only the monitor holds a RevisionPort
    action_id = _clean_text(action_id, field="action_id", max_chars=80)
    feedback = _clean_text(feedback, field="feedback", max_chars=600)
    run_id, text = ctx.revision.request(action_id, feedback)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "request_revision",
         "input": {"actionId": action_id, "feedback": feedback},
         "output": {"revisionRunId": run_id, "summary": text[:280]}}
    )
    return f"Revision run {run_id} finished:\n{text[:800]}"


# ── orchestration tools (ADR-0013 P1) — available ONLY to the orchestrator run ───────────────────
# ctx.round is a RoundState set by orchestrator.run_round; every lane agent has round=None, so a
# hallucinated dispatch from a non-orchestrator loop is refused before any side effect.

def _require_round() -> tuple[RunContext, Any]:
    ctx = _ctx()
    if ctx.round is None:
        raise ValueError("dispatch_not_allowed")  # only the orchestrator holds a RoundState
    return ctx, ctx.round


def _record_dispatch(ctx: RunContext, slug: str, parent: str, run_id: str, text: str) -> None:
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "dispatch_agent",
         "input": {"agent": slug, "parent": parent or None},
         "output": {"runId": run_id, "summary": text[:280]}}
    )


def dispatch_agent(agent: str, task: str, parent: str = "") -> str:
    """Dispatch ONE team agent to run its own tool loop on a task, wait for it, and return its
    conclusion. agent: one of trend/insight/decision/ad/coupon/catalog/customer_ops/monitor.
    task: the concrete assignment in Chinese (the upstream conclusion named by `parent` is appended
    automatically — do not paste it yourself). parent: the earlier-dispatched agent this task follows
    from (e.g. 'decision' for ad/coupon) — it wires the lineage tree. Each agent may be dispatched at
    most once per round; skipping an agent is a decision — say why in your final summary."""
    ctx, rnd = _require_round()
    agent = _clean_text(agent, field="agent", max_chars=40)
    task = _clean_text(task, field="task", max_chars=4000)
    parent = str(parent or "").strip()  # models pass JSON null for "no parent"
    run_id, text = rnd.dispatch(agent, task, parent or None)
    _record_dispatch(ctx, agent, parent, run_id, text)
    return f"[{agent}] run {run_id} finished:\n{text[:1200]}"


def dispatch_many(dispatches_json: str) -> str:
    """Dispatch SEVERAL INDEPENDENT agents in parallel and wait for all of them. dispatches_json:
    a JSON array of up to 4 items, each {"agent": str, "task": str, "parent": str?} with the same
    semantics as dispatch_agent. Use for lanes with no dependency between them (e.g. ad + coupon +
    customer_ops after the decision) — dependent steps must use dispatch_agent sequentially."""
    from concurrent.futures import ThreadPoolExecutor

    ctx, rnd = _require_round()
    try:
        items = json.loads(dispatches_json)
    except json.JSONDecodeError as e:
        raise ValueError("dispatches_json_invalid") from e
    if not isinstance(items, list) or not (1 <= len(items) <= 4):
        raise ValueError("dispatches_json_must_be_1_to_4_items")
    cleaned: list[tuple[str, str, str]] = []
    for it in items:
        if not isinstance(it, dict):
            raise ValueError("dispatches_json_invalid")
        cleaned.append((
            _clean_text(str(it.get("agent", "")), field="agent", max_chars=40),
            _clean_text(str(it.get("task", "")), field="task", max_chars=4000),
            str(it.get("parent", "") or "").strip(),
        ))
    rnd.reserve([slug for slug, _, _ in cleaned])  # validate the whole batch before any run starts

    def _one(args: tuple[str, str, str]) -> tuple[str, str, str, str]:
        slug, task, parent = args
        run_id, text = rnd.dispatch(slug, task, parent or None, reserved=True)
        return slug, parent, run_id, text

    with ThreadPoolExecutor(max_workers=len(cleaned)) as pool:
        results = list(pool.map(_one, cleaned))
    out_lines = []
    for slug, parent, run_id, text in results:
        _record_dispatch(ctx, slug, parent, run_id, text)
        out_lines.append(f"[{slug}] run {run_id} finished:\n{text[:800]}")
    return "\n\n".join(out_lines)


_FUNCTIONS: list[Callable[..., str]] = [
    get_merchant_insights,
    get_style_business_facts,
    submit_action_brief,
    get_customer_intelligence,
    get_external_trends,
    get_platform_hot,
    get_trend_opportunities,
    get_catalog_actions,
    get_ad_account_state,
    list_available_audiences,
    forecast_ad_plan,
    place_ad,
    update_ad_campaign,
    pause_ad_campaign,
    set_group_buy_coupon,
    list_style,
    delist_style,
    propose_listing,
    send_customer_message,
    dispatch_agent,
    dispatch_many,
    get_campaign_outcomes,
    record_action_outcome,
    record_round_verdict,
    search_memory,
    read_blackboard,
    request_revision,
]

_JSON_TYPES = {str: "string", int: "integer", float: "number", bool: "boolean"}


def _openai_schema(fn: Callable[..., str]) -> dict[str, Any]:
    """Derive an OpenAI function-calling schema from a plain function's signature + docstring.
    Single source of truth = the function itself; no hand-maintained per-tool schema to drift."""
    hints = typing.get_type_hints(fn)
    props: dict[str, Any] = {}
    required: list[str] = []
    for name, p in inspect.signature(fn).parameters.items():
        props[name] = {"type": _JSON_TYPES.get(hints.get(name, str), "string")}
        if p.default is inspect.Parameter.empty:
            required.append(name)
    return {
        "type": "function",
        "function": {
            "name": fn.__name__,
            "description": inspect.getdoc(fn) or "",
            "parameters": {"type": "object", "properties": props, "required": required},
        },
    }


# name → plain callable (executed by both loops)
IMPL: dict[str, Callable[..., str]] = {fn.__name__: fn for fn in _FUNCTIONS}
# name → anthropic beta_tool (Anthropic `tool_runner` backend). beta_tool(fn) == @beta_tool def fn.
BETA_TOOLS: dict[str, Any] = {fn.__name__: beta_tool(fn) for fn in _FUNCTIONS}
# name → OpenAI function-schema (OpenRouter backend)
OPENAI_TOOLS: dict[str, dict[str, Any]] = {fn.__name__: _openai_schema(fn) for fn in _FUNCTIONS}
