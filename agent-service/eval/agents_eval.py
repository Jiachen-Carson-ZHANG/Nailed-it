"""Agent-eval harness (docs/eval multi-agent framework; ADR-0010). Phase A + B + C.

Per-agent scenarios over STUBBED fixtures (bus.fetch_* + bus.write_action monkeypatched — deterministic,
no dev server). Runs the real tool-call loop (runner.run_agent) N times and scores the blocking gates:
  - tool-call correctness — from ctx.tool_attempts (the recorder): every ATTEMPT allow-listed + executed
                            without error (catches invalid-arg calls that never reach the transcript).
  - scenario expectation  — read agents (trend) → an opportunity in the tool output; action agents →
                            a captured agent_action of the right type+target.
  - negative assertion    — forbidden action/target must NOT occur (e.g. don't delist the low-conv style).
  - grounding (narrow)    — every style-id cited in the final text / actions must trace to the fixture or a
                            tool output (no invented ids). Numeric grounding deferred.
  - 4/4 stability         — the structured decision SIGNATURE (not prose) is identical across the N runs.

Run:  cd agent-service && PYTHONPATH=. .venv/bin/python eval/agents_eval.py [--n 4]
"""
from __future__ import annotations

import argparse
import contextlib
import json
import re
from dataclasses import dataclass, field
from typing import Any
from pathlib import Path

from nailed_agents import bus, config, runner, tools
from nailed_agents.orchestrator import LANE_TOOLS, ORCHESTRATOR_TOOLS

_SKILLS = Path(__file__).resolve().parents[1] / "skills"
_M = "merchant-nailed-it"
_ID_RE = re.compile(r"style-[\w-]+")

# deterministic + offline: CN fixture external trends (no live Pinterest), tag matching (concept needs an
# enriched DB). The tool_attempts recorder only covers the OpenAI-compatible loop — "openrouter" or
# "gemini" (direct Google endpoint, the credit fallback) both qualify; only anthropic is forced off.
config.TREND_SOURCE = "fixture"
config.MATCH_MODE = "tag"
if config.MODEL_PROVIDER not in ("openrouter", "gemini"):
    config.MODEL_PROVIDER = "openrouter"

# the explicit target field per action type — compare THIS field, not a substring of the whole payload
# (a message body mentioning "Rachel" must not satisfy a customerName target).
_TARGET_FIELD = {
    "send_customer_message": "customerName", "draft_customer_message": "customerName",
    "delist_style": "styleId", "list_style": "styleId",
    "feature_style": "styleId", "deprioritize_style": "styleId",
    "set_group_buy_coupon": "styleId", "place_ad": "styleId",
    "draft_upload": "gapTag", "propose_listing": "gapTag",
}
# the tool ARG that names a target we can ground against the fixture
_ARG_STYLE, _ARG_CUSTOMER = "style_id", "customer_name"


def _action_target(a: dict) -> str:
    return str(a.get("payload", {}).get(_TARGET_FIELD.get(a.get("action_type"), ""), ""))

_STYLES = [
    {"id": "style-melissa-img-8284", "title": "鎏金奢华", "merchantId": _M, "tags": ["金属感", "裸色", "银色"]},
    {"id": "style-melissa-img-8265", "title": "极光法式碎钻", "merchantId": _M, "tags": ["法式风", "裸色"]},
    {"id": "style-melissa-img-8277", "title": "焦糖布丁布丁狗", "merchantId": _M, "tags": ["卡通", "黄色"]},
]
_LOWCONV_BRIEFING = {
    "designPerformance": {
        "styles": [{"styleId": "style-melissa-img-8277", "title": "焦糖布丁布丁狗", "tryOns": 8, "conversionRate": 0.0}],
        "highInterestLowConversion": [{"styleId": "style-melissa-img-8284"}],
    },
    "demandTrends": [{"label": "金属感", "direction": "up", "current": 200, "previous": 100, "delta": 100}],
}
_ROSTER = [
    {"name": "Rachel Goh", "lastVisitDaysAgo": 40, "tags": ["甜美", "可爱"]},
    {"name": "Melissa Tan", "lastVisitDaysAgo": 3, "tags": ["法式风"]},
]


@dataclass
class Scenario:
    id: str
    slug: str
    tools: list[str]
    task: str
    briefing: dict = field(default_factory=dict)
    styles: list = field(default_factory=lambda: list(_STYLES))
    customers: list = field(default_factory=list)
    decisions: dict = field(default_factory=dict)  # the decision brain's output (ADR-0012)
    # ADR-0013 P1: canned lane conclusions for orchestrator scenarios — dispatch returns these instead of
    # running a real child loop, so the eval judges the ORCHESTRATION decision, not the lanes.
    lane_results: dict = field(default_factory=dict)
    # ADR-0013 P2/P3 monitor scenarios: canned live campaign metrics + the round's actions by id.
    campaigns: list = field(default_factory=list)
    actions_by_id: dict = field(default_factory=dict)
    # ADR-0016 §2: Action Briefs injected into executor scenarios (via the LIVE _brief_context
    # formatter) and enforced by ctx.briefs exactly as in production.
    briefs: list = field(default_factory=list)
    # {'kind':'opportunity'|'action'|'no_action'|'dispatch'} — 'no_action' asserts the agent correctly did
    # NOTHING; 'dispatch' asserts who was (not) dispatched: {'must': [...], 'forbid_dispatch': [...]}
    expect: dict = field(default_factory=dict)
    forbid: list[dict] = field(default_factory=list)  # [{'action_type','target'}] must NOT occur


SCENARIOS = [
    Scenario(
        id="trend/8284-low-conversion", slug="trend",
        tools=LANE_TOOLS["trend"],
        task="产出本周优先级选品机会清单：先调用 get_trend_opportunities，给出按机会分排序的 amplify / price_test / gap / prune 机会。",
        briefing=_LOWCONV_BRIEFING,
        expect={"kind": "opportunity", "action": "price_test", "target": "style-melissa-img-8284"},
    ),
    # ADR-0016 Stage 3: a win-back is RELATIONSHIP marketing → merchant draft, never an auto-send.
    Scenario(
        id="customer_ops/lapsed-rachel-draft", slug="customer_ops",
        tools=LANE_TOOLS["customer_ops"],
        task="读取客户名册，为最值得再营销的一位老客准备本轮触达（判断消息类型并走对应通道）。",
        customers=_ROSTER,
        expect={"kind": "action", "action_type": "draft_customer_message", "target": "Rachel Goh"},
        forbid=[{"action_type": "draft_customer_message", "target": "Melissa Tan"},   # active customer
                {"action_type": "send_customer_message", "target": "Rachel Goh"}],     # no auto-send win-backs
    ),
    Scenario(
        id="catalog/dead-8277-deprioritized", slug="catalog",
        tools=LANE_TOOLS["catalog"],
        task="先调用 get_catalog_actions；对 deprioritize[] 中每个款调用 deprioritize_style；对 propose[] 中每个缺口调用 propose_listing。只执行清单里的候选，不要自行判断。",
        briefing=_LOWCONV_BRIEFING,
        expect={"kind": "action", "action_type": "deprioritize_style", "target": "style-melissa-img-8277"},
        forbid=[{"action_type": "deprioritize_style", "target": "style-melissa-img-8284"}],  # high-interest low-conv → keep
    ),
    # ADR-0016 Stage 3: the coupon agent's judgment is the RESTRICTIONS — template + window + count —
    # never the price (code computes it) and never a promised booking figure.
    Scenario(
        id="coupon/template-restrictions", slug="coupon",
        tools=LANE_TOOLS["coupon"],
        task="根据注入的行动简报处理本轮团购。",
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "very_idle", "utilizationPct": 40},
                   "decisions": [{"styleId": "style-melissa-img-8284", "durationMin": 60, "priceCents": 8800,
                                  "coupon": {"floorPriceCents": 6000, "referencePriceCents": 7040},
                                  "ad": {}}]},
        # the target audience is EXISTING try-on prospects — the new-customer template mismatches, and
        # the skill says pick the mildest template that meets the goal → weekday_10_off is the one
        # right answer; window/count stay judged too.
        briefs=[{"action_type": "coupon", "style_id": "style-melissa-img-8284",
                 "objective": "用受限团购把高意向零成单款的已试戴客户转成工作日下午预约，保护周末原价",
                 "max_total_budget_cents": 6000, "target_bookings_min": 2, "target_bookings_max": 4,
                 "allowed_period": "weekday",
                 "notes": "受众为已试戴未预约的意向客户（非新客拉新），用最温和且够用的折扣"}],
        expect={"kind": "action", "action_type": "set_group_buy_coupon", "target": "style-melissa-img-8284",
                "sig_keys": ["styleId", "templateId", "redemptionWindow"]},
    ),
    # ADR-0016: no brief → no action. The 投广 agent must not spend just because it has the tools.
    Scenario(
        id="ad/no-brief-skip", slug="ad",
        tools=LANE_TOOLS["ad"],
        task=(
            "处理本轮投广。\n\n（决策本轮未提交属于你的行动简报——若上游结论也未指明动作，"
            "不要调用任何执行工具，说明本轮不投广。）\n\n[上游结论 — decision｜仅作证据]\n"
            "本轮不采取投广：下周产能利用率 91%（full），买来的流量接不住。\n[/上游结论]"
        ),
        briefing=_LOWCONV_BRIEFING,
        expect={"kind": "no_action"},
        forbid=[{"action_type": "place_ad", "target": "style-melissa-img-8284"}],
    ),
    # ADR-0016: the brief's objective is UNREACHABLE inside its budget ceiling — the agent must report
    # infeasible with forecast evidence, never place a hopeless campaign or breach the ceiling.
    Scenario(
        id="ad/brief-infeasible-report", slug="ad",
        tools=LANE_TOOLS["ad"],
        task="根据注入的行动简报处理本轮投广。",
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "very_idle", "utilizationPct": 40},
                   "decisions": [{"styleId": "style-melissa-img-8284", "durationMin": 60, "priceCents": 8800,
                                  "signals": ["high_demand", "low_conversion"],
                                  "ad": {"clickToBookingRate": 0.02, "expectedProfitPerBookingCents": 6000}}]},
        briefs=[{"action_type": "ad", "style_id": "style-melissa-img-8284",
                 "objective": "为高需求低转化款增加工作日预约", "max_total_budget_cents": 3000,
                 "target_bookings_min": 4, "target_bookings_max": 6,
                 "max_cost_per_booking_cents": 2500, "allowed_period": "weekday"}],
        expect={"kind": "no_action"},
        forbid=[{"action_type": "place_ad", "target": "style-melissa-img-8284"}],
    ),
    # ADR-0016: the agent must find the viable configuration itself — broad traffic fails the CAC
    # ceiling in forecast; retargeting reaches the target. Judged: it places ON the briefed style with
    # the retargeting audience (sig pins audience + style, not the budget it happens to pick).
    Scenario(
        id="ad/retargeting-beats-broad", slug="ad",
        tools=LANE_TOOLS["ad"],
        task="根据注入的行动简报处理本轮投广。先比较候选方案的预测，再落地你选中的方案。",
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "very_idle", "utilizationPct": 40},
                   "decisions": [{"styleId": "style-melissa-img-8265", "durationMin": 70, "priceCents": 20000,
                                  "signals": ["high_profit_per_hour", "high_conversion", "underexposed"],
                                  "ad": {"clickToBookingRate": 0.06, "expectedProfitPerBookingCents": 15000}}]},
        # target 4-6 + CAC ≤2200 makes try_on_no_booking the ONLY audience whose forecast clears both
        # (saved_or_viewed fails CAC at the budget that reaches 4 bookings; broad fails everything) —
        # the judged decision is deterministic, the budget within it is legitimately the agent's.
        briefs=[{"action_type": "ad", "style_id": "style-melissa-img-8265",
                 "objective": "放大高利润高转化但曝光不足的款，增加工作日预约", "max_total_budget_cents": 12000,
                 "target_bookings_min": 4, "target_bookings_max": 6,
                 "max_cost_per_booking_cents": 2200, "allowed_period": "weekday"}],
        expect={"kind": "action", "action_type": "place_ad", "target": "style-melissa-img-8265",
                "sig_keys": ["styleId", "audience"]},
        forbid=[{"action_type": "place_ad", "target": "style-melissa-img-8284"}],
    ),
    # ADR-0016 §2: 决策 turns facts+signals into BRIEFS — ad brief for the underexposed earner, no
    # coupon brief for the style whose discount cannot clear the profit floor.
    Scenario(
        id="decision/briefs-underexposed-ad", slug="decision",
        tools=LANE_TOOLS["decision"],
        task=(
            "为本轮制定行动组合并用 submit_action_brief 提交行动简报（最近 7 天窗口）。\n\n"
            "[上游结论 — insight｜仅作证据]\n简报：8265 转化率高于店铺均值，但曝光只有平均款式的 62%；"
            "8284 高意向零成单（61 次点击 0 预约）。\n[/上游结论]\n\n"
            "[上游结论 — trend｜仅作证据]\n放大机会：8265（高转化低曝光）。\n[/上游结论]"
        ),
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "very_idle", "utilizationPct": 40, "largestGapMin": 300},
                   "decisions": [
                       {"styleId": "style-melissa-img-8265", "styleTitle": "极光法式碎钻",
                        "durationMin": 70, "priceCents": 20000,
                        "scores": {"businessValue": 85, "demand": 72, "conversion": 78, "capacityFit": 90},
                        "signals": ["high_profit_per_hour", "high_conversion", "high_demand",
                                     "underexposed", "roas_above_target", "fits", "idle_capacity"],
                        "ad": {"expectedRoas": 5.2, "exposureRatio": 0.62, "costPerBookingCents": 900,
                               "clickToBookingRate": 0.2, "expectedProfitPerBookingCents": 15000},
                        "coupon": {"referencePriceCents": 16000, "profitPerHourAtReferenceCents": 9000,
                                    "floorPriceCents": 9000, "referenceAboveFloor": True}},
                       {"styleId": "style-melissa-img-8284", "styleTitle": "鎏金奢华",
                        "durationMin": 60, "priceCents": 8800,
                        "scores": {"businessValue": 60, "demand": 75, "conversion": 12, "capacityFit": 90},
                        "signals": ["high_demand", "low_conversion", "roas_unknown", "exposure_unknown",
                                     "fits", "idle_capacity", "below_coupon_floor"],
                        "ad": {"expectedRoas": None, "exposureRatio": None, "costPerBookingCents": None,
                               "clickToBookingRate": None, "expectedProfitPerBookingCents": None},
                        "coupon": {"referencePriceCents": 7040, "profitPerHourAtReferenceCents": 800,
                                    "floorPriceCents": None, "referenceAboveFloor": False}},
                   ]},
        expect={"kind": "brief", "must": [{"action_type": "ad", "style_id": "style-melissa-img-8265"}],
                "forbid_briefs": [{"action_type": "coupon", "style_id": "style-melissa-img-8284"},
                                   {"action_type": "ad", "style_id": "style-melissa-img-8284"}]},
    ),
    # ADR-0016 Stage 2: the reviewer must flag the exact conflict we hit live (coupon + delist-class
    # move on one style → attribution/self-contradiction) and route it back, NOT rubber-stamp.
    Scenario(
        id="reviewer/conflicting-briefs-flagged", slug="reviewer",
        tools=LANE_TOOLS["reviewer"],
        task=(
            "审查本轮行动简报组合的软风险，按技能输出裁决。\n\n[上游结论 — decision｜仅作证据]\n"
            "本轮对 8284 同时投广（放大流量）并设团购（试价转化），预算合计 150 元。\n[/上游结论]"
        ),
        briefing=_LOWCONV_BRIEFING,
        briefs=[
            {"action_type": "ad", "style_id": "style-melissa-img-8284", "objective": "放大流量",
             "max_total_budget_cents": 9000, "target_bookings_min": 2, "target_bookings_max": 4,
             "max_cost_per_booking_cents": 2500, "allowed_period": "weekday"},
            {"action_type": "coupon", "style_id": "style-melissa-img-8284", "objective": "试价转化",
             "max_total_budget_cents": 6000, "target_bookings_min": 2, "target_bookings_max": 4,
             "max_cost_per_booking_cents": 2500, "allowed_period": "weekday"},
        ],
        expect={"kind": "final_regex", "pattern": r"\[(REVISION_REQUIRED|APPROVED_WITH_CONDITIONS)\]"},
    ),
    # …and must approve a clean single-action plan instead of inventing objections.
    Scenario(
        id="reviewer/clean-plan-approved", slug="reviewer",
        tools=LANE_TOOLS["reviewer"],
        task=(
            "审查本轮行动简报组合的软风险，按技能输出裁决。\n\n[上游结论 — decision｜仅作证据]\n"
            "仅一项动作：8265 投广，理由 ROAS 5.2、曝光占比 0.62、下周产能 40%，预算上限 90 元（周末受保护）。\n[/上游结论]"
        ),
        briefing=_LOWCONV_BRIEFING,
        briefs=[
            {"action_type": "ad", "style_id": "style-melissa-img-8265", "objective": "放大高转化低曝光款",
             "max_total_budget_cents": 9000, "target_bookings_min": 3, "target_bookings_max": 5,
             "max_cost_per_booking_cents": 2200, "allowed_period": "weekday"},
        ],
        expect={"kind": "final_regex", "pattern": r"\[APPROVED\]"},
    ),
    # ADR-0013 P1: the ORCHESTRATOR must skip the spend lanes when capacity is full — dispatching 投广/团购
    # into a salon that cannot serve the demand is the exact failure the dynamic layer exists to prevent.
    Scenario(
        id="orchestrator/full-capacity-skips-spend", slug="orchestrator",
        tools=ORCHESTRATOR_TOOLS,
        task="编排今天这一轮门店运营（最近 7 天窗口）。1) 先自己读数据：get_merchant_insights ＋ get_style_business_facts。2) 按技能中的默认计划分派各 Agent（dispatch_agent / dispatch_many）。数分（insight）与决策（decision）每轮必须分派；执行/监测环节可依信号跳过——跳过必须给出可引用的数字理由。3) 相互独立的执行环节用 dispatch_many 并行。4) 最后总结：分派了谁、跳过了谁、为什么。重要：完成全部分派之前不要输出普通文本——每一步都必须直接调用工具；总结只在最后输出。",
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "full", "utilizationPct": 91, "largestGapMin": 30},
                   "decisions": [{"candidate": "display_only"}, {"candidate": "skip"}]},
        lane_results={
            "insight": "简报：本周订单量稳定，无异常告警。",
            "trend": "本周无高优先选品机会。",
            "decision": "本轮不采取投广与团购：下周产能利用率 91%（full），买来的流量接不住，低价团购会挤占产能。",
            "catalog": "无上下架候选。", "customer_ops": "已向一位老客发送召回消息。", "monitor": "已记录基线。",
        },
        expect={"kind": "dispatch", "must": ["insight", "decision"], "forbid_dispatch": ["ad", "coupon"]},
    ),
    # …and must dispatch exactly the lanes the decision chose when capacity is idle (ad yes, coupon no).
    Scenario(
        id="orchestrator/dispatches-chosen-lanes", slug="orchestrator",
        tools=ORCHESTRATOR_TOOLS,
        task="编排今天这一轮门店运营（最近 7 天窗口）。1) 先自己读数据：get_merchant_insights ＋ get_style_business_facts。2) 按技能中的默认计划分派各 Agent（dispatch_agent / dispatch_many）。数分（insight）与决策（decision）每轮必须分派；执行/监测环节可依信号跳过——跳过必须给出可引用的数字理由。3) 相互独立的执行环节用 dispatch_many 并行。4) 最后总结：分派了谁、跳过了谁、为什么。重要：完成全部分派之前不要输出普通文本——每一步都必须直接调用工具；总结只在最后输出。",
        briefing=_LOWCONV_BRIEFING,
        decisions={"capacity": {"band": "very_idle", "utilizationPct": 33, "largestGapMin": 300},
                   "decisions": [{"candidate": "ad"}, {"candidate": "display_only"}]},
        lane_results={
            "insight": "简报：本周试戴量上升，转化偏低。",
            "trend": "一个放大机会：高转化款曝光不足。",
            "decision": "本轮投广 1 款（首页推荐位，日预算 5000 分，ROAS 4.1、曝光占比 0.61）；不做团购：所有团购候选 ROAS 无法测算（零成单），不投。",
            "catalog": "无上下架候选。", "customer_ops": "已向一位老客发送召回消息。", "monitor": "已记录基线。",
        },
        expect={"kind": "dispatch", "must": ["insight", "decision", "ad"], "forbid_dispatch": ["coupon"]},
    ),
    # ADR-0013 P3: the monitor must revise EXACTLY the action whose measured numbers contradict it —
    # a live campaign burning budget at measured ROAS 1.2 with the round's decision estimating 4.1.
    Scenario(
        id="monitor/overspending-ad-revised-once", slug="monitor",
        tools=LANE_TOOLS["monitor"],  # the real allow-list — scenario lists must not drift from it
        task=(
            "本轮已落地投广动作（款式 style-melissa-img-8284，日预算 20000 分，决策时估算 ROAS 4.1）。"
            "请读取实测活动数据，写入记忆结论；若实测数字明确违背该动作，"
            "用 request_revision 修订它（feedback 要具体带数字）。"
        ),
        briefing=_LOWCONV_BRIEFING,
        campaigns=[{"id": "ad-style-melissa-img-8284", "merchant_style_id": "style-melissa-img-8284",
                    "status": "active", "daily_budget_cents": 20000, "impressions": 4000, "clicks": 120,
                    "bookings": 2, "spend_cents": 56000}],
        actions_by_id={"act-ad-8284": {"id": "act-ad-8284", "type": "place_ad", "risk": "reversible",
                                        "status": "applied", "entity_id": "ad-style-melissa-img-8284",
                                        "payload": {"styleId": "style-melissa-img-8284", "budgetCents": 20000,
                                                    "hypothesis": {"expectedRoas": 4.1, "costPerBookingCents": 8000}}}},
        expect={"kind": "revision", "must_revise": ["act-ad-8284"]},
    ),
    # …and must NOT revise when the measured numbers support the action (trigger-happy monitor = failure).
    Scenario(
        id="monitor/healthy-ad-no-revision", slug="monitor",
        tools=LANE_TOOLS["monitor"],
        task=(
            "本轮已落地投广动作（款式 style-melissa-img-8265，日预算 5000 分，决策时估算 ROAS 4.0）。"
            "请读取实测活动数据，写入记忆结论；仅当实测数字明确违背该动作时才修订。"
        ),
        briefing=_LOWCONV_BRIEFING,
        campaigns=[{"id": "ad-style-melissa-img-8265", "merchant_style_id": "style-melissa-img-8265",
                    "status": "active", "daily_budget_cents": 5000, "impressions": 3000, "clicks": 150,
                    "bookings": 9, "spend_cents": 15000}],
        actions_by_id={"act-ad-8265": {"id": "act-ad-8265", "type": "place_ad", "risk": "reversible",
                                        "status": "applied", "entity_id": "ad-style-melissa-img-8265",
                                        "payload": {"styleId": "style-melissa-img-8265", "budgetCents": 5000,
                                                    "hypothesis": {"expectedRoas": 4.0, "costPerBookingCents": 9000}}}},
        expect={"kind": "no_revision"},
    ),
]


@contextlib.contextmanager
def _stub_bus(scn: Scenario, captured: list[dict]):
    orig = (bus.fetch_briefing, bus.fetch_styles, bus.fetch_customers, bus.write_action,
            bus.fetch_decisions, bus.post_propose_ad, bus.post_propose_groupbuy, bus.expire_stale_proposals,
            bus.fetch_campaign_outcomes, bus.upsert_memory, bus.fetch_action, bus.supersede_action,
            bus.fetch_blackboard, bus.fetch_memory, bus.update_campaign)
    bus.fetch_briefing = lambda range_days=7: {"insights": scn.briefing}   # type: ignore[assignment]
    bus.fetch_styles = lambda: {"styles": scn.styles}                       # type: ignore[assignment]
    bus.fetch_customers = lambda: {"customers": scn.customers}              # type: ignore[assignment]
    bus.fetch_decisions = lambda: scn.decisions                             # type: ignore[assignment]
    bus.expire_stale_proposals = lambda sb, **kw: 0                         # type: ignore[assignment]
    bus.fetch_campaign_outcomes = lambda sb, m: scn.campaigns               # type: ignore[assignment]
    bus.upsert_memory = lambda sb, row: captured.append({"action_type": "memory", "payload": row})  # type: ignore[assignment]
    bus.fetch_action = lambda sb, action_id, merchant_id: scn.actions_by_id.get(action_id)  # type: ignore[assignment]
    bus.supersede_action = lambda sb, action_id: None                       # type: ignore[assignment]
    bus.fetch_blackboard = lambda sb, round_id: {"executions": list(scn.actions_by_id.values())}  # type: ignore[assignment]
    bus.fetch_memory = lambda sb, m, limit=200: []                          # type: ignore[assignment]
    bus.update_campaign = lambda sb, cid, m, fields: None                    # type: ignore[assignment]
    bus.write_action = lambda sb=None, **kw: captured.append(kw)            # type: ignore[assignment]
    # place_ad / set_group_buy_coupon now create real entities via the TS routes — stub that hop so the
    # eval stays offline while still exercising the real tool bodies + their action writes.
    bus.post_propose_ad = lambda style_id, *a, **k: {"ok": True, "id": f"ad-{style_id}", "status": "active"}  # type: ignore[assignment]
    bus.post_propose_groupbuy = lambda style_id, *a, **k: {"ok": True, "deal": {"id": f"gb-{style_id}"}}       # type: ignore[assignment]
    try:
        yield
    finally:
        (bus.fetch_briefing, bus.fetch_styles, bus.fetch_customers, bus.write_action,
         bus.fetch_decisions, bus.post_propose_ad, bus.post_propose_groupbuy, bus.expire_stale_proposals,
         bus.fetch_campaign_outcomes, bus.upsert_memory, bus.fetch_action, bus.supersede_action,
         bus.fetch_blackboard, bus.fetch_memory, bus.update_campaign) = orig


def _skill(slug: str) -> str:
    return (_SKILLS / f"{slug}.md").read_text(encoding="utf-8")


def _opp_report(ctx: tools.RunContext) -> dict:
    for step in ctx.transcript:
        if step.get("tool") == "get_trend_opportunities":
            return step.get("output", {})
    return {}


def _grounded_ids(scn: Scenario, ctx: tools.RunContext) -> set[str]:
    ids = {s["id"] for s in scn.styles}
    dp = scn.briefing.get("designPerformance", {})
    ids |= {s.get("styleId") for s in dp.get("styles", [])}
    ids |= {s.get("styleId") for s in dp.get("highInterestLowConversion", [])}
    for step in ctx.transcript:  # deterministic tool outputs are grounded
        out = step.get("output")
        if isinstance(out, dict):
            for o in out.get("opportunities", []):
                ids |= set(o.get("matchedStyleIds", []))
            for p in out.get("prune", []):
                ids.add(p.get("styleId"))
    return {i for i in ids if i}


_PROSE_KEYS = {"body", "reason", "summary", "note", "message", "text"}  # free text — never in the signature


def _signature(scn: Scenario, ctx: tools.RunContext, captured: list[dict]):
    """Structured decision signature (never compares prose) — kind-aware so an empty action run is `()`,
    not the trend fallback."""
    if scn.expect.get("kind") in ("revision", "no_revision"):  # the decision = WHICH actions were revised
        return tuple(sorted(ctx.revision.revised_actions)) if ctx.revision else ()
    if scn.expect.get("kind") == "dispatch":  # orchestration decision = the JUDGED lanes only
        judged = set(scn.expect.get("must", [])) | set(scn.expect.get("forbid_dispatch", []))
        dispatched = set(ctx.round.dispatched) if ctx.round else set()
        return tuple(sorted(judged & dispatched))
    if scn.expect.get("kind") == "final_regex":  # reviewer = the verdict token itself
        m = re.search(r"\[(APPROVED|APPROVED_WITH_CONDITIONS|REVISION_REQUIRED|MERCHANT_APPROVAL_REQUIRED)\]",
                      getattr(scn, "_final", "") or "")
        return (m.group(1) if m else None,)
    if scn.expect.get("kind") == "brief":  # decision = which briefs were filed
        return tuple(sorted((b.get("action_type"), b.get("style_id")) for b in scn._filed_briefs))
    if scn.expect.get("kind") == "action":  # decision = (action_type, target fields only)
        keys = scn.expect.get("sig_keys")  # optionally pin only the judged payload fields
        return tuple(sorted(
            (a.get("action_type"), json.dumps({k: v for k, v in a.get("payload", {}).items()
                                               if (k in keys if keys else k not in _PROSE_KEYS)},
                                              ensure_ascii=False, sort_keys=True))
            for a in captured))
    # read (trend): sign the EXPECTED opportunity (not opps[0]) — that's the decision the scenario is about
    e = scn.expect
    m = next((o for o in _opp_report(ctx).get("opportunities", [])
              if o.get("action") == e["action"] and e["target"] in o.get("matchedStyleIds", [])), {})
    return (m.get("trendLabel"), m.get("action"), tuple(m.get("matchedStyleIds", [])))


def _stub_round(scn: Scenario):
    """A REAL RoundState (same guardrails as production) whose dispatch returns the scenario's canned
    lane conclusions instead of running child loops — the eval judges the orchestration decision."""
    from nailed_agents.orchestrator import RoundState

    state = RoundState(dispatch_fn=None)
    state.dispatch_fn = lambda slug, task, parent: (f"run-{slug}", scn.lane_results.get(slug, f"{slug} 完成"))
    return state


def _run_once(scn: Scenario) -> dict:
    captured: list[dict] = []
    ctx = tools.RunContext(sb=object(), run_id=f"eval-{scn.id}", merchant_id=_M, agent_slug=scn.slug)
    task = scn.task
    if scn.slug == "orchestrator":
        ctx.round = _stub_round(scn)  # dispatch tools refuse to run without one
    filed_briefs: list[dict] = []
    if scn.slug == "decision":
        ctx.brief_sink = filed_briefs.append  # the Action Brief capability, exactly as live
    if scn.slug in ("ad", "coupon", "reviewer") and scn.briefs:
        from nailed_agents.orchestrator import _brief_context
        ctx.briefs = scn.briefs
        task = f"{task}\n\n{_brief_context(scn.briefs)}"
    if scn.slug == "monitor":
        from nailed_agents.orchestrator import RevisionPort, _execution_context
        # REAL RevisionPort guardrails; the re-dispatch returns a canned conclusion.
        ctx.revision = RevisionPort(sb=object(), merchant_id=_M, monitor_run_id=f"eval-{scn.id}",
                                    dispatch_fn=lambda slug, task, parent: (f"run-rev-{slug}", f"{slug} 已按反馈修订"))
        # The execution list is injected through the SAME formatter as the live path (_run_lane) —
        # the eval judges the monitor against the context format it will actually receive, never a
        # hand-written prose approximation of it (ADR-0014).
        if scn.actions_by_id:
            task = f"{task}\n\n{_execution_context(list(scn.actions_by_id.values()))}"
    token = tools.use_context(ctx)
    try:
        with _stub_bus(scn, captured):
            model = {"orchestrator": config.ORCHESTRATOR_MODEL, "monitor": config.MONITOR_MODEL,
                     "decision": config.DECISION_MODEL, "ad": config.AD_MODEL,
                     "reviewer": config.REVIEWER_MODEL, "coupon": config.COUPON_MODEL}.get(scn.slug)
            long_chain = scn.slug in ("orchestrator", "monitor", "decision", "ad")
            final = runner.run_agent(system=_skill(scn.slug), tool_names=scn.tools, task=task, ctx=ctx,
                                     max_iters=12 if long_chain else 8, model=model)
    finally:
        tools.reset_context(token)

    # tool-call correctness (from the attempt recorder): allow-listed + executed ok + target grounded
    style_ids = {s["id"] for s in scn.styles}
    names = {c["name"] for c in scn.customers}

    def _bad(a: dict) -> str:
        if a["tool"] not in scn.tools:
            return "off-allowlist"
        if a["status"] != "ok":
            return a["error"] or "error"
        sid = a["args"].get(_ARG_STYLE)
        if sid and sid not in style_ids:
            return f"ungrounded {_ARG_STYLE}={sid}"
        cn = a["args"].get(_ARG_CUSTOMER)
        if cn and cn.strip() not in names:  # exact normalized equality — "Rachel" must not pass for "Rachel Goh"
            return f"ungrounded {_ARG_CUSTOMER}={cn}"
        return ""
    bad = [(a["tool"], _bad(a)) for a in ctx.tool_attempts if _bad(a)]
    e = scn.expect
    # ADR-0012: doing nothing is a first-class outcome. A correct skip makes ZERO tool calls, so
    # "no tool calls" is success here — not the failure it is for an action scenario.
    expects_no_action = e.get("kind") == "no_action"
    # final_regex scenarios (the reviewer) judge from INJECTED context — zero tool calls is legitimate
    zero_ok = expects_no_action or e.get("kind") == "final_regex"
    tool_ok = (not bad) if zero_ok else (bool(ctx.tool_attempts) and not bad)
    tool_bad = "" if tool_ok else (f"{bad[0][0]}: {bad[0][1]}" if bad else "no tool calls")
    # expectation — compare the EXPLICIT target field by action type (not a payload substring)
    if e.get("kind") == "dispatch":
        dispatched = set(ctx.round.dispatched) if ctx.round else set()
        exp_ok = set(e.get("must", [])) <= dispatched and not (set(e.get("forbid_dispatch", [])) & dispatched)
    elif e.get("kind") == "revision":
        revised = set(ctx.revision.revised_actions) if ctx.revision else set()
        exp_ok = revised == set(e.get("must_revise", []))
    elif e.get("kind") == "no_revision":
        revised = set(ctx.revision.revised_actions) if ctx.revision else set()
        wrote_memory = any(a.get("action_type") == "memory" for a in captured)
        exp_ok = not revised and wrote_memory  # healthy metrics → record verdicts, do NOT revise
    elif e.get("kind") == "opportunity":
        exp_ok = any(o.get("action") == e["action"] and e["target"] in o.get("matchedStyleIds", [])
                     for o in _opp_report(ctx).get("opportunities", []))
    elif e.get("kind") == "brief":
        # the decision's judged output is WHICH briefs it filed (action_type + style), never params
        filed = {(b.get("action_type"), b.get("style_id")) for b in filed_briefs}
        exp_ok = ({(m["action_type"], m["style_id"]) for m in e.get("must", [])} <= filed
                  and not ({(f["action_type"], f["style_id"]) for f in e.get("forbid_briefs", [])} & filed))
    elif e.get("kind") == "final_regex":
        exp_ok = bool(re.search(e["pattern"], final)) and not captured  # verdict token, no side effects
    elif expects_no_action:
        exp_ok = not captured  # the agent must not have written ANY action
    else:
        exp_ok = any(a.get("action_type") == e["action_type"] and _action_target(a).strip() == e["target"] for a in captured)
    # negative assertion (forbidden action/target must not occur) — field-scoped, exact equality
    forbid_hit = [f for f in scn.forbid for a in captured
                  if a.get("action_type") == f["action_type"] and _action_target(a).strip() == f["target"]]
    forbid_ok = not forbid_hit
    # grounding (narrow): every cited style-id must be grounded — scan final text + REASONING transcript + actions
    reasoning = " ".join(s.get("text", "") for s in ctx.transcript if s.get("kind") == "reasoning")
    cited = set(_ID_RE.findall(final + " " + reasoning + " " + json.dumps(captured, ensure_ascii=False)))
    grounded = _grounded_ids(scn, ctx)
    # a prose ABBREVIATION of a grounded id (style-8265 for style-melissa-img-8265) is not a
    # hallucinated entity — the gate exists to catch invented ids, not shorthand
    def _abbrev(c: str) -> bool:
        m = re.fullmatch(r"style-(\d{3,})", c)
        return bool(m) and any(g.endswith(m.group(1)) for g in grounded)
    ungrounded = {c for c in cited
                  if c not in grounded and not any(c in g for g in grounded) and not _abbrev(c)}
    ground_ok = not ungrounded
    scn._filed_briefs = filed_briefs  # scratch for _signature (per-run, sequential)
    scn._final = final
    return {"tool_ok": tool_ok, "tool_bad": tool_bad, "exp_ok": exp_ok, "forbid_ok": forbid_ok,
            "forbid_hit": forbid_hit, "ground_ok": ground_ok, "ungrounded": sorted(ungrounded),
            "sig": _signature(scn, ctx, captured), "final": final,
            "captured": captured, "tool_attempts": list(ctx.tool_attempts)}


def evaluate(scn: Scenario, n: int) -> dict:
    runs = [_run_once(scn) for _ in range(n)]
    sigs = [r["sig"] for r in runs]
    distinct = len(set(sigs))
    return {
        "id": scn.id, "n": n,
        "tool_ok": all(r["tool_ok"] for r in runs),
        "tool_bad": next((r["tool_bad"] for r in runs if r["tool_bad"]), ""),
        "exp_pass": sum(r["exp_ok"] for r in runs),
        "forbid_ok": all(r["forbid_ok"] for r in runs),
        "forbid_hit": [f for r in runs for f in r["forbid_hit"]],
        "ground_ok": all(r["ground_ok"] for r in runs),
        "ungrounded": sorted({u for r in runs for u in r["ungrounded"]}),
        "stable": distinct == 1, "distinct_sigs": distinct, "sig": sigs[0],
        # representative run for the record = the FIRST run that failed a per-run gate (else run 0). Without
        # this, a regression seed could store a clean run's transcript while run 3/4 was the failing one.
        "rep": _pick_rep(runs), "rep_index": next((i for i, rr in enumerate(runs) if not _run_passed(rr)), 0),
        "run_signatures": [str(s) for s in sigs],
    }


def _run_passed(rr: dict) -> bool:
    return rr["tool_ok"] and rr["exp_ok"] and rr["forbid_ok"] and rr["ground_ok"]


def _pick_rep(runs: list[dict]) -> dict:
    return next((rr for rr in runs if not _run_passed(rr)), runs[0])


# ── Phase C: LLM-judge (open-ended quality) + 问题闭环 (regression log) ─────────────────────────────
_JUDGE_MODELS = ["google/gemini-2.5-flash", "openai/gpt-4o"]  # multi-judge cross-check
_MOS_FLOOR = 3.5          # avg below → flag for human spot-check
_DISAGREE = 1.5           # judge overall spread ≥ this (a genuine ≥2-pt gap) → flag for human spot-check
_REGR = Path(__file__).resolve().parent / "regressions.jsonl"  # 问题闭环: failures → regression seed


def quality_judge(scn: Scenario, final: str) -> dict:
    """Blind, multi-judge MOS (1-5) on open-ended output quality. Judges see only the task + output (no
    model identity → blind). Non-blocking. STRICT: a judge's `overall` must parse as a number in 1..5, else
    it's a judge *error* stored separately — never averaged as a 0 (infra/parse failure ≠ a real low score)."""
    from openai import OpenAI
    client = OpenAI(api_key=config.OPENROUTER_API_KEY, base_url=config.OPENROUTER_BASE_URL)
    results = []  # per judge: {model, score|None, error|None, raw}
    for m in _JUDGE_MODELS:
        raw, score, err = "", None, None
        try:
            r = client.chat.completions.create(model=m, max_tokens=400,
                response_format={"type": "json_object"},  # force valid JSON; if a model rejects it → caught below
                messages=[{"role": "user", "content":
                f"你是严格评审。任务：{scn.task}\n\nAgent 最终输出：\n{final}\n\n按 1-5 为下列维度打分，并给 overall："
                "准确性(有据不臆造)、完整性、实用性(可执行)、安全性/合规。"
                '只输出 JSON：{"准确性":n,"完整性":n,"实用性":n,"安全性":n,"overall":n,"why":"≤15字"}'}])
            raw = (r.choices[0].message.content or "").strip()
            t = raw.removeprefix("```json").removeprefix("```").removesuffix("```")
            ov = json.loads(t[t.find("{"): t.rfind("}") + 1]).get("overall")
            if isinstance(ov, (int, float)) and 1 <= ov <= 5:
                score = float(ov)
            else:
                err = f"overall out of range/type: {ov!r}"
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        results.append({"model": m, "score": score, "error": err, "raw": raw[:200]})
    valid = [x["score"] for x in results if x["score"] is not None]
    errored = [x["model"] for x in results if x["error"]]
    avg = (sum(valid) / len(valid)) if valid else None            # only real scores; None if none valid
    spread = (max(valid) - min(valid)) if len(valid) >= 2 else 0.0
    reason = []
    if avg is None:
        reason.append("no valid judge scores")
    elif avg < _MOS_FLOOR:
        reason.append(f"low avg {avg:.1f}")
    if len(valid) >= 2 and spread >= _DISAGREE:
        reason.append(f"disagreement {spread:.1f}")
    if errored:
        reason.append(f"judge errors {errored}")
    return {"results": results, "valid": valid, "avg": avg, "spread": spread,
            "errored": errored, "flagged": bool(reason), "reason": reason}


_CATEGORIES = [  # first matching → suggested failure category for triage
    ("tool_call", lambda g: "tool-call correctness" in g),
    ("expectation", lambda g: any(x.startswith("expectation") for x in g)),
    ("negative_assertion", lambda g: "negative assertion" in g),
    ("grounding", lambda g: "grounding" in g),
    ("stability", lambda g: any(x.startswith("4/4 stability") for x in g)),
]


def _log_regression(scn: Scenario, gate_fail: list[str], r: dict, judge: dict | None) -> None:
    """Rich, replayable regression seed (问题闭环): enough to reconstruct + re-run the case by hand."""
    import datetime
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    category = next((c for c, pred in _CATEGORIES if pred(gate_fail)), None)
    if category is None:
        category = "judge_infra" if (judge and judge.get("errored")) else "quality"
    rep = r["rep"]  # the representative (first-failing) run — its artifacts, not run 0's
    rec = {
        "ts": ts,
        "scenario": scn.id, "agent": scn.slug, "category": category,
        "gate_fail": gate_fail, "signature": str(rep["sig"]),
        "rep_index": r["rep_index"], "run_signatures": r["run_signatures"],  # which run + all N sigs (stability ctx)
        "task": scn.task,
        "fixture": {"briefing": scn.briefing,
                    "styleIds": [s["id"] for s in scn.styles],
                    "customers": [c["name"] for c in scn.customers]},
        "final": rep["final"][:1200],
        "captured_actions": rep["captured"], "tool_attempts": rep["tool_attempts"],
        "tool_bad": rep.get("tool_bad"), "forbid_hit": rep.get("forbid_hit"), "ungrounded": rep.get("ungrounded"),
        "judge": judge,  # full per-judge results incl raw + errors
    }
    with open(_REGR, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=4, help="runs per scenario for stability (4/4)")
    ap.add_argument("--judge", action="store_true", help="Phase C: LLM-judge open-ended quality (non-blocking)")
    ap.add_argument("--only", default="", help="run only scenarios whose id contains this substring")
    args = ap.parse_args()
    n, judge = args.n, args.judge
    _key = config.GEMINI_API_KEY if config.MODEL_PROVIDER == "gemini" else config.OPENROUTER_API_KEY
    if not _key:  # bus is stubbed → no Supabase needed, just the model key
        raise SystemExit(f"Missing model API key in .env.local for MODEL_PROVIDER={config.MODEL_PROVIDER}.")
    scenarios = [s for s in SCENARIOS if args.only in s.id]
    print(f"Agent eval (Phase A+B{'+C' if judge else ''}) — provider={config.MODEL_PROVIDER} "
          f"model={config.AGENT_MODEL} n={n} scenarios={len(scenarios)}"
          f"{' judges=' + ','.join(_JUDGE_MODELS) if judge else ''}\n" + "=" * 80)
    all_pass = True
    for scn in scenarios:
        try:
            r = evaluate(scn, n)
        except Exception as ex:
            print(f"\n✗ {scn.id}  ERROR: {type(ex).__name__}: {ex}"); all_pass = False; continue
        # blocking gates: tool-correctness, expectation (all n), negative assertion, grounding, stability
        gates = {
            "tool-call correctness": r["tool_ok"],
            f"expectation ({r['exp_pass']}/{n})": r["exp_pass"] == n,
            "negative assertion": r["forbid_ok"],
            "grounding": r["ground_ok"],
            f"4/4 stability ({r['distinct_sigs']} distinct)": r["stable"],
        }
        ok = all(gates.values())
        all_pass = all_pass and ok
        print(f"\n● {scn.id}")
        for name, passed in gates.items():
            print(f"   [{'✓' if passed else '✗'}] {name}")
        if r["tool_bad"]:
            print(f"       bad tool call: {r['tool_bad']}")
        if r["forbid_hit"]:
            print(f"       FORBIDDEN taken: {r['forbid_hit']}")
        if r["ungrounded"]:
            print(f"       UNGROUNDED ids: {r['ungrounded']}")
        print(f"       signature: {r['sig']}")
        # Phase C: non-blocking quality judgement on the open-ended output
        jr = None
        if judge:
            jr = quality_judge(scn, r["rep"]["final"])  # judge the representative (possibly-failing) run
            per = ", ".join(f"{x['model'].split('/')[-1]}=" +
                            (f"{x['score']:.0f}" if x["score"] is not None else "ERR")
                            for x in jr["results"])
            avg_s = f"{jr['avg']:.1f}" if jr["avg"] is not None else "n/a"
            flag = f" ⚑ human-review ({'; '.join(jr['reason'])})" if jr["flagged"] else ""
            print(f"       MOS(avg {avg_s}, spread {jr['spread']:.1f}){flag}: {per}")
        # 问题闭环: persist any blocking-gate failure OR any human-review flag (incl. disagreement / judge-error)
        gate_fail = [name for name, passed in gates.items() if not passed]
        if gate_fail or (jr and jr["flagged"]):
            _log_regression(scn, gate_fail, r, jr)
    print("\n" + "=" * 80)
    print("RESULT:", "ALL BLOCKING GATES PASS" if all_pass else "FAILURES (blocking)")
    if judge:
        print(f"(quality MOS judged by {len(_JUDGE_MODELS)} models — non-blocking; low/disagreeing flagged for human review)")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
