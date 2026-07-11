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

import hashlib
import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import bus, config, runner, tools

_SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"

# Per-agent tool allow-lists — the orchestrator picks WHO runs; code fixes WHAT each agent may touch.
# Single source shared with the TS seed (src/mock/agent-tools.json) so the agents table's display copy
# can never drift from what the runner actually enforces. The Python service runs from the repo
# checkout, so the cross-package path is a deployment invariant, not a convenience.
_TOOLS_JSON = Path(__file__).resolve().parents[2] / "src" / "mock" / "agent-tools.json"
_AGENT_TOOLS: dict[str, list[str]] = json.loads(_TOOLS_JSON.read_text(encoding="utf-8"))

ORCHESTRATOR_TOOLS = _AGENT_TOOLS["orchestrator"]
LANE_TOOLS: dict[str, list[str]] = {k: v for k, v in _AGENT_TOOLS.items() if k != "orchestrator"}

# Deterministic context routing (ADR-0014): upstream conclusions injected BEYOND the dispatch parent.
# The parent edge gives lineage; the policy gives a lane every conclusion its judgment structurally
# needs — 决策 must see 数分's alerts even when its parent is 选品, and 监测 must see the plan it
# measures against. Executors deliberately stay single-parent: their context is the decision plus
# their own grounded read tools, not the whole round.
CONTEXT_POLICY: dict[str, list[str]] = {
    "decision": ["insight", "trend"],
    "monitor": ["decision"],
}

# Lanes whose tools write agent_actions — after each of these concludes, the round's structured
# execution list is refreshed onto the blackboard (code-written, never LLM prose).
_EXECUTOR_LANES = {"ad", "coupon", "catalog", "customer_ops"}


def _upstream_context(slug: str, parent_slug: str | None, results: dict[str, str]) -> list[tuple[str, str]]:
    """Which upstream conclusions this lane sees: parent first, policy extras after, each once."""
    ordered: list[str] = []
    for s in [parent_slug or "", *CONTEXT_POLICY.get(slug, [])]:
        if s and s in results and s not in ordered:
            ordered.append(s)
    return [(s, results[s]) for s in ordered]


def _execution_context(actions: list[dict]) -> str:
    """The monitor's structured execution list, formatted for injection. Sourced from agent_actions —
    request_revision(action_id) needs real ids, and another agent's prose can't be trusted to carry
    them. Used verbatim by the eval so the judged context format IS the live one."""
    slim = [
        {k: a.get(k) for k in ("id", "type", "status", "risk", "entity_id", "payload")}
        for a in actions
    ]
    return "本轮执行清单（来自 agent_actions；request_revision 用其中的 id 字段）：\n" + json.dumps(
        slim, ensure_ascii=False
    )

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


# ADR-0013 P3: which executor lane owns a revisable action type. Everything else is not revisable —
# published deals and sent messages stay put (the entity-transition contract in the ADR).
_REVISABLE: dict[str, str] = {"place_ad": "ad", "set_group_buy_coupon": "coupon"}
MAX_REVISIONS_PER_ROUND = 2


@dataclass
class RevisionPort:
    """The monitor's ONE bounded interaction edge: reject an action, re-dispatch its executor once with
    feedback. Deterministic guardrails here; the LLM only decides WHETHER the numbers justify it.
    The re-run upserts the SAME entity (stable ids) — a revision never forks a parallel entity."""

    sb: Any
    merchant_id: str
    monitor_run_id: str
    dispatch_fn: Callable[[str, str, str], tuple[str, str]]  # (slug, task, parent_run_id) -> (run_id, text)
    revised_actions: set[str] = field(default_factory=set)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def request(self, action_id: str, feedback: str) -> tuple[str, str]:
        with self._lock:
            if action_id in self.revised_actions:
                raise ValueError("action_already_revised")  # one revision per action per round
            if len(self.revised_actions) >= MAX_REVISIONS_PER_ROUND:
                raise ValueError("revision_budget_exhausted")
            self.revised_actions.add(action_id)
        action = bus.fetch_action(self.sb, action_id, self.merchant_id)
        if not action:
            raise ValueError("action_not_found")
        slug = _REVISABLE.get(action.get("type", ""))
        if slug is None or action.get("risk") != "reversible" or not action.get("entity_id"):
            raise ValueError("action_not_revisable")
        if action.get("status") not in ("applied", "proposed"):
            raise ValueError("action_not_revisable")  # already undone/approved elsewhere
        bus.supersede_action(self.sb, action_id)  # the re-run writes the replacement action row
        task = (
            "监测对你本轮的动作提出了修订要求，请按反馈重新落地（同一款式、同一实体，参数按反馈调整）。\n"
            f"原动作 payload：{json.dumps(action.get('payload', {}), ensure_ascii=False)}\n"
            f"监测反馈：{feedback}"
        )
        return self.dispatch_fn(slug, task, self.monitor_run_id)


def _skill(slug: str, fallback: str) -> str:
    """Load the agent's process skill file we own (agent-service/skills/<slug>.md); fall back to the
    agent row's `instructions` if the file is absent."""
    path = _SKILLS_DIR / f"{slug}.md"
    return path.read_text(encoding="utf-8") if path.exists() else fallback


def _prompt_sha(system: str) -> str:
    """Identity of the resolved system prompt (ADR-0014). agents.version can't version prompts —
    skills/*.md is the prompt truth and editing it leaves the DB untouched; the sha pins which prompt
    text actually produced a run, enabling prompt A/B across eval and live runs."""
    return hashlib.sha256(system.encode("utf-8")).hexdigest()[:16]


def _run_lane_raw(sb, agents: dict, range_days: int, round_id: str | None,
                  slug: str, task: str, parent_run_id: str,
                  revision_port_factory: Callable[[str], "RevisionPort | None"] | None = None,
                  input_extra: dict | None = None) -> tuple[str, str]:
    """The lane-run core: open a running agent_run under an explicit parent, drive the lane's tool loop
    with its fixed allow-list, finalize, return (run_id, final_text). Used by both normal dispatch and
    the revision edge (which parents to the monitor run and bypasses the one-per-agent rule — its own
    RevisionPort guardrails bound it instead)."""
    system = _skill(slug, agents[slug]["instructions"])
    run_id = bus.start_run(
        sb, agent_id=agents[slug]["id"], trigger_source="event",
        parent_run_id=parent_run_id, input=input_extra or {},
        started_at=bus.now_iso(), round_id=round_id,
        prompt_sha=_prompt_sha(system), agent_version=agents[slug].get("version"),
    )
    ctx = tools.RunContext(sb=sb, run_id=run_id, merchant_id=config.MERCHANT_ID,
                           range_days=range_days, round_id=round_id)
    if revision_port_factory is not None:
        ctx.revision = revision_port_factory(run_id)  # monitor only — needs its own run id as parent
    text = runner.run_agent(
        system=system,
        tool_names=LANE_TOOLS[slug], task=task, ctx=ctx,
    )
    status = "awaiting_approval" if ctx.awaiting_approval else "completed"
    bus.finish_run(sb, run_id, output={"text": text}, transcript=ctx.transcript, status=status)
    return run_id, text


def _run_lane(sb, agents: dict, range_days: int, state: RoundState, orch_run_id: str,
              round_id: str | None, slug: str, task: str, parent_slug: str | None) -> tuple[str, str]:
    """One ORCHESTRATOR-dispatched lane run: resolve the symbolic parent, inject the routed upstream
    conclusions verbatim (deterministic context passing per CONTEXT_POLICY, no LLM copying), and — for
    the monitor — inject the round's structured execution list and arm the bounded RevisionPort
    (ADR-0013 P3) whose re-dispatches parent to the monitor's own run."""
    parent_run = state.dispatched.get(parent_slug or "", orch_run_id)
    for src, conclusion in _upstream_context(slug, parent_slug, state.results):
        task = f"{task}\n\n上游「{src}」结论：\n{conclusion[:2500]}"
    if slug == "monitor" and round_id:
        actions = bus.fetch_round_actions(sb, config.MERCHANT_ID, round_id)
        if actions:
            task = f"{task}\n\n{_execution_context(actions)}"

    factory = None
    if slug == "monitor":
        def factory(monitor_run_id: str) -> RevisionPort:
            return RevisionPort(
                sb=sb, merchant_id=config.MERCHANT_ID, monitor_run_id=monitor_run_id,
                dispatch_fn=lambda rslug, rtask, parent: _run_lane_raw(
                    sb, agents, range_days, round_id, rslug, rtask, parent,
                    input_extra={"revisionOf": "see task", "dispatchedBy": monitor_run_id},
                ),
            )

    return _run_lane_raw(
        sb, agents, range_days, round_id, slug, task, parent_run,
        revision_port_factory=factory,
        input_extra={"parentSlug": parent_slug, "dispatchedBy": orch_run_id},
    )


def run_round(range_days: int = 7) -> dict[str, str]:
    config.require_env()
    sb = bus.supabase()
    agents = bus.agents_by_slug(sb)
    missing = (set(LANE_TOOLS) | {"orchestrator"}) - set(agents)
    if missing:
        raise SystemExit(f"agents missing ({', '.join(sorted(missing))}) — run `npm run seed:agents` after migration 0022")

    round_id = bus.start_round(sb, config.MERCHANT_ID)  # None when 0030 unapplied (degrades loudly)
    orch_system = _skill("orchestrator", agents["orchestrator"]["instructions"])
    orch_run = bus.start_run(
        sb, agent_id=agents["orchestrator"]["id"], trigger_source="manual",
        parent_run_id=None, input={"rangeDays": range_days}, started_at=bus.now_iso(), round_id=round_id,
        prompt_sha=_prompt_sha(orch_system), agent_version=agents["orchestrator"].get("version"),
    )
    state = RoundState(dispatch_fn=None)
    blackboard: dict[str, object] = {}

    def _dispatch(slug: str, task: str, parent: str | None) -> tuple[str, str]:
        run_id, text = _run_lane(sb, agents, range_days, state, orch_run, round_id, slug, task, parent)
        if round_id:
            # The blackboard is the round's shared working state, written deterministically by Python
            # as lanes conclude — 决策/监测 hold read_blackboard to consult it mid-run (ADR-0014).
            # `executions` is the one structured section: the round's agent_actions, from the table.
            blackboard[slug] = text[:1500]
            if slug in _EXECUTOR_LANES:
                blackboard["executions"] = bus.fetch_round_actions(sb, config.MERCHANT_ID, round_id)
            bus.update_blackboard(sb, round_id, blackboard)
        return run_id, text

    state.dispatch_fn = _dispatch

    ctx = tools.RunContext(
        sb=sb, run_id=orch_run, merchant_id=config.MERCHANT_ID, range_days=range_days,
        round=state, round_id=round_id,
    )
    try:
        text = runner.run_agent(
            system=orch_system,
            tool_names=ORCHESTRATOR_TOOLS,
            task=ORCH_TASK.format(range_days=range_days),
            ctx=ctx, max_tokens=3000, max_iters=14, model=config.ORCHESTRATOR_MODEL,
        )
        bus.finish_run(sb, orch_run, output={"text": text, "dispatched": dict(state.dispatched)},
                       transcript=ctx.transcript, status="completed")
        if round_id:
            blackboard["orchestrator"] = text[:1500]
            bus.finish_round(sb, round_id, status="completed", blackboard=blackboard)
    except Exception:
        # The round must never leave a forever-`running` orchestrator/round row — the panel polls them.
        bus.finish_run(sb, orch_run, output={"error": "round_failed", "dispatched": dict(state.dispatched)},
                       transcript=ctx.transcript, status="failed")
        if round_id:
            bus.finish_round(sb, round_id, status="failed", blackboard=blackboard)
        raise

    runs = {"orchestrator": orch_run, **state.dispatched}
    skipped = sorted(set(LANE_TOOLS) - set(state.dispatched))
    print("round complete — " + " ".join(f"{k}={v}" for k, v in runs.items())
          + (f" | skipped: {', '.join(skipped)}" if skipped else ""))
    return runs
