"""The shared bus: read the grounded briefing from the TS app, read agent definitions from Supabase,
write agent_runs + agent_actions back. No business rules here — just I/O."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from supabase import Client, create_client

from . import config


def supabase() -> Client:
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_briefing(range_days: int = 7) -> dict[str, Any]:
    """Grounded numbers from the TS intelligence layer (ADR-0006) — never re-derived in Python."""
    resp = httpx.get(
        f"{config.APP_URL}/api/agent/briefing",
        params={"rangeDays": range_days},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_decisions() -> dict[str, Any]:
    """The 决策 agent's grounded per-style decision input (ADR-0012 decision brain): each published style's
    economics + demand/conversion scores + next-week capacity fit + the lever the numbers point toward
    (ad/coupon/display_only/skip) with signal tags, plus the shared capacity band. Deterministic — the agent
    SYNTHESISES across it + the briefing/trends, and never re-derives the numbers."""
    resp = httpx.get(f"{config.APP_URL}/api/agent/decisions", timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def fetch_customers() -> dict[str, Any]:
    """Grounded customer roster (booking history, most-lapsed first) for the 用户运营 agent — same
    guardrail as the briefing: pre-computed substrate, never invented in Python."""
    resp = httpx.get(f"{config.APP_URL}/api/agent/customers", timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def fetch_styles() -> dict[str, Any]:
    """Published styles across all merchants (id/title/merchantId/tags) for the 选品 agent's catalog
    matching + platform-hot. Grounded supply data from the TS read model."""
    resp = httpx.get(f"{config.APP_URL}/api/agent/styles", timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def agents_by_slug(sb: Client) -> dict[str, dict[str, Any]]:
    rows = sb.table("agents").select("*").execute().data or []
    return {r["slug"]: r for r in rows}


def start_run(
    sb: Client,
    *,
    agent_id: str,
    trigger_source: str,
    parent_run_id: str | None,
    input: dict[str, Any],
    started_at: str,
) -> str:
    """Insert a `running` run and return its id, so the tool-call loop's action tools can write
    agent_actions against it mid-run. Finalize with finish_run()."""
    res = (
        sb.table("agent_runs")
        .insert(
            {
                "agent_id": agent_id,
                "merchant_id": config.MERCHANT_ID,
                "trigger_source": trigger_source,
                "parent_run_id": parent_run_id,
                "status": "running",
                "input": input,
                "transcript": [],
                "started_at": started_at,
            }
        )
        .execute()
    )
    return res.data[0]["id"]


def finish_run(
    sb: Client,
    run_id: str,
    *,
    output: dict[str, Any],
    transcript: list[dict[str, Any]],
    status: str = "completed",
) -> None:
    sb.table("agent_runs").update(
        {"status": status, "output": output, "transcript": transcript, "finished_at": now_iso()}
    ).eq("id", run_id).execute()


def write_action(
    sb: Client,
    *,
    run_id: str,
    action_type: str,
    payload: dict[str, Any],
    risk: str = "reversible",
    status: str = "applied",
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    # entity_type/entity_id are the ADR-0012 forward link to the real object this action produced
    # (a style_ad or groupbuy_deal created via the TS routes). Omitted keys stay NULL for actions
    # that create no entity (e.g. a message) and for pre-contract callers.
    row: dict[str, Any] = {
        "run_id": run_id,
        "merchant_id": config.MERCHANT_ID,
        "type": action_type,
        "risk": risk,
        "status": status,
        "payload": payload,
    }
    if entity_type is not None:
        row["entity_type"] = entity_type
    if entity_id is not None:
        row["entity_id"] = entity_id
    sb.table("agent_actions").insert(row).execute()
