# Merchant Home = Agent Activity + Salon State — design

> ⚠️ **Canonical spec = `DESIGN.md` → "Merchant Agent Home".** Where this plan's older sections
> (§1–§9, e.g. "KPI dashboard + today timeline") disagree, DESIGN.md and the "Locked decisions — v2"
> block below win. This file is rationale/history, not the build contract.

Status: draft for review · 2026-07-03 · local (docs/plans, not shipped)
Owner: Carson · input: Melissa (whiteboard sketch → 今日提要 reference mock, not code)

---

## Locked decisions — v2 (2026-07-04)

These supersede the open questions in §10. Sections §1–§9 are kept as the rationale trail.
Interactive mock: artifact `home-agent-feed-v2`. Melissa's 今日提要 screenshot was a **reference mock, not code** — we build from our artifact.

1. **Top block = KPI dashboard + today timeline.** Kill the 主控 "ran a round" narrator. The lead
   agent is the *invisible author* of the grounded KPI numbers (本周营收 / 今日预约 / 待确认), not a card.
   Today = next 2–3 appointments (timeline, denser than a mini month-grid) → tap 完整日历.
2. **AI 团队 status-board lane removed from home** (duplicated 需要关注). Team shown via card
   author-tags + drill-down lineage; full roster is a 常驻 tile → agents tab.
3. **需要关注 = pinned pending + horizontal done-roll.** `proposed` (human-in-loop, few) pins at top,
   can't-miss, collapses to a count banner if many; `applied` (informational, can be 20+) rolls
   horizontally at fixed height so the page never balloons. Classification kept (miss-tolerance
   differs) but lightweight — one conditional pin, not two lanes.
4. **常驻 2×2 = 完整日历 · 款式图鉴(选品) · 周报 · AI团队.** Dropped 技师管理 (staff admin, low-freq →
   move to 我的).
5. **Card lifecycle:** proposed pins until acted; applied fades ~48h; failed never on home (only in
   full log). Home never empty because KPI + timeline are computed (no manufactured activity); only
   the done-roll shows a calm "今日无新动作" on quiet days.
6. **Drill-down redesign:** face (result + 为什么 + control) → 推理链路 (reasoning⇄tool⇄action) →
   上游/下游 lineage. Replaces the naive `AgentRunDetailClient`.
7. **IA change:** bottom tab 1 renames 日历 → 今日; the full calendar is reached via the timeline tap +
   the 常驻 tile (no longer its own bottom tab).

---

## 1. Problem / motivation

First merchant tab is currently a **plain calendar**. It answers only "what's my schedule."
It does **not** answer the two questions a salon owner actually opens the app for:

1. *What happened while I was away?* — the AI team ran 数分/投广/团购/上下架/用户运营, produced actions.
2. *Can I trust it — why did it do that, and do I need to approve/undo anything?*

Today those live at `/merchant/agents` — **buried** (not in the bottom tab bar; tabs are
calendar / manage / messages / profile). The multi-agent value is invisible on the home screen,
and invisible to a 美团 judge doing a 10-second glance.

Goal: make the home surface the AI team's work **and** the salon's live state, with trust built in
(reason + control), without turning the home into a developer log viewer.

---

## 2. What already exists — reuse, do not rebuild

The sketch describes a system that is **~80% already built**. This is a *surfacing + IA + card-design*
job, not a new feature.

| Need in sketch | Already exists | File |
|---|---|---|
| Agent feed (team + recent runs + run-a-round + empty state) | `/merchant/agents` page (187 lines) | `src/app/merchant/agents/page.tsx` |
| Drill-down: reasoning ⇄ tool ⇄ action chain | `TranscriptStep` union | `src/domain/agents.ts:59` |
| Upstream/downstream lineage | `AgentRunView.parentRunId` + `input`/`output`; written by orchestrator | `src/domain/agents.ts:73`, `agent-service/nailed_agents/orchestrator.py:40`, `supabase/migrations/0022_agent_orchestration.sql:26` |
| Run detail page | thin route wrapper (drill-down) | `src/app/merchant/agents/runs/[id]/page.tsx` |
| Action cards (4 types) | `AgentActionInline` renders `place_ad` / `set_group_buy_coupon` / `draft_upload` / `send_customer_message` | `src/features/merchant/AgentActionInline.tsx` |
| Runs data fetch | `listAgentRunsAction` / `listAgentsAction` / `triggerAgentRoundAction` | `src/lib/actions/agent-actions.ts` |
| Team roles | 主控/分析/决策/执行/监测 (`lead/analyst/planner/operator/reviewer`) | `agents/page.tsx` |

**Delete-the-part principle:** we promote and re-skin the existing agents surface onto the home;
we do not write a second transcript/DAG viewer.

---

## 3. Reframe #1 — home is STATE-driven, not EVENT-driven (this kills the empty-home problem)

An **event feed** is empty whenever nothing new happened — which is most days. A home that is blank
90% of the time is a dead home. The fix is not to "fake" activity; it is to change the mental model:

> The home reflects the salon's **current state**, with agent activity as one lane inside it.
> State is always non-empty because it is *derived*, not *event-triggered*.

Three ways to guarantee a non-empty, honest home (ranked, then blended):

### Option A — Daily 概览 hero card, composed by 主控 (lead) agent  ⭐ recommended as the anchor
- One guaranteed card per day: "今日概览 — 3 个预约、本周营收 +12%、1 条待你确认".
- Content is **grounded numbers** (ADR-0006 compute-on-read), so it is never empty and — critically —
  carries **no LLM-hallucination demo risk** when seeded for the 美团 demo.
- Doubles as the "the AI read your whole shop this morning" narrative.

### Option B — Agent status board (always-on team cards)  ⭐ recommended as the second lane
- Each of the 5 agents is a persistent card showing **posture + next action**, not just past events:
  "数分 · 上次 3 天前 · 下次 周一 09:00 生成周报", "团购 · 明天评估碎钻套餐续期".
- Never empty (5 agents always exist) and reinforces "you have an AI team" for judges.
- Risk: a board of *idle* agents can read as "nothing is happening." Mitigate by always showing the
  **next scheduled action** (feels alive) and floating any agent with a pending item to the top.

### Option C — Live slices (today's schedule, week pulse)
- Today's appointments inline + 本周表现 pulse. Always computable. This is the sketch's own
  "今日预约 13:00" instinct — show the *slice*, not a button to the calendar.

### Recommended blend (home = 3 lanes, top → bottom)
```
Lane 1  今日概览 hero            ← Option A (grounded, guaranteed, demo-safe)
Lane 2  需要关注 / AI 团队       ← Option B status board + unseen-action strip (§4)
Lane 3  常驻入口 2×2            ← launcher (see IA decision §7)
```
Empty state ceases to exist: even on a dead day, Lane 1 shows today's numbers and Lane 2 shows the
team's next moves. "Empty" degrades to "quiet," not "blank."

---

## 4. Reframe #2 — two audiences, one card at two depths

The owner does **not** want a raw transcript with tool JSON — that is dev/judge content. She wants
**what happened · why · can I approve/undo it.** But the 美团 judges *do* want the transcript +
lineage — it proves the multi-agent loop is real.

Resolve with **one card, two depths**:

- **Face (merchant default):** result + one-line 为什么 + control (批准 / 撤回 / 查看 / 停止投放).
- **Expand "推理链路" (judge/demo):** the `TranscriptStep` chain + upstream (什么触发了我) /
  downstream (我把什么交给了下游). All data already present; the 15-line run-detail page likely does
  not render lineage yet → small add.

Raw `tool_call` JSON is never the primary view; it lives one tap down.

---

## 5. Proposed layout (phone)

**Busy day**
```
┌─────────────────────────────┐
│ 今日概览 (主控)              │  Lane 1 — grounded hero
│ 3 预约 · 营收周比 +12%       │
│ ⚠ 1 条待你确认               │
├─────────────────────────────┤
│ 需要关注  ‹ swipe ›          │  Lane 2a — bounded horizontal strip
│ [团购续期] [上架待批] [投广…] │  (≤4–5, unseen / proposed / urgent)
│                     查看全部→ │  → vertical full feed (= existing agents page)
├─────────────────────────────┤
│ AI 团队           ‹ swipe ›  │  Lane 2b — status board (5 agents, posture+next)
├─────────────────────────────┤
│ 日历 │ 图册  │ 周报 │ 技师   │  Lane 3 — 常驻 2×2 launcher
└─────────────────────────────┘
```

**Quiet day** — Lane 1 shows today's schedule + week pulse; Lane 2a collapses to "今日暂无待办",
Lane 2b still shows each agent's next scheduled action. Never blank.

Horizontal is used **only** for bounded strips (≤5), never the full feed — horizontal carousels hide
count and make item #6 unreachable, which is exactly wrong for "how many things need me." Full feed is
vertical (the existing `/merchant/agents` list).

---

## 6. Edge cases (required: 2–6)

**#2 proposed vs applied — must be unmistakable.**
`draft_upload` is `proposed` (needs owner approval); `place_ad` is `applied` (budget already spent).
Card must render distinct states: `待你确认` (with 批准/拒绝) vs `已执行`. Blurring these =
owner believes AI did something it only suggested. Drive off `action.status` (`proposed`/`applied`).

**#3 irreversibility — control depends on action type.**
- `send_customer_message` → already sent, no undo. Control = 查看 only.
- `place_ad` → money spent, no undo. Control = 停止投放 / 查看数据.
- `draft_upload` (proposed) → fully reversible: 批准 / 拒绝.
- `set_group_buy_coupon` → depends on live/redeemed; if redeemed, no undo → 停止 only.
Card control set is a **function of (actionType, status)**, not a generic 撤回 button. Never offer
undo on an irreversible action — it lies to the owner.

**#4 failed / stale runs — do not present a crash as a result.**
Filter feed by `status`: `completed`/`applied` → card; `failed` → hidden from hero/strip, surfaced only
as a discreet "运行失败 · 重试" in the full feed. A proud card for a crashed run destroys trust.

**#5 unseen + dismissal — needs per-merchant seen-state.**
"New since last visit" requires a `last_seen_at` per merchant (or per-run `seen` flag). Without it the
weekly-report card haunts the owner for 7 days. Also need explicit **dismiss** so an acknowledged item
leaves the 需要关注 strip but stays in the full feed. See §8 for storage.

**#6 volume / i18n / demo reliability.**
- *Volume:* a busy salon can produce many runs/day → cap the strip, group full feed by day/type.
- *i18n:* zh-CN + en both, via the existing copy-object pattern in `agents/page.tsx`.
- *Demo:* live "运行一轮" mid-demo can surface an LLM error inside the transcript. For 美团 demo,
  home reads **seeded/curated** runs; keep live-run behind the agents tab, not on the hero path.

---

## 7. IA decision — the 常驻 2×2 duplicates existing nav (needs your call)

Sketch's 2×2 = 日历 · 图册 · 周报 · 技师. But **日历 is already a bottom tab** and **图册 lives in
profile/me**. If the home *also* launches them, there are two nav paths → confusion + double
maintenance. Options:

- **7a. Home = launcher, slim the tab bar.** Home becomes the hub; drop redundant bottom tabs. Cleanest
  IA, biggest change.
- **7b. Home shows live slices, not buttons.** No 日历 *button* — show today's schedule inline (Lane 1).
  2×2 holds only things without their own tab (图册, 周报, 技师管理, +1). Smaller change. ⭐ leaning here.
- **7c. Keep both** (duplicate). Fastest, but the trap above. Not recommended.

---

## 8. Backend / data needs

- **seen-state (#5):** add `merchant_agent_seen (merchant_id, last_seen_at)` OR `agent_runs.seen bool`.
  Prefer a single `last_seen_at` per merchant (simpler, one row) unless per-run dismissal is needed
  (then per-run flag). Manual migration (no CLI).
- **Daily 概览 hero (§3A):** who composes it? Options: 主控 agent run seeded daily, OR a pure
  compute-on-read function (no LLM) that reads today's bookings + week deltas. Recommend
  **compute-on-read** for reliability; agent only *annotates*.
- **Lineage render (#4-audience):** run-detail page should render `parentRunId` (上游) + children +
  `input`/`output` (handoff). Data exists; UI does not yet.
- **Feed fetch:** confirm `listAgentRunsAction` returns `status`, `actions[]`, `startedAt`,
  `parentRunId` (it returns `AgentRunView`, which has all) — good.

---

## 9. Build plan (after design sign-off)

1. Home shell = 3 lanes (Lane 1 hero, Lane 2 strip+board, Lane 3 launcher). `code-architect` for data flow.
2. Lane 1: compute-on-read 概览 (reuse insights/booking reads).
3. Lane 2a: `AgentActionInline` in a bounded horizontal strip; filter by status+unseen.
4. Lane 2b: agent status board from `listAgentsAction` + next-action.
5. Drill-down: reuse `runs/[id]`; add lineage render.
6. seen-state migration + read path.
7. i18n copy, quiet-day state, demo seed.
8. `ui-designer` for card state system once flow is fixed.

---

## 10. 请你判断的点 (open questions)

1. **Empty-home solution** — accept the A+B+C blend (§3)? Or do you want the daily 概览 hero to be
   agent-composed (richer, demo-risk) vs compute-on-read (reliable, my rec)?
2. **IA** — 7a (home as hub, slim tabs), **7b (live slices, my rec)**, or 7c (keep both)?
3. **Which tab does this replace** — the calendar tab, or a new home tab pushed to slot 1?
4. **seen-state granularity** — per-merchant `last_seen_at` (simple) vs per-run dismissal (richer)?
5. **Scope for the demo** — all 3 lanes, or Lane 1 + Lane 2 only for the semifinal?
