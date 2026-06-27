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
import typing
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, Callable

from anthropic import beta_tool

from . import bus

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


_current: ContextVar[RunContext] = ContextVar("nailed_agent_run")


def use_context(ctx: RunContext) -> Token:
    return _current.set(ctx)


def reset_context(token: Token) -> None:
    _current.reset(token)


def _ctx() -> RunContext:
    return _current.get()


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


def place_ad(style_id: str, slot: str, budget_cents: int) -> str:
    """Place an ad for a published style in a funnel slot. slot must be one of 'top_funnel',
    'lower_funnel', 'mid_funnel'. budget_cents is the ad budget in cents. Reversible — the merchant
    can undo it from the panel."""
    ctx = _ctx()
    payload = {"styleId": style_id, "slot": slot, "budgetCents": budget_cents}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="place_ad", payload=payload)
    ctx.transcript.append({"kind": "tool_call", "tool": "place_ad", "input": payload, "output": {"ok": True}})
    ctx.transcript.append(
        {"kind": "action", "actionType": "place_ad", "status": "applied",
         "summary": f"投广：{style_id} · {slot} · 预算 {budget_cents / 100:.0f}"}
    )
    return f"Ad placed: {style_id} in {slot} at {budget_cents} cents (reversible)."


def set_group_buy_coupon(style_id: str, price_cents: int) -> str:
    """Set a 团购券 (group-buy coupon) post-coupon price for a style, surfaced on the price-config
    page. price_cents is the post-coupon price in cents. Reversible — the merchant can undo it."""
    ctx = _ctx()
    payload = {"styleId": style_id, "priceCents": price_cents}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="set_group_buy_coupon", payload=payload)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "set_group_buy_coupon", "input": payload, "output": {"ok": True}}
    )
    ctx.transcript.append(
        {"kind": "action", "actionType": "set_group_buy_coupon", "status": "applied",
         "summary": f"团购券：{style_id} · 券后 {price_cents / 100:.0f}"}
    )
    return f"Coupon set: {style_id} post-coupon {price_cents} cents (reversible)."


def list_style(style_id: str) -> str:
    """Re-list (publish) an EXISTING style that is currently archived. Reversible — the merchant can
    undo it from the panel. Use only for styles that already exist in the catalog."""
    ctx = _ctx()
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
    the panel before it goes live (ADR-0007 §4, the one human gate). gap_tag: the demand tag (e.g.
    '暗黑'); reason: one line of grounded justification."""
    ctx = _ctx()
    payload = {"gapTag": gap_tag, "reason": reason}
    bus.write_action(
        ctx.sb, run_id=ctx.run_id, action_type="draft_upload",
        payload=payload, risk="irreversible", status="proposed",
    )
    ctx.transcript.append({"kind": "tool_call", "tool": "propose_listing", "input": payload, "output": {"proposed": True}})
    ctx.transcript.append(
        {"kind": "action", "actionType": "draft_upload", "status": "proposed",
         "summary": f"提醒上架（待商家批准）：{gap_tag} 缺口 — {reason}"}
    )
    ctx.awaiting_approval = True
    return f"Listing proposed for gap '{gap_tag}' (awaiting merchant approval — you cannot list it yourself)."


def send_customer_message(customer_name: str, body: str, style_id: str = "") -> str:
    """Send a re-engagement / acquisition message to a customer as the boss (老板), with an AI note and
    an optional recommended-style card. Reversible — the merchant can retract it. customer_name: from
    the roster; body: the message text; style_id: optional style to attach as a card."""
    ctx = _ctx()
    payload = {"customerName": customer_name, "body": body, "styleId": style_id or None}
    bus.write_action(ctx.sb, run_id=ctx.run_id, action_type="send_customer_message", payload=payload)
    ctx.transcript.append(
        {"kind": "tool_call", "tool": "send_customer_message", "input": payload, "output": {"sent": True}}
    )
    ctx.transcript.append(
        {"kind": "action", "actionType": "send_customer_message", "status": "applied",
         "summary": f"发送消息（以老板身份）：→ {customer_name}"}
    )
    return f"Message sent to {customer_name} as boss (reversible)."


# ── registries: ONE list of functions → two backend representations + the executable impls ───────

_FUNCTIONS: list[Callable[..., str]] = [
    get_merchant_insights,
    get_customer_intelligence,
    place_ad,
    set_group_buy_coupon,
    list_style,
    delist_style,
    propose_listing,
    send_customer_message,
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
