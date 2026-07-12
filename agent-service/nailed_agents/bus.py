"""The shared bus: read the grounded briefing from the TS app, read agent definitions from Supabase,
write agent_runs + agent_actions back. No business rules here — just I/O."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, TypedDict

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
    """The business engine's per-style FACTS (ADR-0016: facts + signals, never a verdict): each
    published style's economics + demand/conversion scores + signal tags + ad/coupon economics,
    plus the shared next-week capacity band. Deterministic — the agent SYNTHESISES across it + the
    briefing/trends, and never re-derives the numbers."""
    resp = httpx.get(f"{config.APP_URL}/api/agent/decisions", timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def post_propose_ad(style_id: str, daily_budget_cents: int, source_run_id: str) -> dict[str, Any]:
    """Create the REAL StyleAd campaign in TS (ADR-0012 Phase 2) and get its id back for the action's
    entity link. Returns {ok, id, status}: 'active' when the budget is inside the merchant's auto-launch
    cap (withdrawable daily drip), else 'draft' awaiting the merchant's launch in 投广中心."""
    resp = httpx.post(
        f"{config.APP_URL}/api/agent/propose-ad",
        json={"styleId": style_id, "dailyBudgetCents": daily_budget_cents, "sourceRunId": source_run_id},
        timeout=30.0,
    )
    if resp.status_code >= 500:
        resp.raise_for_status()
    return resp.json()  # a 4xx carries {ok: false, errors: [...]} the tool surfaces to the agent


def post_propose_groupbuy(style_id: str, deal_price_cents: int, source_run_id: str) -> dict[str, Any]:
    """Create a REAL, editable group-buy DRAFT in TS from the published style (title, original price, its
    catalog services) — the merchant reviews and publishes it. Returns {ok, deal:{id,...}} or {ok:false,errors}."""
    resp = httpx.post(
        f"{config.APP_URL}/api/agent/propose-groupbuy",
        json={"styleId": style_id, "dealPriceCents": deal_price_cents, "sourceRunId": source_run_id},
        timeout=30.0,
    )
    if resp.status_code >= 500:
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


class AgentRow(TypedDict):
    """One row of public.agents (migration 0022). Registry + UI metadata;
    runtime tool truth is LANE_TOOLS (orchestrator.py), prompt truth is skills/*.md
    with `instructions` as fallback."""

    id: str
    slug: str
    name: str
    role: str
    instructions: str
    tools: list[str]
    version: int
    created_at: str


def agents_by_slug(sb: Client) -> dict[str, AgentRow]:
    rows = (
        sb.table("agents")
        .select("id, slug, name, role, instructions, tools, version, created_at")
        .execute()
        .data
        or []
    )
    return {r["slug"]: r for r in rows}


def start_run(
    sb: Client,
    *,
    agent_id: str,
    trigger_source: str,
    parent_run_id: str | None,
    input: dict[str, Any],
    started_at: str,
    round_id: str | None = None,
    prompt_sha: str | None = None,
    agent_version: int | None = None,
) -> str:
    """Insert a `running` run and return its id, so the tool-call loop's action tools can write
    agent_actions against it mid-run. Finalize with finish_run(). round_id groups the round's runs
    (ADR-0013 P2); omitted when migration 0030 is unapplied so old DBs keep working.
    prompt_sha/agent_version snapshot WHICH prompt produced this run (ADR-0014) — skills/*.md edits
    change behavior without touching agents.version, so runs must pin the resolved prompt identity."""
    row: dict[str, Any] = {
        "agent_id": agent_id,
        "merchant_id": config.MERCHANT_ID,
        "trigger_source": trigger_source,
        "parent_run_id": parent_run_id,
        "status": "running",
        "input": input,
        "transcript": [],
        "started_at": started_at,
    }
    if round_id is not None:
        row["round_id"] = round_id
    if prompt_sha is not None:
        row["prompt_sha"] = prompt_sha
    if agent_version is not None:
        row["agent_version"] = agent_version
    try:
        res = sb.table("agent_runs").insert(row).execute()
    except Exception as e:  # noqa: BLE001 — degrade with intent + log (observability rule)
        if _is_missing_column(e) and ("prompt_sha" in row or "agent_version" in row):
            print("WARN agent_runs.prompt_sha/agent_version missing — apply migration 0031_run_prompt_identity.sql (runs proceed without prompt snapshot)")
            row.pop("prompt_sha", None)
            row.pop("agent_version", None)
            res = sb.table("agent_runs").insert(row).execute()
        else:
            raise
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


# ── rounds + blackboard + memory (ADR-0013 P2) ───────────────────────────────────────────────────

def _is_missing_table(err: Exception) -> bool:
    msg = str(err)
    return "PGRST205" in msg or "does not exist" in msg or "schema cache" in msg


def _is_missing_column(err: Exception) -> bool:
    msg = str(err)
    return "PGRST204" in msg or "does not exist" in msg or "schema cache" in msg


def start_round(sb: Client, merchant_id: str) -> str | None:
    """Open the round row. Degrades to None when migration 0030 is unapplied — the round still runs,
    just without blackboard/round grouping (a loud print, not a silent swallow)."""
    try:
        res = sb.table("agent_rounds").insert({"merchant_id": merchant_id}).execute()
        return res.data[0]["id"]
    except Exception as e:  # noqa: BLE001 — degrade with intent + log (observability rule)
        if _is_missing_table(e):
            print("WARN agent_rounds missing — apply migration 0030_agent_rounds_memory.sql (round runs without blackboard)")
            return None
        raise


def finish_round(sb: Client, round_id: str, *, status: str, blackboard: dict[str, Any]) -> None:
    sb.table("agent_rounds").update(
        {"status": status, "blackboard": blackboard, "finished_at": now_iso()}
    ).eq("id", round_id).execute()


def update_blackboard(sb: Client, round_id: str, blackboard: dict[str, Any]) -> None:
    """Full-object write — the Python orchestrator is the single writer, so no merge expression needed."""
    sb.table("agent_rounds").update({"blackboard": blackboard}).eq("id", round_id).execute()


def fetch_blackboard(sb: Client, round_id: str) -> dict[str, Any]:
    res = sb.table("agent_rounds").select("blackboard").eq("id", round_id).maybe_single().execute()
    return (res.data or {}).get("blackboard", {}) if res else {}


_CAMPAIGN_COLS = "id, merchant_style_id, status, daily_budget_cents, impressions, clicks, bookings, spend_cents, source_run_id, updated_at"
_CAMPAIGN_COLS_V2 = _CAMPAIGN_COLS + ", audience, total_budget_cents, duration_days, version"


def fetch_campaign_outcomes(sb: Client, merchant_id: str) -> list[dict[str, Any]]:
    """Live campaign metrics — the TRUTH memory verdicts must cite, never duplicate (ADR-0013 §3).
    Includes sandbox columns (audience/total budget/version) when 0033 is applied; degrades to the
    legacy shape otherwise."""
    def _q(cols: str):
        return (
            sb.table("style_ad_campaign")
            .select(cols)
            .eq("merchant_id", merchant_id)
            .order("updated_at", desc=True)
            .execute()
        )
    try:
        return _q(_CAMPAIGN_COLS_V2).data or []
    except Exception as e:  # noqa: BLE001 — pre-0033 DBs lack the sandbox columns
        if _is_missing_column(e):
            return _q(_CAMPAIGN_COLS).data or []
        raise


def upsert_memory(sb: Client, row: dict[str, Any]) -> None:
    """Re-measurement replaces the previous verdict for the same (merchant, kind, key) — no stacking."""
    sb.table("agent_memory").upsert(row, on_conflict="merchant_id,kind,key").execute()


def fetch_memory(sb: Client, merchant_id: str, limit: int = 200) -> list[dict[str, Any]]:
    """Non-expired memory rows, newest first. Callers (search_memory's relevance scorer, the
    deterministic hint injector) filter and rank in code — the DB just guarantees active + scoped."""
    res = (
        sb.table("agent_memory")
        .select("id, agent_slug, kind, key, content, claim, domain, scope_type, scope_id, scope_tags, "
                "comparison, applicability, confidence, source_action_id, "
                "entity_type, entity_id, window_start, window_end, created_at, expires_at")
        .eq("merchant_id", merchant_id)
        .or_(f"expires_at.is.null,expires_at.gt.{now_iso()}")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def fetch_round_actions(sb: Client, merchant_id: str, round_id: str) -> list[dict[str, Any]]:
    """This round's execution list — every agent_action written by the round's runs, structured
    (ADR-0014). The monitor's revision edge needs real action ids + entity ids + statuses, and it must
    get them from the table, never from another agent's prose."""
    res = (
        sb.table("agent_actions")
        .select("id, run_id, type, risk, status, payload, entity_type, entity_id, created_at, agent_runs!inner(round_id)")
        .eq("merchant_id", merchant_id)
        .eq("agent_runs.round_id", round_id)
        .order("created_at")
        .order("id")  # same-second actions are common (parallel lanes) — id breaks the tie deterministically
        .execute()
    )
    rows = res.data or []
    for r in rows:
        r.pop("agent_runs", None)  # join artifact — the filter's, not the caller's
    return rows


# ── ad sandbox state (ADR-0016; migration 0033) ──────────────────────────────────────────────────

def fetch_sim_state(sb: Client, merchant_id: str) -> dict[str, Any] | None:
    """The accelerated business clock + scenario seed. None when 0033 is unapplied (degrades loudly
    at the caller — the sandbox is demo infrastructure, not a hidden dependency)."""
    try:
        res = sb.table("sim_state").select("*").eq("merchant_id", merchant_id).maybe_single().execute()
        return res.data if res else None
    except Exception as e:  # noqa: BLE001
        if _is_missing_table(e):
            print("WARN sim_state missing — apply migration 0033_ad_sandbox.sql (clock features disabled)")
            return None
        raise


def set_sim_state(sb: Client, merchant_id: str, *, clock_hours: int, scenario_seed: str | None = None) -> None:
    row: dict[str, Any] = {"merchant_id": merchant_id, "clock_hours": clock_hours, "updated_at": now_iso()}
    if scenario_seed is not None:
        row["scenario_seed"] = scenario_seed
    sb.table("sim_state").upsert(row, on_conflict="merchant_id").execute()


def update_campaign(sb: Client, campaign_id: str, merchant_id: str, fields: dict[str, Any]) -> None:
    """Mutate ONE campaign in place (ADR-0016 state machine — revisions version the same entity,
    they never fork a parallel one)."""
    sb.table("style_ad_campaign").update({**fields, "updated_at": now_iso()}) \
        .eq("id", campaign_id).eq("merchant_id", merchant_id).execute()


def apply_campaign_delivery(sb: Client, campaign_id: str, merchant_id: str, deltas: dict[str, int]) -> None:
    """Accumulate the delivery simulator's deltas onto the campaign row. Single writer (the clock
    advance), so read-modify-write is safe."""
    cur = (
        sb.table("style_ad_campaign")
        .select("impressions, clicks, bookings, spend_cents")
        .eq("id", campaign_id).eq("merchant_id", merchant_id)
        .single().execute().data
    )
    sb.table("style_ad_campaign").update({
        "impressions": (cur["impressions"] or 0) + deltas["impressions"],
        "clicks": (cur["clicks"] or 0) + deltas["clicks"],
        "bookings": (cur["bookings"] or 0) + deltas["bookings"],
        "spend_cents": (cur["spend_cents"] or 0) + deltas["spend_cents"],
        "updated_at": now_iso(),
    }).eq("id", campaign_id).eq("merchant_id", merchant_id).execute()


def fetch_due_actions(sb: Client, merchant_id: str) -> list[dict[str, Any]]:
    """Measurable PAST actions (ADR-0015 two-phase monitor, minimal form): every applied/proposed
    spend action whose campaign has accumulated data. Injected into the monitor beside the current
    round's execution list — a due-outcomes queue without a scheduler. Data presence is the due
    signal; the immature-window gate in record_action_outcome stays the enforcement."""
    campaigns = fetch_campaign_outcomes(sb, merchant_id)
    measurable = [c["id"] for c in campaigns if (c.get("impressions") or 0) > 0]
    if not measurable:
        return []
    res = (
        sb.table("agent_actions")
        .select("id, run_id, type, risk, status, payload, entity_type, entity_id, created_at")
        .eq("merchant_id", merchant_id)
        .in_("entity_id", measurable)
        .in_("status", ["applied", "proposed"])
        .order("created_at")
        .order("id")
        .execute()
    )
    return res.data or []


def fetch_action(sb: Client, action_id: str, merchant_id: str) -> dict[str, Any] | None:
    """One action row — the revision edge (ADR-0013 P3) must read type/risk/entity before acting."""
    res = (
        sb.table("agent_actions")
        .select("id, run_id, type, risk, status, payload, entity_type, entity_id, created_at")
        .eq("id", action_id)
        .eq("merchant_id", merchant_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def supersede_action(sb: Client, action_id: str) -> None:
    """Mark the revised action undone (superseded) — the executor re-run writes the replacement row.
    The entity itself is NOT touched here: the re-run's upsert (stable entity id) is the state change."""
    sb.table("agent_actions").update({"status": "undone"}).eq("id", action_id).execute()


def expire_stale_proposals(sb: Client, *, exclude_run_id: str) -> int:
    """Supersede previous rounds' pending 上架建议 (ADR-0013 P0). A new catalog round REPLACES the
    agent's own older proposals instead of stacking them (25 待确认 pileup): older proposed
    draft_upload actions flip to 'undone' — audit trail kept, pin count stays sane."""
    res = (
        sb.table("agent_actions")
        .update({"status": "undone"})
        .eq("merchant_id", config.MERCHANT_ID)
        .eq("type", "draft_upload")
        .eq("status", "proposed")
        .neq("run_id", exclude_run_id)
        .execute()
    )
    return len(res.data or [])


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
