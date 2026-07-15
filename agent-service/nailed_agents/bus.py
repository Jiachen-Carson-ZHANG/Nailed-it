"""The shared bus: read the grounded briefing from the TS app, read agent definitions from Supabase,
write agent_runs + agent_actions back. No business rules here — just I/O."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
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


def sweep_stale_runs(sb: Client, merchant_id: str, older_than_minutes: int = 30) -> int:
    """Crash hygiene: a process that dies mid-round leaves its runs 'running' in the DB forever —
    there is deliberately no worker/lease/heartbeat system at demo scale (ADR-0007/0013), so the
    sweep at the next round start is the whole recovery story. Marks them failed with a reason the
    UI can show instead of a zombie spinner."""
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)).isoformat()
    try:
        res = (
            sb.table("agent_runs")
            .update({"status": "failed", "finished_at": now_iso(),
                     "output": {"text": "", "error": "stale_run_swept: process died mid-round"}})
            .eq("merchant_id", merchant_id).eq("status", "running").lt("started_at", cutoff)
            .execute()
        )
        n = len(res.data or [])
        if n:
            print(f"WARN swept {n} stale 'running' run(s) → failed (previous process died mid-round)")
        return n
    except Exception as e:  # noqa: BLE001 — hygiene must never block the round itself
        print(f"WARN stale-run sweep failed: {e}")
        return 0


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


_CAMPAIGN_COLS = "id, merchant_style_id, status, daily_budget_cents, impressions, clicks, bookings, spend_cents, source_run_id, created_at, updated_at"
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
        rows = _q(_CAMPAIGN_COLS_V2).data or []
    except Exception as e:  # noqa: BLE001 — pre-0033 DBs lack the sandbox columns
        if _is_missing_column(e):
            rows = _q(_CAMPAIGN_COLS).data or []
        else:
            raise
    # Join the launch-forecast hypothesis (it lives on the place_ad action payload, keyed by the
    # campaign entity, not on the campaign row) so the CAC threshold alarm has its baseline
    # end-to-end — without this only the zero-booking alarm could fire on real data.
    try:
        acts = (
            sb.table("agent_actions")
            .select("entity_id, payload")
            .eq("merchant_id", merchant_id)
            .eq("type", "place_ad")
            .not_.is_("entity_id", "null")
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        ).data or []
        hyp_by_campaign: dict[str, Any] = {}
        for a in acts:
            cid, h = a.get("entity_id"), (a.get("payload") or {}).get("hypothesis")
            if cid and cid not in hyp_by_campaign and isinstance(h, dict):
                hyp_by_campaign[str(cid)] = h
        for c in rows:
            h = hyp_by_campaign.get(str(c.get("id")))
            if h:
                band = h.get("expectedCostPerBookingCents") or []
                low = band[0] if isinstance(band, list) and band else None
                if isinstance(low, (int, float)) and low > 0:
                    c["hypothesis_cac_low_cents"] = low
    except Exception:  # noqa: BLE001 — the join is enrichment; campaign truth must still return
        print("WARN hypothesis join failed — CAC alarm degraded to zero-booking only")
    return rows


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


def update_campaign_versioned(
    sb: Client,
    campaign_id: str,
    merchant_id: str,
    fields: dict[str, Any],
    *,
    expected_version: int,
) -> None:
    """Compare-and-swap update for managed executor jobs (ADR-0017).

    Worker-pool writes must not overwrite a merchant/manual edit or another executor's newer revision.
    The synchronous demo path still uses update_campaign(); managed jobs should use this helper.
    """
    res = (
        sb.table("style_ad_campaign")
        .update({**fields, "updated_at": now_iso()})
        .eq("id", campaign_id)
        .eq("merchant_id", merchant_id)
        .eq("version", expected_version)
        .execute()
    )
    if not (res.data or []):
        raise ValueError(f"entity_version_conflict:{campaign_id}:expected={expected_version}")


_GROUPBUY_COLS = (
    "id, merchant_id, title, status, original_price_cents, deal_price_cents, currency, "
    "source_run_id, created_at, updated_at"
)
_GROUPBUY_COLS_V2 = (
    _GROUPBUY_COLS
    + ", version, published_at, unlisted_at, redemptions, bookings, revenue_cents, refunds, next_review_at"
)


def fetch_groupbuy_outcomes(sb: Client, merchant_id: str) -> list[dict[str, Any]]:
    """Live group-buy entity metrics for managed post-publish monitoring.

    The P2 outcome/version columns are optional during rollout; pre-0034 rows degrade to version=1
    with zero measured outcomes so monitors can record a baseline but cannot invent a failure.
    """
    def _q(cols: str):
        return (
            sb.table("groupbuy_deal")
            .select(cols)
            .eq("merchant_id", merchant_id)
            .order("updated_at", desc=True)
            .execute()
        )
    try:
        return _q(_GROUPBUY_COLS_V2).data or []
    except Exception as e:  # noqa: BLE001 — pre-0034 DBs lack outcome/version columns
        if not _is_missing_column(e):
            raise
        rows = _q(_GROUPBUY_COLS).data or []
        for row in rows:
            row.setdefault("version", 1)
            row.setdefault("redemptions", 0)
            row.setdefault("bookings", 0)
            row.setdefault("revenue_cents", 0)
            row.setdefault("refunds", 0)
        return rows


def update_groupbuy_versioned(
    sb: Client,
    deal_id: str,
    merchant_id: str,
    fields: dict[str, Any],
    *,
    expected_version: int,
) -> None:
    """Compare-and-swap update for managed group-buy executor jobs."""
    res = (
        sb.table("groupbuy_deal")
        .update({**fields, "updated_at": now_iso()})
        .eq("id", deal_id)
        .eq("merchant_id", merchant_id)
        .eq("version", expected_version)
        .execute()
    )
    if not (res.data or []):
        raise ValueError(f"entity_version_conflict:{deal_id}:expected={expected_version}")


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


# Evidence-maturity gate (mirrors monitor.md): a campaign is judgeable once its observation window is
# ≥24h old, OR it accumulated ≥500 impressions, OR ≥15 clicks. `impressions > 0` alone made one
# stray impression look "due" — the skill said 24h/500/15 but no code enforced it.
_MATURITY_MIN_HOURS = 24
_MATURITY_MIN_IMPRESSIONS = 500
_MATURITY_MIN_CLICKS = 15


def _evidence_mature(campaign: dict[str, Any]) -> bool:
    imp = int(campaign.get("impressions") or 0)
    clicks = int(campaign.get("clicks") or 0)
    if imp >= _MATURITY_MIN_IMPRESSIONS or clicks >= _MATURITY_MIN_CLICKS:
        return True
    if imp <= 0:
        return False
    started = campaign.get("created_at") or campaign.get("updated_at")
    if not started:
        return False
    try:
        from datetime import datetime, timezone
        age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(str(started).replace("Z", "+00:00"))).total_seconds() / 3600
        return age_h >= _MATURITY_MIN_HOURS
    except Exception:  # noqa: BLE001 — unparseable timestamp: fall back to "has data"
        return True


def fetch_due_actions(sb: Client, merchant_id: str) -> list[dict[str, Any]]:
    """Measurable PAST actions (ADR-0015 two-phase monitor): every applied/proposed spend action whose
    campaign's observation window has MATURED (≥24h, or ≥500 impressions, or ≥15 clicks — the same
    thresholds monitor.md states). Injected into the monitor beside the current round's execution
    list; the immature-window gate in record_action_outcome stays the enforcement."""
    campaigns = fetch_campaign_outcomes(sb, merchant_id)
    measurable = [c["id"] for c in campaigns if _evidence_mature(c)]
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
    actions = res.data or []
    # Cross-round idempotency (P0): drop actions already evaluated — an action_outcome memory row keyed
    # by the action id means the monitor already measured it. Without this, evidence_matured re-fires a
    # monitor round for the same action every cron tick (a revision creates a NEW action id, which is
    # correctly still due). This is the 幂等键 that makes evidence_matured safe to poll repeatedly.
    evaluated = evaluated_action_ids(sb, merchant_id)
    return [a for a in actions if a["id"] not in evaluated]


def evaluated_action_ids(sb: Client, merchant_id: str) -> set[str]:
    """Action ids the monitor has already recorded an outcome for (agent_memory kind='action_outcome',
    key=action_id) — the idempotency key set for evidence_matured de-duplication."""
    res = (
        sb.table("agent_memory")
        .select("key")
        .eq("merchant_id", merchant_id)
        .eq("kind", "action_outcome")
        .execute()
    )
    return {r["key"] for r in (res.data or []) if r.get("key")}


_ACTIVE_ROUND_STALE_MINUTES = 15  # rounds complete in minutes; an unfinished one older than this is a
                                  # crash-zombie, not a live round — ignore it so the guard can't wedge.


def has_active_round(sb: Client, merchant_id: str) -> bool:
    """Is a round already in flight for this merchant? Cross-round concurrency guard (P0): cron + manual
    button (or two cron ticks) must not run overlapping rounds. Counts an unfinished round only if it
    started RECENTLY — an older unfinished row is a crashed round, not a live one, so the guard never
    wedges. Best-effort (a true DB advisory lock is the production hardening)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=_ACTIVE_ROUND_STALE_MINUTES)).isoformat()
    try:
        res = (
            sb.table("agent_rounds")
            .select("id")
            .eq("merchant_id", merchant_id)
            .is_("finished_at", "null")
            .gte("started_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:  # noqa: BLE001 — never block a round on a lock-check failure; log + proceed
        print(f"WARN has_active_round check failed ({e}) — proceeding")
        return False


def trigger_fingerprint(kind: str, entity_id: str | None) -> str:
    """The idempotency key for a trigger: what fired, on what. cadence has no entity → global."""
    return f"{kind}:{entity_id or 'global'}"


def trigger_fired_recently(sb: Client, merchant_id: str, fingerprint: str, cooldown_minutes: int) -> bool:
    """Has a round already fired for this exact trigger fingerprint (kind:entity) within the cooldown?
    Cross-round cooldown (P0): a threshold_alarm that stays red, or evidence that stays mature, must not
    re-fire a round every cron tick (event storm). The ROUND ROW is the record — each triggered round
    stamps its fingerprint into agent_rounds.blackboard.triggerFingerprint, so no separate store is
    needed. Best-effort: a read failure de-dupes nothing (fail-open — never swallow a real alarm)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)).isoformat()
    try:
        res = (
            sb.table("agent_rounds")
            .select("id")
            .eq("merchant_id", merchant_id)
            .eq("blackboard->>triggerFingerprint", fingerprint)
            .gte("started_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:  # noqa: BLE001
        print(f"WARN trigger cooldown check failed ({e}) — not de-duping")
        return False


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


def deliver_customer_message(
    sb: Client, customer_name: str, body: str, attachment: dict[str, Any] | None = None
) -> None:
    """Best-effort: also drop the AI-sent message into the customer's chat thread, so the merchant sees
    it in the conversation window — not only in the agent action log. Non-fatal: the agent_action stays
    the authoritative record; if there's no thread for this customer (or the write fails) we log and
    move on rather than break the send. `attachment` (optional) is a style card jsonb the chat renders
    as a photo — same shape the TS conversation repo reads (migration 0019)."""
    try:
        res = sb.table("conversation_threads").select("id").eq("customer_name", customer_name).limit(1).execute()
        rows = res.data or []
        if not rows:
            print(f"WARN no chat thread for {customer_name} — message recorded as action only")
            return
        row = {
            "id": f"msg-ai-{uuid.uuid4().hex[:12]}",
            "thread_id": rows[0]["id"],
            "author_role": "merchant",  # sent by the shop side, AI-authored (body carries the 商家助手 label)
            "body": body,
            "sent_at": now_iso(),
        }
        if attachment:
            row["attachment"] = attachment  # nullable column — plain text messages omit it
        sb.table("messages").insert(row).execute()
    except Exception as e:  # noqa: BLE001 — delivery is best-effort; never fail the send over the chat mirror
        print(f"WARN deliver_customer_message failed for {customer_name}: {e}")
