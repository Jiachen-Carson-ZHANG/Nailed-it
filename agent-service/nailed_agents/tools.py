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

from . import bus, config, trend_logic, trends_source

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
_AD_SLOTS = {"top_funnel", "lower_funnel", "mid_funnel"}
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


def place_ad(style_id: str, slot: str, budget_cents: int) -> str:
    """Run an ad for a published style in a funnel slot. slot must be one of 'top_funnel',
    'lower_funnel', 'mid_funnel'. budget_cents is the daily ad budget in cents. This creates a REAL ad
    campaign the merchant can see and stop in 投广中心 — inside the merchant's budget cap it launches
    immediately (spend is a withdrawable daily drip); above the cap it is left as a draft for the merchant
    to launch. Reversible: the merchant can pause or stop the campaign."""
    ctx = _ctx()
    style_id = _clean_style_id(style_id)
    if not isinstance(slot, str) or slot not in _AD_SLOTS:
        raise ValueError("slot_invalid")
    budget_cents = _bounded_int(budget_cents, field="budget_cents", maximum=_MAX_AD_BUDGET_CENTS)

    result = bus.post_propose_ad(style_id, budget_cents, ctx.run_id)
    if not result.get("ok"):
        raise ValueError(f"propose_ad_failed: {result.get('errors')}")
    entity_id, entity_status = result["id"], result["status"]  # 'active' | 'draft'
    action_status = "applied" if entity_status == "active" else "proposed"

    payload = {"styleId": style_id, "slot": slot, "budgetCents": budget_cents}
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
         "summary": f"投广：{style_id} · {slot} · 日预算 {budget_cents / 100:g}"
                    + ("（已投放，可随时暂停）" if launched else "（超出预算上限，待商家启动）")}
    )
    verb = "launched" if launched else "left as a draft for the merchant to launch"
    return f"Ad campaign {entity_id} for {style_id} ({slot}, {budget_cents} cents/day) {verb}."


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


def get_style_business_decisions() -> str:
    """Grounded per-style business decisions (ADR-0012 decision brain). For each published style: its
    economics (profit/hour, margin), demand + conversion scores, next-week capacity fit, ad economics
    (`ad.expectedRoas` = contribution per ad dollar, `ad.costPerBookingCents`, `ad.exposureRatio` =
    impressions received vs demand earned), and the lever the numbers point toward — place_ad /
    set_group_buy_coupon / display_only / skip — with machine signal tags, plus the shared next-week
    capacity band. A null expectedRoas means it could not be measured, which is a NO, not a maybe.
    These are ADVISORY: SYNTHESISE across them + the briefing + 选品 trends to choose the actual actions;
    do NOT re-derive the numbers. Doing nothing (skip) is valid."""
    ctx = _ctx()
    data = bus.fetch_decisions()
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "get_style_business_decisions", "input": {}, "output": data}
    )
    return json.dumps(data, ensure_ascii=False)


# ── memory + measurement tools (ADR-0013 P2) ─────────────────────────────────────────────────────

_MEMORY_KINDS = {"ad_outcome", "coupon_outcome", "round_verdict"}


def get_campaign_outcomes() -> str:
    """Read LIVE ad-campaign metrics (impressions, clicks, bookings, spend, status, daily budget) for
    every campaign of this merchant — the ground truth for measuring whether past ad decisions worked.
    Read-only; these tables are the source of truth that any memory verdict must cite."""
    ctx = _ctx()
    rows = bus.fetch_campaign_outcomes(ctx.sb, ctx.merchant_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "get_campaign_outcomes", "input": {}, "output": rows})
    return json.dumps(rows, ensure_ascii=False)


def record_memory(kind: str, key: str, verdict: str, entity_id: str = "", window_days: int = 7) -> str:
    """Record a WINDOWED VERDICT the team should remember across rounds (ADR-0013 §3) — e.g.
    "7d 实测 ROAS 2.1，决策时估算 4.1 —— 高估约 2 倍". kind: ad_outcome | coupon_outcome | round_verdict.
    key: stable id for what was measured (e.g. the campaign id) — re-measuring the same key REPLACES the
    old verdict. verdict: one sentence citing measured numbers; never restate raw metric tables (they
    live in the campaign/event tables, which always win a conflict). entity_id: the campaign/deal this
    verdict is about (optional). Expires in 30 days."""
    ctx = _ctx()
    kind = _clean_text(kind, field="kind", max_chars=40)
    if kind not in _MEMORY_KINDS:
        raise ValueError("kind_invalid")
    key = _clean_text(key, field="key", max_chars=120)
    verdict = _clean_text(verdict, field="verdict", max_chars=600)
    entity_id = str(entity_id or "").strip()
    window_days = _bounded_int(window_days, field="window_days", maximum=90)

    now = datetime.now(timezone.utc)
    entity_type = "style_ad" if entity_id.startswith("ad-") else "groupbuy_deal" if entity_id.startswith("gb-") else None
    row = {
        "merchant_id": ctx.merchant_id,
        "agent_slug": "monitor",
        "kind": kind,
        "key": key,
        "content": {"verdict": verdict},
        "entity_type": entity_type,
        "entity_id": entity_id or None,
        "window_start": (now - timedelta(days=window_days)).isoformat(),
        "window_end": now.isoformat(),
        "evidence_run_id": ctx.run_id,
        "expires_at": (now + timedelta(days=30)).isoformat(),
    }
    bus.upsert_memory(ctx.sb, row)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "record_memory",
         "input": {"kind": kind, "key": key, "verdict": verdict, "entityId": entity_id or None},
         "output": {"recorded": True}}
    )
    return f"Memory recorded ({kind}/{key}) — future 决策 rounds will read this verdict."


def get_agent_memory() -> str:
    """Read the team's non-expired memory: windowed verdicts from past rounds (measured ad outcomes,
    coupon outcomes, round verdicts), newest first. MEASURED verdicts outrank estimates — when memory
    says an estimate ran hot, weigh the estimate down. Raw live metrics still come from their own
    tables; on any conflict the live table wins."""
    ctx = _ctx()
    rows = bus.fetch_memory(ctx.sb, ctx.merchant_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "get_agent_memory", "input": {}, "output": rows})
    return json.dumps(rows, ensure_ascii=False)


def read_blackboard() -> str:
    """Read this round's shared blackboard: the sections upstream lanes have concluded so far
    (briefing / opportunities / plan / executed…). Written deterministically by the orchestrator."""
    ctx = _ctx()
    if not ctx.round_id:
        return json.dumps({"note": "no blackboard this round (migration 0030 not applied)"}, ensure_ascii=False)
    board = bus.fetch_blackboard(ctx.sb, ctx.round_id)
    ctx.transcript.append({"kind": "tool_call", "tool": "read_blackboard", "input": {}, "output": board})
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
    get_style_business_decisions,
    get_customer_intelligence,
    get_external_trends,
    get_platform_hot,
    get_trend_opportunities,
    get_catalog_actions,
    place_ad,
    set_group_buy_coupon,
    list_style,
    delist_style,
    propose_listing,
    send_customer_message,
    dispatch_agent,
    dispatch_many,
    get_campaign_outcomes,
    record_memory,
    get_agent_memory,
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
