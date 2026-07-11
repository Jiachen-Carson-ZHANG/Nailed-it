# 08 — Demo Walkthrough: Scenarios, Agent I/O, Tool Usage, Contracts

Everything in this document is taken from **real persisted runs** (queryable in `agent_runs` /
`agent_actions` / `style_ad_campaign` / `groupbuy_deal`), not from design intent. Primary trace: the
dynamic round of 2026-07-10, orchestrator run `e9a4ff93…`.

---

## 1. The demo scenario & mock data

All demo data is **seeded, deterministic, and scenario-controlled** — one command rebuilds it:

```bash
npm run seed:intelligence -- --capacity=idle   # or busy | full
```

| Dataset | Source | Shape |
|---|---|---|
| **Styles** | `merchant_style` (seeded from ~40 real nail images) | Published styles with real titles ("Melissa Design 8284"), price cents, duration, and an authoritative catalog-item breakdown (the same breakdown the customer quote uses) |
| **Funnel events** | `analytics_events`, seeded PRNG (`src/mock/prng.ts`) | Per-style event streams — this round's 7-day window: 415 impressions, 158 clicks, 57 detail views, 45 saves, 20 try-ons, 9 bookings, 27 searches, 43 active customers. Styles are deliberately shaped into the PM quadrants: a converter (8265: 57 clicks → 6 bookings), a high-interest-zero-conversion trap (8284: 10 try-ons, 61 clicks, 0 bookings), dead stock (8273/8275/8266), and under-exposed earners (8274/8249) |
| **Capacity bookings** | `booking` rows, target-driven generator (`src/mock/capacity-booking-seed.ts`) | Next-week technician bookings hitting a target utilization. Measured results: `idle` → 39%, `busy` → 79%, `full` → 86% |
| **Customers** | roster seed | Personas with visit history — e.g. Amy Lim (lapsed 48 days, 金属感 taste, ~SGD 110 budget), Rachel Goh |
| **External trends** | fixture (CN-flavored) or live Pinterest via `TREND_SOURCE` | Trend labels + tags matched against the catalog (tag-overlap fallback; VLM-concept matcher opt-in) |

**Why scenario-controlled capacity matters** — it's how we prove the gates move (verified live):

| scenario | measured utilization | brain output across the same styles |
|---|---|---|
| idle | 39% | 4 ad candidates · 4 coupon candidates |
| busy | 79% | 4 ad · **0 coupon** (coupons blocked > 70% — don't discount chair time you'll sell anyway) |
| full | 86% | **0 ad · 0 coupon** — everything demoted to display_only |

Same styles, same funnel — only capacity changed. Style 8284's journey across scenarios
(`coupon → display_only → display_only`) is the single-slide proof the decisions are data-driven.

---

## 2. The round, agent by agent (real I/O)

**Trigger**: 运行一轮 button on `/merchant/agents` (or `python -m nailed_agents`). The orchestrator run
opens; everything below is dispatched by its tool loop.

### 运营助手 orchestrator — gemini-2.5-pro

- **Input**: `{"rangeDays": 7}` + task template (`ORCH_TASK`)
- **Tools available**: `get_merchant_insights`, `get_style_business_decisions`, `dispatch_agent`, `dispatch_many` — dispatch tools work ONLY here (capability object)
- **Actually did**: read both grounded sources itself → dispatched 8 lanes sequentially/parallel → final summary
- **Runtime decision**: capacity 33% `very_idle` → "全面启动" (no skips) — with the eval-pinned counterfactual that at 91% it must not wake ad/coupon
- **Output** (excerpt): *"已并行分派 ad, coupon, catalog, customer_ops… ad: 决策大脑选出 3 款高 ROAS（>3.8）且曝光不足（<0.76 exposureRatio）的潜力款"*

### 数分 insight — flash

- **Input**: `{"parentSlug": null, "dispatchedBy": "e9a4ff93…"}` + task
- **Tools**: `get_merchant_insights` (only)
- **Tool call**: `get_merchant_insights({rangeDays: 7})` → snapshot + catalogGaps + designPerformance JSON
- **Output**: headline + 3 alerts + `focusStyleIds: [8284, 8265]` — e.g. *"「金属感」搜索量 35 次，在售款式 0 —— 品类缺口"*

### 选品 trend — flash

- **Input**: `{"parentSlug": "insight", …}` + task **+ insight's conclusion appended verbatim by Python**
- **Tools**: `get_trend_opportunities`, `get_platform_hot`, `get_external_trends`
- **Tool output** (excerpt): `{"opportunities": [...], "prune": [{"styleId": "…8273", "reason": "长期低转化且不在任何上升趋势上 → 下架候选"}, …8275, …8266], "matchMeta": {...}}`
- **Output**: ranked list — amplify 8265, price_test 8284, gaps (金属感 + external trends), prune ×3

### 决策 decision — flash (the synthesis point)

- **Input**: parent=trend; since ADR-0014 the injection is multi-source — 数分's *and* 选品's
  conclusions arrive in-context every round (`CONTEXT_POLICY`), regardless of which one is the parent
- **Tools**: `get_style_business_decisions`, `get_merchant_insights`, `search_memory` (ADR-0015; memory hints are also pre-injected), `read_blackboard` (optional)
- **Tool output** (the brain, excerpt): `{"capacity": {"band": "very_idle", "utilizationPct": 33, "largestGapMin": 300}, "decisions": [{"styleId": …, "candidate": "ad|coupon|display_only|skip", "scores": {...}, "signals": [...], "ad": {"expectedRoas": …, "exposureRatio": …, "costPerBookingCents": …}, "suggestedCouponCents": …}, ×42]}`
- **Runtime decisions actually made this round** (all with cited numbers):
  - **Overrode the trend agent** on 8265: trend said *amplify*, brain said `display_only` (ROAS 6.09 fine but `exposureRatio 1.575` — over-saturated) → 决策 sided with the brain: *"继续放大反而会降低效率，本轮不采取任何动作"*
  - 8284: ROAS null + exposure 1.94 → no ad; but high-demand-zero-conversion + trend's price_test → **coupon**
  - Chose 3 ad targets (8274 / 8254 / 8249 — the under-exposed, ROAS-clearing set) + 2 coupons
- **In an earlier round it overrode the brain the other way** (declined brain-candidate coupons on 8275/8273 because the briefing flagged them as delist candidates) — the synthesis layer is demonstrably not a rubber stamp in either direction

### 投广 ad — flash (executor)

- **Input**: parent=decision; the decision text appended verbatim; instructed *"若决策未选择投广则不要调用任何工具"*
- **Tools**: `place_ad` (only)
- **Tool calls** (real):
  ```
  place_ad({styleId: "style-melissa-img-8274", slot: "top_funnel", budgetCents: 10000})
    → {entityId: "ad-style-melissa-img-8274", campaignStatus: "draft"}     (×3 styles)
  ```
- **Envelope fired**: agent chose ¥100/day > ¥50 cap → all three campaigns landed as **drafts awaiting
  the merchant** (`超出预算上限，待商家启动`), actions written `proposed`. The previous round it chose
  ¥200/day — same result. The envelope, not the model, decides what goes live.

### 团购 coupon — flash (executor)

- **Tools**: `set_group_buy_coupon` (only)
- **Tool calls**: `set_group_buy_coupon({styleId: "…8284", priceCents: 7040})` → `{dealId: "gb-style-melissa-img-8284", dealStatus: "draft"}` (+ 8275)
- Deals are REAL rows: title from the style, original price ¥88 → coupon ¥70.4, 7 relational service
  items — editable/publishable in 团购管理. **Always drafts**; agents cannot publish a storefront offer.

### 上下架 catalog — flash

- **Tools**: `get_catalog_actions`, `list_style`, `delist_style`, `propose_listing`
- **Tool calls** (real, note the hygiene machinery firing):
  ```
  get_catalog_actions → {delist: [8273, 8275, 8266], propose: [金属感 + 4 external gaps]}
  delist_style ×3 → {ok: true}
  propose_listing(supersede) → {expiredPriorProposals: 22}     ← P0 cleaned 22 stale proposals
  propose_listing ×5 → {proposed: true}                        ← capped at MAX_PENDING_PROPOSALS=5
  ```
- 上新建议 are `proposed` + `irreversible` — the one human gate (merchant must supply the image)

### 用户运营 customer_ops — flash

- **Tools**: `get_customer_intelligence`, `send_customer_message`
- **Tool calls**: roster read → picked the most-lapsed persona-matched customer →
  `send_customer_message({customerName: "Amy Lim", body: "Amy好久不见！…金属感新款…我请你喝咖啡☕️"})` → `{sent: true}`
- Note the grounding: the message references her actual last style (Creamy French) and her taste tags
  (金属感) from the roster — and 金属感 is this week's real demand gap. Action is `irreversible` → no undo offered anywhere.

### 监测 monitor — flash

- **Tools (P2/P3, memory v2)**: `get_merchant_insights`, `get_campaign_outcomes`, `record_action_outcome`, `record_round_verdict`, `search_memory`, `request_revision`, `read_blackboard` — revision and memory writes work ONLY here
- **Injected input (ADR-0014)**: the round's structured execution list from `agent_actions` —
  `[{id, type, status, risk, entity_id, payload}, …]` — the `id` field is what `request_revision` takes.
  Sourced from the table by Python, never parsed from another agent's prose.
- This round predates the P2 tables; behavior under P2/P3 is pinned by eval instead: over-spender
  (¥200/day, spend/booking ¥280) → exactly one `request_revision`; healthy campaign → verdict recorded, zero revisions (both 2/2 stable). The eval injects the execution list through the same formatter as the live path.

### One honest finding this trace surfaced

**Cross-lane conflict**: 团购 created a deal for 8275 while 上下架 delisted 8275 — in parallel, each
correct per its own upstream (决策 chose the coupon; the trend prune list chose the delist). This is a
real coordination gap the round blackboard now makes detectable (both conclusions land in shared state),
and the designed fix is a deterministic cross-check before executor dispatch — queued, not hidden.

---

## 3. Tool freedom: what agents can and cannot choose

**Agents do NOT choose from a global tool pool.** Each lane has a fixed allow-list
(`LANE_TOOLS`, `orchestrator.py`), enforced in the runner — an off-allow-list call is **refused before
execution** (a side effect must never fire before a gate can catch it). *Within* its list, the loop
freely chooses which tools, in what order, how many times, with what arguments — that's where judgment
lives, bounded by per-argument validation.

| Agent | Allow-list | Freedom in practice |
|---|---|---|
| orchestrator | 2 reads + dispatch_agent + dispatch_many | which lanes, order, parallelism, skips |
| insight | get_merchant_insights + search_memory | range window; whether an anomaly is first-time or repeat |
| trend | 3 trend reads | which sources to corroborate with |
| decision | brain + insights + search_memory + read_blackboard | read order; the entire action plan (0..N) |
| ad | place_ad | targets, slots, budgets — or refuse to call at all |
| coupon | set_group_buy_coupon | targets, prices — or refuse |
| catalog | catalog reads + list/delist/propose | which candidates to act on (instructed: only the computed list) |
| customer_ops | roster read + send message | who to contact, what to write |
| monitor | insights + outcomes + memory writers + search_memory + request_revision + read_blackboard | assessments + confidence; whether numbers justify a revision |

Two tools are additionally gated by **capability objects** (not names): `dispatch_*` requires
`ctx.round` (only the orchestrator's context has one), `request_revision` requires `ctx.revision`
(only the monitor's). A hallucinated call from any other lane raises before touching anything.

---

## 4. The JSON contracts

**Tool schemas** are auto-derived from Python signatures + docstrings (one source of truth →
Anthropic `beta_tool` and OpenAI function schemas simultaneously; pinned by schema tests). Key shapes:

```jsonc
// dispatch (orchestrator only)
dispatch_agent  {"agent": "coupon", "task": "…中文任务…", "parent": "decision"}
dispatch_many   {"dispatches_json": "[{\"agent\":\"ad\",\"task\":\"…\",\"parent\":\"decision\"}, …]"}  // 1–4, atomic validation

// execution tools → real entities
place_ad             {"styleId": str, "slot": "top_funnel|mid_funnel|lower_funnel", "budgetCents": int ≤ 200000}
  → {"entityId": "ad-<styleId>", "campaignStatus": "active"|"draft"}     // envelope decides which
set_group_buy_coupon {"styleId": str, "priceCents": int ≤ 100000}
  → {"dealId": "gb-<styleId>", "dealStatus": "draft"}                    // always draft
propose_listing      {"gap_tag": str ≤ 40, "reason": str ≤ 280}          // gated, deduped, capped

// action row (agent_actions) — the audit contract (ADR-0012)
{"type": "place_ad", "risk": "reversible", "status": "proposed|applied|undone|approved",
 "payload": {"styleId": …, "slot": …, "budgetCents": …},
 "entity_type": "style_ad", "entity_id": "ad-<styleId>"}                  // forward link
// …and the entity carries source_run_id back to the run                  // backward link

// memory row (agent_memory, P2) — verdicts, never raw metrics
{"kind": "ad_outcome|coupon_outcome|round_verdict", "key": "<campaign id>",
 "content": {"verdict": "7 天实测 ROAS 2.1，估算 4.1 —— 高估约 2 倍"},
 "entity_type": "style_ad", "entity_id": …, "window_start": …, "window_end": …,
 "evidence_run_id": …, "expires_at": now+30d}                              // unique(merchant,kind,key) → upsert

// round blackboard (agent_rounds.blackboard) — written by Python as lanes conclude
{"insight": "<conclusion>", "trend": "…", "decision": "…", "orchestrator": "…"}
```

**Stable entity ids** (`ad-<styleId>`, `gb-<styleId>`) are themselves a contract: re-proposing updates
the same entity (no duplicates), and a monitor revision is an in-place upsert (no forked entities).

---

## 5. The envelope (every numeric bound in one table)

| Bound | Value | Where enforced |
|---|---|---|
| Ad auto-launch cap | ¥50/day (`5000` cents) — above → draft for merchant | TS server action (`AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS`) |
| Ad budget hard max | ¥2,000/day (`200000`) — above → tool rejects | Python tool validation |
| Coupon price max | ¥1,000 (`100000`) | Python tool validation |
| Coupon profit floor | ≥ ¥30/hour at the discounted price | decision brain (`minProfitPerHourCents`) |
| Ad ROI gate | `expectedRoas ≥ 2.0` (merchant `targetRoi`) | decision brain |
| Pending 上架建议 | ≤ 5, new round supersedes old | Python tool (`MAX_PENDING_PROPOSALS`) |
| Dispatches per round | ≤ 8, one per agent | `RoundState` |
| Revisions | ≤ 1 per action, ≤ 2 per round | `RevisionPort` |
| Message length | ≤ 280 chars | Python tool validation |
| Group-buy publish | never by an agent | entity state machine (draft-only creation) |

The envelope philosophy in one line: **gate by blast radius, not by "AI did it"** — a withdrawable
¥50/day drip auto-launches with a pause button; anything bigger or public becomes a draft the merchant
owns.
