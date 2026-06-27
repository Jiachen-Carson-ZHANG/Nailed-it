# ADR 0007: Merchant Operations Agent Team — Python multi-agent over Nailed-it's data substrate

**Status:** Proposed (revised 2026-06-27 after the 0626 semifinal design meetings)
**Date:** 2026-06-26 · revised 2026-06-27
**Depends on:** ADR-0006 (intelligence layer), ADR-0004 (repository seam)
**Supersedes the framework choice in this ADR's earlier drafts:** custom in-process TS runtime → CC/Codex + skills → **now a Python multi-agent service calling Claude directly** (see Alternatives).

## Context

The headline 美团 semifinal deliverable is a merchant-side **"agent team"**: a small set of role agents that read the behaviour we already track, **decide a precise action** (place an ad with a specific budget, set a 团购券 at a specific price, list/delist a style, message a customer to win/retain them), **take the action automatically** ("把 AI 当员工，想做的事直接执行"), then **measure whether it worked** — a closed loop the merchant does not drive by hand, with a **dynamic panel** that lets judges *see* the agents collaborate and the **B→C uplift** ("reverse light-up").

This ADR is grounded in five concrete inputs:

1. **Multica** (studied via `/understand`): the orchestration *pattern* — agents-as-data (id / tag / skill / tool), a main **orchestrator** that dispatches **targeted runs** (a task belongs to one agent), and a transcript streamed to a dashboard. Multica grafts onto Claude Code / OpenCode; we take the pattern, not the runtime.
2. **架构设计会 (0626, 20:12).** A core **运营助手 (operations assistant = orchestrator)** monitors internal data → **weekly report + anomaly alerts**, and external market → **trending styles, season / hot-topic** (春节红色, 奶龙款). Action strategy = **团购券** (e.g. next-week bookings < 50% → list a 基础款 coupon) + **投广** (decide content & spend). A **Monitor** agent reviews ad/coupon effect (good *or* bad) → adjust. Scope it sketched for later: 客诉, 复购/到店提醒, HR 考核, 动态调价, 原材料.
3. **开发分工会 (0626, 21:38).** Build the **two confirmed chains (投广 + 团购) first**; the **老板 msg 页面 auto-sends as the boss but is AI**, with an **"AI note"** explaining the thinking + a **recommended-style card**; one person does the frontend, hands to backend.
4. **复赛阶段会议纪要 (curated note) + the blueprint diagram.** The agent roster and the exact graph (below). Surfaces live **零散在各个界面** (scattered across the real pages), not only a dashboard.
5. **复赛指导Note (coach, 0624).** B-side = an "agent teams" concept, full-auto, AI-native; the **3-slot ad module is explicitly the surface for the style-monitoring agent's auto-actions**; **团购券** is the defined coupon mechanic; mock data is fine; demo-only.

**The blueprint graph (merchant ops loop):**

```
                      ┌──────────────── analytics_events + intelligence layer (ADR-0006) ───────────────┐
 [分析用户数据] ───────────────────────────────────────────────▶ [用户运营: 编辑消息 获客+复购] → 老板msg页面
                                                                                                          │
 [分析款式数据]            ┌─ 投广reasoning ⇄ 投广(tool) ─────────▶ 投广页面 (AI帮投, 图库下方)            │
 [平台热门 vs 我的款式] ─▶ [决定做什么 action: ─┤                                                          │
 [外部时下热门 vs 我的款式] 跑得好/跑得不好的款,   └─ 团购reasoning ⇄ 团购(tool) ─────▶ 价格config页面 (AI帮设)│
                       精确到 投什么广/多少钱/                                                             │
                       团购券设多少钱]                                                                     │
        │                  └─ if 找不到 → 提醒商家上架 (catalog gap)                                       │
        └──────────────────────────────── Monitor (measure lift) ◀───────────────────────────────────────┘
```

(The red feedback arrows in the diagram are the `reasoning ⇄ decision` loop — the action reasoning refines the decision before the tool fires.)

Nailed-it already owns the hard parts (so this layer stays thin): the **data substrate** (`analytics_events` + `customers`, ADR-0006), the **analytical brain** (`src/domain/intelligence/*`: `getMerchantInsights`, `getDailySeries`, `rankStyles`, catalog-gap + low-conversion detection, `getCustomerIntelligence`), the **action surface** (server actions + the repository seam, ADR-0004), and the **commercialisation mechanics** (multi-currency; the 团购券 flow + 3-slot ad module are the agents' action surface).

Constraints from ADR-0006 hold: single-salon **competition demo**, mock data, no cron/tenancy/RLS, compute-on-read, AI subordinate to computed metrics.

## Decision

Build the agent team as a **Python multi-agent service that calls Claude (Anthropic) directly**, acting over a thin **action + observability substrate inside Nailed-it**, surfaced **both** in a dedicated panel and in-context on the real merchant pages.

1. **Framework = Python multi-agent + Claude (Anthropic), not OpenRouter, not CC/Codex.**
   - The agent **reasoning** runs in a small **Python** multi-agent service (the team is most comfortable in Python). **Prod = Claude via the Anthropic API/SDK directly.** A one-flag **`MODEL_PROVIDER` seam** lets **dev** run cheap models (Gemini/GPT via **OpenRouter**, keys we already have) — *only the model adapter in `runner.py` forks; orchestrator/skills/tools/bus/panel are provider-agnostic.* This is **not** a provider for production (we ship Claude) and **not** the OpenAI Agents SDK framework — just a dev-cost adapter. Skew caveat: test on Gemini, run a final pass on Claude.
   - **Agents are data** (Multica pattern): each role agent = `instructions` (system prompt) + a `tools` allow-list. An **orchestrator (运营助手)** dispatches **targeted runs** (one run → one agent).
   - **Each agent = a tool-call loop.** Per-agent behaviour runs as a Claude **tool-call loop** via the Anthropic SDK's **`tool_runner` (beta)** — the agent reasons, calls a tool from its allow-list, reads the result, loops. The **outer** team sequence (数分→决策→执行→监测) stays a **deterministic Python sequence** (a fixed, demo-predictable process). Each agent's process is a **"skill" file we own** (`agent-service/skills/*.md`, loaded as the system prompt) — **not** the Claude `.claude/skills` feature (also on the repo's deliverable ban-list). This is the mentor's "tool-call loop" without adopting the heavy Claude Agent SDK / Claude Code harness.
   - We do **not** build a TS in-process LLM loop, and we do **not** port Multica's daemon/CLI/sandbox. We use Multica's **pattern only — no Multica code, API, or process.** Phase 1 built our **own** Python orchestrator; Multica is studied for inspiration, not wired in.

2. **The substrate + both surfaces live in Nailed-it.**
   - **Action functions** (server actions / scripts): `placeAd` (3-slot module), `setGroupBuyCoupon` (团购券, on price-config), `listStyle` / `delistStyle` (上下架), `draftStyleUpload` (gap fill), `sendCustomerMessage` (用户运营, posts as the boss with an AI-note). Each carries a **risk tier** and writes an `agent_actions` row.
   - **Run + transcript records** (`agent_runs`) capturing the thinking chain (`reasoning ⇄ tool ⇄ action`) so the panel can replay a run.
   - **Surfaces = BOTH:**
     - **Dashboard `/merchant/agents`** — the required "show collaboration" deliverable: the team, each run's thinking chain, the actions, and the **B→C uplift** highlight.
     - **In-context** — actions appear where the merchant works: **投广页面 (AI帮投, below the 图库)**, **价格config页面 (AI帮设, 团购券)**, **老板msg页面 (AI auto-sends as the boss + an "AI note" + a recommended-style card)**, and the **老板月报**.

3. **The team (orchestrator + role agents).** MVP set in **bold**:
   - **运营助手 (orchestrator)** — dispatches the round, sequences the agents, owns the closed loop.
   - **数分 (Insight / analyst, read-only)** — internal data → **weekly/ops report + anomaly alerts**; external → platform-trending + season/topic, compared against our catalog. Interprets `getMerchantInsights` / `getDailySeries` / gaps / low-conversion / trending.
   - **决策/执行 (decision, the "决定做什么 action" node)** — turns the briefing into a **precise** action (which ad, how much spend, coupon amount), via a `reasoning ⇄ tool` loop.
   - **投广 (ad chain)** — `投广reasoning` + `投广(tool)` → 投广页面.
   - **团购 (group-buy chain)** — `团购reasoning` + `团购(tool)` → 价格config页面.
   - **运营 (catalog, list/delist)** — when a gap has a matching internal style it can re-list it automatically; when **no internal style matches** it **proposes 上架 a new style for merchant approval** (it cannot create the design itself — see §4). Auto-delists dead styles.
   - **用户运营 (customer ops)** — drafts/sends acquisition + repurchase messages on the 老板msg页面.
   - **Monitor (reviewer, read-only)** — measures lift on `analytics_events`, re-triggers the round. Closes the loop.
   - **Deferred to P1 / later:** 客诉 (complaint handling), HR 考核 / capacity prediction, 动态调价 (dynamic pricing), 原材料 (restocking), and the **per-user relationship chain** (成交后满意度 → follow-up → 老板月报). **P1 rule:** anything that cannot close a loop with the other agents is P1 — build it after the core loop works.

4. **Execution = auto-execute + one-click undo, with exactly ONE human gate.**
   - **Auto-execute (default, AI-as-employee "想做的事直接执行"):** actions on styles the merchant *already has* — `placeAd`, `setGroupBuyCoupon`, `delistStyle`, `sendCustomerMessage`, and re-listing an existing style. They apply immediately; the panel offers **one-click undo**.
   - **Human-gated — exactly one case:** when external/platform trending finds **no matching internal style** (the diagram's `找不到 → 提醒商家上架`), the agent **cannot fabricate the design** — it can only **propose 上架 a new style**, which the merchant must **approve** (and supply the actual image) before it lists. `draftStyleUpload` / 上架-a-new-style is written `status='proposed'` and waits for the merchant's **Approve** in the panel.
   - `agent_actions` carries `status` (`proposed | approved | applied | undone`): the 上架-new action uses `proposed → approved`; everything else uses `applied → undone`.
   - *Why this split:* you can auto-tune what already exists (ads / coupons), but adding net-new catalog content needs the human — the merchant owns the design and the decision to stock it. Future real-spend / real-send-to-users actions would gate the same way, when they exist.

5. **Actions hook the REAL commercialisation mechanics** — 团购券 (set on price-config; AI breakdown surfaces coupon + post-coupon price) and the **3-slot ad module** (top/lower/mid funnel; the explicit surface for "auto-operate styles"). Money uses the multi-currency formatter.

6. **Demo shows the B→C uplift loop dynamically:** run → action → a visible C-side change (feed ranking / coupon surfaced / new style / boss message) → Monitor's measured lift → the panel highlights the agent that caused it ("reverse light-up").

7. **Inherited guardrails (ADR-0006):** agents act on pre-computed numbers, never invent metrics; Monitor's verdict traces to `analytics_events`; "not enough data" on thin data; scope by `merchant_id`; mock/demo; no cron/tenancy/RLS.

## Alternatives considered

- **CC / Codex subagents + skills** (a prior draft of this ADR). Superseded — the team chose **Python + Claude** for familiarity and direct control of the loop. The substrate/panel work it described is retained; only the runtime changed.
- **OpenRouter multi-model as the *production* provider** (proposed in the dev meeting: one key, many models in config). Dropped for prod — we standardise on **Claude directly**. *Later kept as a **dev-only** backend behind `MODEL_PROVIDER` (cheap iteration on Gemini/GPT), never the shipped path — see §1.* (The existing `src/nail-ai/openrouter.ts` also stays for the image/recognition pipeline.)
- **Custom in-process TS LLM loop** (the very first draft). Replaced by a standalone Python service — keeps agent code out of the Next.js request path and matches the team's language preference.
- **Port / run Multica wholesale.** Rejected — built to run coding-agent subprocesses that edit files; too heavy for business-ops on mock data. We reuse its *pattern* (agents-as-data, targeted runs, transcript→dashboard).
- **One mega "do-everything" agent.** Rejected — no role separation, no per-step observability, no visible collaboration (the exact thing the panel must show).
- **Dashboard-only** *or* **in-context-only** surfaces. Rejected — the panel proves collaboration to judges; in-context proves the AI is woven into the product. We do both.
- **Approval gate as default.** Rejected per the coach — agents auto-go-live for the demo. The **one** retained gate is 上架-a-new-style (no internal match → the merchant must approve and supply the design, §4); future real-spend / real-send actions would gate too.

## Consequences

- **Positive:** Strong "AI-native / agent team" story; every run replayable; every reversible action undoable; actions plug into the real 团购券 + ad mechanics so agent work and commercialisation reinforce each other; both surfaces covered.
- **Negative:** A **Python agent service is a new runtime to own**, plus a **cross-language bridge** to the TS app's data (the service must read Supabase / call action functions / write `agent_runs` + `agent_actions`). Capturing the thinking chain into a panel-readable transcript needs a deliberate contract. The demo depends on the Python service being runnable in the demo environment.
- **Resolved in Phase 1:** Multica = pattern only (our own Python service, no Multica code/API). **Supabase is the shared bus** (Python writes runs/actions; the TS panel reads them). Migration `0022` + the read substrate + panel are built. Per-agent process = **tool-call loops** (`tool_runner` beta) driven by **skill files we own** under `agent-service/skills/` (not `.claude/skills`).
- **Resolved in Phase 2:** the **closed loop** is built — `数分 → 决策 → 投广 → 团购 → Monitor → 数分'`. 决策 emits both 投广 + 团购 intents; Monitor is read-only and re-dispatches a re-baseline 数分' (parented, non-recursive) to close the B→C loop. No new tables/tools.
- **Resolved in Phase 3:** the **full team loop** — added 运营(上下架) + 用户运营. `list_style`/`delist_style` auto-execute (reversible); the **one human gate** (§4) is live — `propose_listing` writes `status='proposed'` + finalizes the run as `awaiting_approval`, and the panel renders **Approve/Reject** (`approveAgentActionAction`). 用户运营 reads a grounded customer roster (`/api/agent/customers`) and sends a reversible boss-message. Seed shows the full loop + gate cold (no API key).
- **Still open:** **App ↔ Python trigger/stream** — runs are triggered from the terminal (`python -m nailed_agents`) and the panel replays the stored run; a panel "Run" button (live trigger) is a later upgrade. **Phase 3b** = the actual publish-on-approve into `merchant_style` + the in-context surfaces (投广/价格config/老板msg) — touches the concurrent style + messages WIP, so it's a separate cross-cutting pass. Live verification of the `tool_runner` loops is still pending an `ANTHROPIC_API_KEY`.

## References

- ADR-0006 (intelligence layer), ADR-0004 (repository seam).
- Lark — 复赛指导Note (0624); 复赛阶段会议纪要 (curated, 0626) + blueprint diagram; meeting notes: 商家端AI代理架构设计讨论会, 商家端AI功能开发及分工协调会议, 复赛阶段美甲AI功能方案讨论会 (user-side generation, separate track).
- Companion design + implementation plan: `docs/plans/2026-06-27-merchant-agent-team.md`.
