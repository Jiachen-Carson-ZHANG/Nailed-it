"""Dynamic round orchestration (ADR-0013 P1) — the orchestrator is an AGENT, not a for-loop.

运营助手 runs its own tool loop: it reads the grounded state (briefing + decision brain), then DECIDES
which lane agents to wake this round via dispatch tools — skipping lanes whose signals say "nothing to
do" (full capacity → no 投广/团购 dispatch; empty opportunity list → no 选品 follow-through), and
fanning independent lanes out in parallel (dispatch_many). Every dispatch/skip lands in the
orchestrator's transcript with a reason, and each dispatched run parents to its upstream run — the
panel's lineage tree renders the round exactly as it was decided.

Division of labor (ADR-0012 §5, unchanged): the LLM chooses WHO runs and WHY; deterministic Python
bounds WHAT is legal — the lane whitelist + per-lane tool allow-lists live here, one dispatch per agent
per round, a hard dispatch budget (config.MAX_DISPATCHES_PER_ROUND), and the per-run tool loops are the
same runner as before. The old fixed chain (数分→选品→决策→投广→团购→上下架→用户运营→监测→数分')
survives as the DEFAULT PLAN in skills/orchestrator.md — deviation requires a citable signal.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import bus, config, runner, tools

_SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"

# Per-lane tool allow-lists — the orchestrator picks WHO runs; code fixes WHAT each lane may touch.
LANE_TOOLS: dict[str, list[str]] = {
    "insight": ["get_merchant_insights"],
    "trend": ["get_trend_opportunities", "get_platform_hot", "get_external_trends"],
    "decision": ["get_style_business_decisions", "get_merchant_insights"],
    "ad": ["place_ad"],
    "coupon": ["set_group_buy_coupon"],
    "catalog": ["get_catalog_actions", "list_style", "delist_style", "propose_listing"],
    "customer_ops": ["get_customer_intelligence", "send_customer_message"],
    "monitor": ["get_merchant_insights"],
}

ORCHESTRATOR_TOOLS = ["get_merchant_insights", "get_style_business_decisions", "dispatch_agent", "dispatch_many"]

ORCH_TASK = (
    "编排今天这一轮门店运营（最近 {range_days} 天窗口）。\n"
    "1) 先自己读数据：get_merchant_insights（简报）＋ get_style_business_decisions（每款分析与全店产能）。\n"
    "2) 按技能中的默认计划分派各 Agent（dispatch_agent / dispatch_many）。数分与决策每轮必须分派；其余环节根据信号决定跳过谁——"
    "跳过也是决策，必须给出可引用的数字理由。\n"
    "3) 相互独立的执行环节用 dispatch_many 并行。\n"
    "4) 最后用中文总结本轮：分派了谁、并行了什么、跳过了谁、为什么。\n"
    "重要：在完成全部分派之前不要输出普通文本——每一步都必须直接调用工具；总结只在最后输出。"
)


@dataclass
class RoundState:
    """The round's dispatch registry + guardrails. The dispatch tools (tools.py) drive this; only the
    orchestrator's RunContext carries one, so no lane agent can dispatch."""

    dispatch_fn: Callable[[str, str, str | None], tuple[str, str]] | None
    budget: int = config.MAX_DISPATCHES_PER_ROUND
    dispatched: dict[str, str] = field(default_factory=dict)  # slug -> run_id
    results: dict[str, str] = field(default_factory=dict)  # slug -> final text
    _taken: set[str] = field(default_factory=set)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _validate(self, slug: str) -> None:
        if slug not in LANE_TOOLS:
            raise ValueError(f"unknown_agent:{slug}")
        if slug in self._taken:
            raise ValueError(f"already_dispatched:{slug}")  # one dispatch per agent per round
        if self.budget <= 0:
            raise ValueError("dispatch_budget_exhausted")

    def reserve(self, slugs: list[str]) -> None:
        """Validate a dispatch_many batch atomically BEFORE any child run starts."""
        with self._lock:
            if len(set(slugs)) != len(slugs):
                raise ValueError("duplicate_agents_in_batch")
            for s in slugs:
                self._validate(s)
            for s in slugs:
                self._taken.add(s)
                self.budget -= 1

    def dispatch(self, slug: str, task: str, parent: str | None, *, reserved: bool = False) -> tuple[str, str]:
        if not reserved:
            with self._lock:
                self._validate(slug)
                self._taken.add(slug)
                self.budget -= 1
        assert self.dispatch_fn is not None
        run_id, text = self.dispatch_fn(slug, task, parent)
        with self._lock:
            self.dispatched[slug] = run_id
            self.results[slug] = text
        return run_id, text


def _skill(slug: str, fallback: str) -> str:
    """Load the agent's process skill file we own (agent-service/skills/<slug>.md); fall back to the
    agent row's `instructions` if the file is absent."""
    path = _SKILLS_DIR / f"{slug}.md"
    return path.read_text(encoding="utf-8") if path.exists() else fallback


def _run_lane(sb, agents: dict, range_days: int, state: RoundState, orch_run_id: str,
              slug: str, task: str, parent_slug: str | None) -> tuple[str, str]:
    """One dispatched lane run: open a running agent_run parented to its upstream, drive the lane's
    tool loop with its fixed allow-list, finalize, return (run_id, final_text). Thread-safe — the
    child sets its own RunContext contextvar inside its worker thread."""
    parent_run = state.dispatched.get(parent_slug or "", orch_run_id)
    if parent_slug and parent_slug in state.results:
        # Deterministic context passing: the upstream conclusion travels verbatim, not via LLM copy.
        task = f"{task}\n\n上游「{parent_slug}」结论：\n{state.results[parent_slug][:2500]}"
    run_id = bus.start_run(
        sb, agent_id=agents[slug]["id"], trigger_source="event",
        parent_run_id=parent_run, input={"parentSlug": parent_slug, "dispatchedBy": orch_run_id},
        started_at=bus.now_iso(),
    )
    ctx = tools.RunContext(sb=sb, run_id=run_id, merchant_id=config.MERCHANT_ID, range_days=range_days)
    text = runner.run_agent(
        system=_skill(slug, agents[slug]["instructions"]),
        tool_names=LANE_TOOLS[slug], task=task, ctx=ctx,
    )
    status = "awaiting_approval" if ctx.awaiting_approval else "completed"
    bus.finish_run(sb, run_id, output={"text": text}, transcript=ctx.transcript, status=status)
    return run_id, text


def run_round(range_days: int = 7) -> dict[str, str]:
    config.require_env()
    sb = bus.supabase()
    agents = bus.agents_by_slug(sb)
    missing = (set(LANE_TOOLS) | {"orchestrator"}) - set(agents)
    if missing:
        raise SystemExit(f"agents missing ({', '.join(sorted(missing))}) — run `npm run seed:agents` after migration 0022")

    orch_run = bus.start_run(
        sb, agent_id=agents["orchestrator"]["id"], trigger_source="manual",
        parent_run_id=None, input={"rangeDays": range_days}, started_at=bus.now_iso(),
    )
    state = RoundState(dispatch_fn=None)
    state.dispatch_fn = lambda slug, task, parent: _run_lane(sb, agents, range_days, state, orch_run, slug, task, parent)

    ctx = tools.RunContext(
        sb=sb, run_id=orch_run, merchant_id=config.MERCHANT_ID, range_days=range_days, round=state,
    )
    try:
        text = runner.run_agent(
            system=_skill("orchestrator", agents["orchestrator"]["instructions"]),
            tool_names=ORCHESTRATOR_TOOLS,
            task=ORCH_TASK.format(range_days=range_days),
            ctx=ctx, max_tokens=3000, max_iters=14, model=config.ORCHESTRATOR_MODEL,
        )
        bus.finish_run(sb, orch_run, output={"text": text, "dispatched": dict(state.dispatched)},
                       transcript=ctx.transcript, status="completed")
    except Exception:
        # The round must never leave a forever-`running` orchestrator row — the panel polls it.
        bus.finish_run(sb, orch_run, output={"error": "round_failed", "dispatched": dict(state.dispatched)},
                       transcript=ctx.transcript, status="failed")
        raise

    runs = {"orchestrator": orch_run, **state.dispatched}
    skipped = sorted(set(LANE_TOOLS) - set(state.dispatched))
    print("round complete — " + " ".join(f"{k}={v}" for k, v in runs.items())
          + (f" | skipped: {', '.join(skipped)}" if skipped else ""))
    return runs
