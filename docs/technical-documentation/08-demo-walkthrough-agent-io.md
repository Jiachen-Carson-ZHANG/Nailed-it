# 08 — Demo Walkthrough: Scenarios, Agent I/O, Tool Usage, Contracts

Everything in this document is taken from **real persisted runs** (queryable in `agent_runs` /
`agent_actions` / `style_ad_campaign` / `agent_memory` / `agent_rounds`), not from design intent.
Primary trace: the **three-round finals-a sandbox sequence of 2026-07-12** (ADR-0016 v3 runtime),
orchestrator runs `d61b73ea…` (round 1) → `f0257db6…` (round 2) → `ea2a45d1…` (round 3), with
`advance-clock 72` and `advance-clock 96` between them. Console + per-lane dumps: `docs/eval/live-v3/`
(local).

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

**Why scenario-controlled capacity matters** — it's how we prove the gates move. The seeder hits
measured utilizations (idle 39% · busy 79% · full 86%); the same styles then flow through three
capacity-sensitive layers: the engine's **signals** flip (`idle_capacity` ↔ capacity-pressure), the
injected `capacity_summary` reframes 决策's brief portfolio (a 22% week justified spend actions; a
tight week wouldn't), and the **orchestrator skip rule** is eval-pinned — at 91% utilization the
spend lanes must not be dispatched at all. Same styles, same funnel — only capacity changed.

---

## 2. The trace: three rounds against a hidden market (real I/O, 2026-07-12)

**Setup** (operator commands, never agent tools): `npm run seed:agent-history` (backdated finished
campaigns + hypotheses + merchant preferences; memory itself is never seeded),
`python -m nailed_agents set-scenario finals-a` (hidden state: competition 1.15, broad quality 0.55,
retargeting quality 1.35, booking friction 1.40 — forecast never sees these). Wallet opens at ¥180.

### Round 1 — facts → briefs → review → forecast loop → one placement, one refusal

- **决策 (pro)** — injected environment (mission incl. `merchant_weekly_focus` = 拉新 + ¥45 CAC
  tolerance, policy snapshot, capacity 22%, candidate index) + memory hints. Filed **3 briefs via
  `submit_action_brief`** (schema-enforced tool, prose is not a channel): coupon 8284 price-test;
  ad 8249 (target 5–10, ≤¥100, CAC ≤2040); ad 8274 (target 4–8, ≤¥80, CAC ≤3360). Cited the seeded
  history in its reasoning: *"历史记忆强烈警告不要对此类款式投放广告，因实测成本远高于预期"* (8284 → coupon, not ad).
- **风控 (pro)** — read the brief portfolio verbatim → `[APPROVED]` with six numbered checks
  (conflicts / concentration / cannibalization / evidence / measurability / trust boundary).
- **投广 (pro)** — the forecast loop, live: `get_ad_account_state` → `list_available_audiences` →
  `forecast_ad_plan` ×3 across audiences →
  - 8249: chose `saved_or_viewed`, ¥60/5d — forecast **4.8–7.1 bookings @ CAC 808–1211**, snapshotted
    as the hypothesis on the action → campaign `ad-style-melissa-img-8249` (fresh run of the ended
    seed entity: version++, measured history archived to zero). Daily ¥12 ≤ ¥50 envelope → auto-launched.
  - 8274: **reported infeasible with evidence** — all three audiences forecast under the 4-booking
    floor inside the ¥80 ceiling (*"最乐观的预测也只能带来 2.4–3.6 单…判定此简报目标不可行"*). No placement. A refused
    action with cited forecasts, not a silent skip.
- **团购 (pro)** — `get_coupon_constraints` → `set_group_buy_coupon(8284, weekday_10_off,
  weekday_afternoon)`: picked the mildest merchant template, code computed 券后价 7920 > profit floor
  6191 → draft deal awaiting the merchant.
- **监测 (pro)** — measured the **seeded due list** (injected by code): `record_action_outcome` ×2 —
  8284 *"实测 CAC 28000 分 vs 预测 8000 —— 经济失败"* (high confidence), 8265 符合预测. Memory born on stage
  from queryable rows, never seeded.

### advance-clock 72 (operator) — the market answers

`deliver()` runs the hidden scenario against the active campaign:
**+35 clicks (on-forecast — delivery and engagement healthy), +2 bookings, ¥36 spent → measured CAC
1800 vs hypothesis 808–1211.** Conversion under-delivers while clicks don't — the layered-diagnosis
input the forecast could not have predicted.

### Round 2 — the merchant goal beats cost anchoring; the executor revises itself

- **决策** re-briefed 8249 citing the mission channel: *"商家本周重点是拉新，并为新客设置了 4500 分的获客成本上限（引用记忆
  mem 90a69578）"* → ad brief with CAC ≤4500 (round 1 had anchored to measured CAC ~2000; the weekly
  focus is mission state, injected deterministically — see `_decision_context`).
- **风控** `[APPROVED]` (*"一个是经过验证的优等生，另一个是需要验证的潜力股，这是平衡的投资组合"*).
- **投广** forecast-compared **keep vs raise-budget vs re-target** on the live campaign and executed
  `update_ad_campaign` — **the SAME entity, version 8**: audience `saved_or_viewed → try_on_no_booking`,
  ¥50/5d, citing the measured miss (*"维持原状预测成本 808–1211 vs 实测已 1800"*). A revision never forks a
  parallel campaign.
- **监测** failed this round (model returned its raw thinking as the final text; two read calls, no
  writes). The run is persisted as-is — `toolAttempts` makes narrated-but-not-performed work visible
  by construction. Round 3 covers the gap; the failure mode and its code-level mitigations are
  recorded in the implementation log.

### advance-clock 96 → Round 3 — memory closes the loop

- Delivery: +10 clicks, +1 booking, ¥14 (the revised config spends its remaining lifetime budget).
- **监测 (clean pass)** — `record_action_outcome` ×3: 8284 (3.5× worse than hypothesis, high),
  8265 (符合预测, high), and the live campaign 8249 — *"实测获客单价 1667 分，约为预测区间上限 (825 分) 的 2 倍 —— 成本高于预期"*
  (medium). **Explicitly declined a revision, citing its bright lines**: *"实测点击 45 次、获客 3 单，未满足
  '点击≥50 且无转化' 或 '高预算且单价超 200 元' 的修订标准"* — the trigger-happy revision the eval forbids, refused
  live with named thresholds.
- **决策** cited the monitor's memory in its next plan: *"不适合投放广告（遵循 mem 6c29cb92）"* plus the weekly
  focus (mem 90a69578) — agent-written memory, code-anchored to an action id, changing the next
  round's briefs. Every hop is a queryable row.

### What this trace deliberately shows failing

- **8274's brief died in forecast** — objective infeasible, reported with numbers (stronger evidence
  of agency than a placement).
- **The forecast was honestly wrong** — hidden friction made real CAC ~2× the range; the monitor
  measured it against the snapshotted hypothesis and wrote calibration memory instead of panicking.
- **One lane failure per ~10 runs is real** (gemini: dead responses, thought-leaks) — the round
  degrades honestly: skips are named, `toolAttempts` expose unexecuted claims, spend tools refuse
  prose-driven execution (`no_ad_brief_filed`), and the orchestrator reports which lanes did not run.

---

## 3. Tool freedom: what agents can and cannot choose

**Agents do NOT choose from a global tool pool.** Each lane has a fixed allow-list
(`LANE_TOOLS`, `orchestrator.py`), enforced in the runner — an off-allow-list call is **refused before
execution** (a side effect must never fire before a gate can catch it). *Within* its list, the loop
freely chooses which tools, in what order, how many times, with what arguments — that's where judgment
lives, bounded by per-argument validation.

| Agent | Allow-list (`agent-tools.json`, single source) | Freedom in practice |
|---|---|---|
| orchestrator | 2 reads + dispatch_agent + dispatch_many + search_memory | which lanes, order, parallelism, skips |
| insight | get_merchant_insights + search_memory | range window; whether an anomaly is first-time or repeat |
| trend | 3 trend reads + search_memory | which sources to corroborate with |
| decision | get_style_business_facts + insights + search_memory + read_blackboard + **submit_action_brief** + **simulate_action_portfolio** | which candidates to inspect; the entire brief portfolio (0..N briefs is a valid round) |
| reviewer | read_blackboard + get_merchant_insights | verdict token + conditions; free to approve cleanly |
| ad | get_ad_account_state + list_available_audiences + forecast_ad_plan + place_ad + update_ad_campaign + pause_ad_campaign | audience, budget, duration inside the brief — or report the objective infeasible |
| coupon | get_coupon_constraints + set_group_buy_coupon | which merchant template + restrictions (window, count, expiry) — never the price |
| catalog | get_catalog_actions + feature/deprioritize + propose_listing + search_memory | which candidates to act on; exposure allocation only, assets never removed |
| customer_ops | roster read + send_automated_notification + create_merchant_message_draft + search_memory | who + what; relationship messages stop at a merchant-send draft |
| monitor | insights + outcomes + record_action_outcome + record_round_verdict + search_memory + request_revision + read_blackboard | assessments + confidence; whether numbers justify a revision (bright lines in skill) |

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
dispatch_many   {"dispatches_json": "[{\"agent\":\"ad\",\"task\":\"…\",\"parent\":\"decision\"}, …]"}
                // 1–4; batch validated atomically BEFORE any run; mid-run failures reported per-lane

// the Action Brief (决策 only, via submit_action_brief — ADR-0016 §2)
{"action_type": "ad|coupon", "style_id": str, "objective": "一句话+引用数字",
 "max_total_budget_cents": int, "target_bookings_min/max": int,
 "max_cost_per_booking_cents": int, "allowed_period": "weekday|any", "notes": str,
 "source_run_id": "<decision run>"}   // stored on the blackboard by code; injected verbatim into executors

// ad toolset (sandbox) — plan, then commit
forecast_ad_plan {"style_id", "audience": "broad_local_interest|saved_or_viewed|try_on_no_booking",
                  "total_budget_cents", "duration_days"}
  → ranges + saturation + warnings, never point estimates
place_ad         (same args) → {"entityId": "ad-<styleId>", "campaignStatus": "active"|"draft"}
  // hard refusals, pre-side-effect: style_not_in_brief · budget_exceeds_brief ·
  // budget_exceeds_wallet · campaign_exists_for_style (live one) · no_ad_brief_filed (empty brief set)
  // the CHOSEN plan's forecast is snapshotted as the action's hypothesis
update_ad_campaign {"campaign_id", …} → same entity, version++   // revisions never fork
set_group_buy_coupon {"style_id", "template_id": "<merchant template>", "redemption_window", …}
  → draft deal; code computes the price and refuses below the profit floor

// action row (agent_actions) — the audit contract (ADR-0012/0015)
{"type": "place_ad", "risk": "reversible", "status": "proposed|applied|undone|approved",
 "payload": {…, "hypothesis": {"expectedBookings": [lo,hi], "expectedCostPerBookingCents": [lo,hi], "audience"}},
 "entity_type": "style_ad", "entity_id": "ad-<styleId>"}                  // forward link
// …and the entity carries source_run_id back to the run                  // backward link

// memory row (agent_memory v2, ADR-0015) — the agent judges, code anchors
{"kind": "action_outcome|round_verdict|calibration|merchant_preference", "key": "<action id | …>",
 "claim": "实测每单 1667 分，约为预测上限 825 的 2 倍 —— 成本高于预期", "confidence": "high|medium|low",
 "domain": "ad|coupon|…", "scope_type": "style|merchant", "source_action_id": …, "entity_id": …,
 "content": {…code-derived measured-vs-predicted…}, "expires_at": …}       // unique(merchant,kind,key) → upsert

// round blackboard (agent_rounds.blackboard) — written by Python as lanes conclude
{"insight": "<conclusion>", …, "briefs": [<structured briefs>], "executions": [<agent_actions snapshot>]}
```

**Stable entity ids** (`ad-<styleId>`, `gb-<styleId>`) are themselves a contract: one campaign per
style is code-enforced (a live one must be revised via `update_ad_campaign`; an ended one re-placed
as a fresh run — version++ with measured history archived to zero, never inherited).

---

## 5. The envelope (every numeric bound in one table)

| Bound | Value | Where enforced |
|---|---|---|
| Marketing wallet | `MARKETING_BUDGET_CENTS` (¥180 demo) − committed (draft asks + active unspent) | `place_ad`/`update_ad_campaign` refuse `budget_exceeds_wallet` |
| Brief ceilings | per-brief budget / CAC / period / style | `place_ad`/`update_ad_campaign` refuse pre-side-effect |
| No brief, no spend | executor dispatched with an empty brief set → spend tools refuse | `no_ad_brief_filed` / `no_coupon_brief_filed` |
| One campaign per style | live → must revise; ended → fresh run (version++, metrics archived) | `place_ad` (`campaign_exists_for_style`) |
| Ad auto-launch cap | ¥50/day (`5000` cents) — above → draft for merchant | TS server action (`AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS`) |
| Ad budget hard max | `200000` cents total — above → tool rejects | Python tool validation |
| Coupon price | code-computed from a merchant template; below profit floor → refused | `set_group_buy_coupon` (`template_unknown` / `price_below_profit_floor`) |
| Campaign transitions | draft→active→paused/ended; no resurrection | `sandbox.CAMPAIGN_TRANSITIONS` |
| Pending 上架建议 | ≤ 5, new round supersedes old | Python tool (`MAX_PENDING_PROPOSALS`) |
| Dispatches per round | ≤ 9, one per agent; monitor never in a parallel batch | `RoundState` (snapshot barrier) |
| Revisions | ≤ 1 per action, ≤ 2 per round | `RevisionPort` |
| Customer messages | auto-sends labeled 商家助手, whitelisted kinds; relationship marketing stops at a draft | `send_automated_notification` / `create_merchant_message_draft` |
| Group-buy publish | never by an agent | entity state machine (draft-only creation) |

The envelope philosophy in one line: **gate by blast radius, not by "AI did it"** — a withdrawable
¥50/day drip auto-launches with a pause button; anything bigger or public becomes a draft the merchant
owns.
