"""Full team loop: 数分 → 选品 → 决策 → 投广 → 团购 → 运营(上下架) → 用户运营 → Monitor → 数分'.

Each step runs as a Claude tool-call loop (tool_runner) with its own skill (process prompt) + tool
allow-list. The OUTER sequence is deterministic Python (a fixed, demo-predictable process); INSIDE
each step the agent reasons, calls a tool, reads the result, and loops. Each step opens a `running`
agent_run, runs the loop (tools write agent_actions + transcript steps against it), then finalizes
the run. Runs are parented so the panel renders the loop as a tree; Monitor re-dispatches a short
数分' re-baseline parented to itself, visibly closing the B→C loop (it does NOT recurse)."""
from __future__ import annotations

from pathlib import Path

from . import bus, config, runner, tools

_SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"
_CHAIN = ("insight", "trend", "decision", "ad", "coupon", "catalog", "customer_ops", "monitor")


def _skill(slug: str, fallback: str) -> str:
    """Load the agent's process skill file we own (agent-service/skills/<slug>.md); fall back to the
    agent row's `instructions` if the file is absent."""
    path = _SKILLS_DIR / f"{slug}.md"
    return path.read_text(encoding="utf-8") if path.exists() else fallback


def run_round(range_days: int = 7) -> dict[str, str]:
    config.require_env()
    sb = bus.supabase()
    agents = bus.agents_by_slug(sb)
    for slug in _CHAIN:
        if slug not in agents:
            raise SystemExit(f"agent '{slug}' missing — run `npm run seed:agents` after migration 0022")

    def _step(slug: str, *, trigger: str, parent: str | None, input: dict, tool_names: list[str], task: str) -> tuple[str, str]:
        """Open a running run, drive the agent's tool-call loop, finalize, and return (run_id, final_text).
        A gated tool (propose_listing) sets ctx.awaiting_approval → the run is finalized as
        awaiting_approval instead of completed (ADR-0007 §4, the one human gate)."""
        run_id = bus.start_run(
            sb, agent_id=agents[slug]["id"], trigger_source=trigger,
            parent_run_id=parent, input=input, started_at=bus.now_iso(),
        )
        ctx = tools.RunContext(sb=sb, run_id=run_id, merchant_id=config.MERCHANT_ID, range_days=range_days)
        text = runner.run_agent(
            system=_skill(slug, agents[slug]["instructions"]),
            tool_names=tool_names, task=task, ctx=ctx,
        )
        status = "awaiting_approval" if ctx.awaiting_approval else "completed"
        bus.finish_run(sb, run_id, output={"text": text}, transcript=ctx.transcript, status=status)
        return run_id, text

    # ── 1) 数分: tool-call loop over the grounded briefing (read-only) ──
    insight_run, briefing = _step(
        "insight", trigger="manual", parent=None, input={"rangeDays": range_days},
        tool_names=["get_merchant_insights"],
        task=f"分析最近 {range_days} 天的门店数据并产出简报。先调用 get_merchant_insights 获取数据，再给出 headline、alerts、focusStyleIds。",
    )

    # ── 2) 选品: trend & opportunity — external + internal-rising + platform-hot → match → rank ──
    trend_run, trend_report = _step(
        "trend", trigger="event", parent=insight_run, input={"briefingRunId": insight_run},
        tool_names=["get_trend_opportunities", "get_platform_hot", "get_external_trends"],
        task="产出本周优先级选品机会清单：先调用 get_trend_opportunities，必要时用 get_platform_hot / get_external_trends 佐证；给出按机会分排序的 amplify / price_test / gap / prune 机会。",
    )

    # ── 3) 决策: decide BOTH a 投广 and a 团购 action from the briefing + the 选品 opportunities ──
    decision_run, decision = _step(
        "decision", trigger="event", parent=trend_run,
        input={"briefingRunId": insight_run, "trendRunId": trend_run},
        tool_names=["get_merchant_insights"],
        task=(
            "基于以下简报与选品机会，决定两个精确动作：一个投广 place_ad（款式 id + 漏斗位 + 预算分），"
            "一个团购 set_group_buy_coupon（款式 id + 券后价分）。\n\n简报：\n"
            f"{briefing}\n\n选品机会：\n{trend_report}"
        ),
    )

    # ── 3) 投广: execute the ad action via place_ad ──
    ad_run, _ = _step(
        "ad", trigger="event", parent=decision_run, input={"decisionRunId": decision_run},
        tool_names=["place_ad"],
        task=f"根据以下决策执行投广，调用 place_ad（top_funnel/lower_funnel/mid_funnel + 预算分）。只落地投广那段：\n\n{decision}",
    )

    # ── 4) 团购: execute the coupon action via set_group_buy_coupon ──
    coupon_run, _ = _step(
        "coupon", trigger="event", parent=decision_run, input={"decisionRunId": decision_run},
        tool_names=["set_group_buy_coupon"],
        task=f"根据以下决策执行团购，调用 set_group_buy_coupon（券后价分）。只落地团购那段：\n\n{decision}",
    )

    # ── 5) 运营(上下架): act on 数分's gap/stale signals — list/delist existing, or PROPOSE a gated 上架-new ──
    catalog_run, _ = _step(
        "catalog", trigger="event", parent=insight_run, input={"briefingRunId": insight_run},
        tool_names=["get_merchant_insights", "list_style", "delist_style", "propose_listing"],
        task=f"基于以下简报的品类缺口与无效款式调整在售款式：库内有匹配就 list/delist；缺口在库内无匹配款式则 propose_listing（待批准，不要假装已上架）。\n\n{briefing}",
    )

    # ── 6) 用户运营: read the grounded roster, draft a boss-message, send it to the most-lapsed customer ──
    customer_ops_run, _ = _step(
        "customer_ops", trigger="event", parent=insight_run, input={"source": "roster"},
        tool_names=["get_customer_intelligence", "send_customer_message"],
        task="第一步必须调用 get_customer_intelligence 读取客户名册；挑一位最值得再营销的老客；最后**必须调用 send_customer_message 真正发送**（以老板身份、简短回归消息、可附推荐款式 id）。不要只在文字里描述消息——必须落地为一次 send_customer_message 工具调用。",
    )

    # ── 7) Monitor: read-only, baseline/measure lift on the acted styles (parented to the ad action) ──
    monitor_run, _ = _step(
        "monitor", trigger="event", parent=ad_run, input={"adRunId": ad_run, "couponRunId": coupon_run},
        tool_names=["get_merchant_insights"],
        task=f"本轮已对以下决策中的款式落地投广与团购，请衡量效果并给出 verdict（如无前后对比窗口则如实记录基线）：\n\n{decision}",
    )

    # ── 8) 数分': re-dispatch a short re-baseline insight run, parented to Monitor — closes the loop ──
    loop_run, _ = _step(
        "insight", trigger="event", parent=monitor_run, input={"rebaselineOf": monitor_run},
        tool_names=["get_merchant_insights"],
        task=f"动作落地后重新基线：调用 get_merchant_insights 读取最近 {range_days} 天数据，给出更新后的 headline 与需重点观测的款式。",
    )

    runs = {"insight": insight_run, "trend": trend_run, "decision": decision_run, "ad": ad_run,
            "coupon": coupon_run, "catalog": catalog_run, "customer_ops": customer_ops_run,
            "monitor": monitor_run, "rebaseline": loop_run}
    print("round complete — " + " ".join(f"{k}={v}" for k, v in runs.items()))
    return runs
