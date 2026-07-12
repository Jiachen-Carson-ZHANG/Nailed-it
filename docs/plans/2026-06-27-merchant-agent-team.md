# Merchant Operations Agent Team — design & implementation plan

**Date:** 2026-06-27
**Status:** Draft (implements ADR-0007, revised 2026-06-27)
**Depends on:** ADR-0006 (intelligence layer), ADR-0004 (repository seam), ADR-0007 (orchestration decision)
**Supersedes:** `2026-06-26-merchant-agent-team.md` (deleted — described the old in-process TS runtime + approval-by-default; both reversed by ADR-0007).

## 1. Goal

A closed-loop **merchant operations agent team** that turns tracked behaviour into **precise, auto-executed actions** — analyze (own styles + platform/external trends + user data) → decide exactly what to do (which ad, how much spend, what 团购券 price) → act on the real commercialisation surfaces → measure lift → feed back. Visible **both** in a `/merchant/agents` collaboration panel **and** in-context on the real pages. AI acts as an employee; it shows what it did and every reversible action can be undone.

## 2. Architecture (per ADR-0007)

```
  Next.js app (TS)                         Supabase (shared bus)                Python agent service
  ─────────────────                        ─────────────────────                ─────────────────────
  /merchant/agents  ────reads runs───────▶ agent_runs / agent_actions ◀──writes── orchestrator (运营助手)
  投广 / 价格config / 老板msg (in-context)  analytics_events (ADR-0006) ◀──reads───  数分 · 决策 · 投广 · 团购
  action functions (server actions) ◀──────  customers / merchant_style ◀─reads──  运营(上下架) · 用户运营 · Monitor
        │  (also callable from the service via the same RPCs)                       models = OpenRouter default / Anthropic optional
        └─ write side-effects + agent_actions rows
```

- **Reasoning** runs in a small **Python multi-agent service** with provider-specific tool-call loops: **OpenRouter is the default demo path** through the OpenAI-compatible SDK; **Anthropic SDK `tool_runner` is optional** when `MODEL_PROVIDER=anthropic`. OpenRouter does not literally run Anthropic's `tool_runner`; it runs the same plain tool bodies through our OpenAI-format loop. No CC/Codex subagents.
- **Supabase is the shared bus.** The Python service reads the substrate (`analytics_events`, `customers`, `merchant_style*`) and writes `agent_runs` + `agent_actions`. The TS panel reads those rows. Action side-effects go through the same action functions the app exposes (called as RPCs / scripts).
- **Agents are data** (Multica pattern): `instructions` (system prompt) + `tools` allow-list; an **orchestrator** dispatches **targeted runs** (one run → one agent). Multica is pattern inspiration only; the implementation is the repo-owned Python service.

## 3. The agents

MVP in **bold**; P1/later in plain.

| Agent | Role | Reads (intelligence / substrate) | Writes (tools → surface) | Output |
|---|---|---|---|---|
| **运营助手 (orchestrator)** | lead | — | dispatches runs | round plan, sequencing |
| **数分 (Insight)** | analyst, read-only | `getMerchantInsights`, `getDailySeries`, gap + low-conversion, trending, external/season | — | **Briefing** (report + anomaly **alerts**) |
| **决策 (decision)** | planner | the Briefing | — (emits action intents) | precise action: ad / coupon / list, with spend & price |
| **投广 (ad)** | operator | decision + style perf | `placeAd` → **投广页面 (AI帮投, 图库下方)** | ad placement + `投广reasoning` |
| **团购 (coupon)** | operator | decision + price/conversion | `setGroupBuyCoupon` → **价格config页面 (AI帮设)** | coupon + `团购reasoning` |
| **运营 (catalog)** | operator | gap detection + trending | `listStyle`/`delistStyle`/`draftStyleUpload` → 提醒上架 | list/delist / draft |
| **用户运营 (customer ops)** | operator | `getCustomerIntelligence` | `sendCustomerMessage` → **老板msg页面 (AI-as-boss + AI note + style card)** | acquisition/repurchase msg |
| **Monitor** | reviewer, read-only | `getMerchantInsights`/`getDailySeries` before-vs-after on acted styles | — (re-triggers 数分) | **Verdict** (lift) → closes loop |
| 客诉 / HR考核 / 动态调价 / 原材料 | — | — | — | **P1 / later** |
| per-user relationship chain (满意度→follow-up→老板月报) | — | — | — | **P1 / later** |

- 数分, Monitor are **read-only** (safe by construction). 决策 emits intents; the operator agents own the side-effects.
- Each operator runs a **`reasoning ⇄ tool`** step (the diagram's red loop): reason → call tool → reasoning may refine the decision before commit.

## 4. The closed loop

```
数分 (Briefing+alerts) ─▶ 决策 (precise action) ─▶ {投广 | 团购 | 运营上下架 | 用户运营} ─▶ Monitor (lift) ─▶ 数分 …
```

A run is targeted to one agent. Monitor's verdict re-dispatches 数分 (`trigger_source='event'`). The **B→C "reverse light-up"**: an action changes a C-side metric (feed rank / coupon surfaced / new style / boss msg) → Monitor measures it → the panel highlights the agent that caused it.

## 5. Data model (migration `0022_agent_orchestration.sql`)

Scoped by `merchant_id` (no tenancy/RLS — ADR-0006); repository seam (memory + Supabase impls, ADR-0004).

```sql
create table agents (            -- agents are data (Multica agenttmpl analogue)
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,     -- 'orchestrator'|'insight'|'decision'|'ad'|'coupon'|'catalog'|'customer_ops'|'monitor'
  name text not null,
  role text not null,            -- 'lead'|'analyst'|'planner'|'operator'|'reviewer'
  instructions text not null,    -- system prompt (verbatim into the Claude call)
  tools text[] not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table agent_runs (        -- one row per targeted dispatch + transcript
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id),
  merchant_id text not null,
  trigger_source text not null default 'manual',  -- manual|event|schedule
  parent_run_id uuid references agent_runs(id),    -- Monitor → 数分 closes loop
  status text not null,                            -- running|completed|failed|awaiting_approval
  input jsonb not null default '{}',
  output jsonb,
  transcript jsonb not null default '[]',          -- reasoning ⇄ tool ⇄ action steps
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table agent_actions (     -- concrete side-effects (the undo/approval ramp)
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id),
  merchant_id text not null,
  type text not null,            -- 'place_ad'|'set_group_buy_coupon'|'list_style'|'delist_style'|'draft_upload'|'send_customer_message'
  risk text not null default 'reversible',  -- 'reversible'|'irreversible'
  status text not null default 'applied',   -- applied|undone|proposed|approved
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Manual Supabase apply (no CLI), like 0017/0019.

## 6. Action functions (the tools) — reversible + undo

All `'use server'` (or scripts the Python service calls), behind the repository seam; each writes an `agent_actions` row and is undoable by flipping a flag:

| Tool | Side-effect | Surface | Undo |
|---|---|---|---|
| `placeAd(styleId, slot, budget)` | ad row in 3-slot module | 投广页面 | remove ad row |
| `setGroupBuyCoupon(styleId, price)` | coupon flag + price | 价格config | clear flag |
| `listStyle`/`delistStyle(styleId)` | publish/archive | 图库 | reverse status |
| `draftStyleUpload(gapTag)` | draft via existing breakdown pipeline | 图库(drafts) | delete draft |
| `sendCustomerMessage(convId, body, styleCard)` | message as boss + AI note | 老板msg页面 | retract/mark |

**Gating (ADR-0007 §4):** all of these **auto-execute + undo**, with **one exception** — `draftStyleUpload` / 上架-a-**new** style when external trending finds **no matching internal style** (the `找不到 → 提醒上架` branch). The agent can't fabricate the design, so that action is written `status='proposed'` and waits for the merchant's **Approve** (and image) in the panel before it lists. Re-listing an *existing* style auto-executes.

## 7. Surfaces (both)

- **`/merchant/agents` dashboard** — agent cards + recent runs; click-in `runs/[id]` renders the stored `transcript` as the thinking chain (`reasoning → tool input/output → action → outcome`) + the **B→C uplift**; **Undo** on any reversible `agent_actions`; **Approve/Reject** for the proposed new-style gate.
- **In-context:** 投广页面 (AI帮投, below 图库) · 价格config页面 (AI帮设 团购) · 老板msg页面 (AI auto-send shown as boss + AI note + recommended-style card) · 老板月报.

## 8. The app ↔ Python bridge

- **Demo posture (decide in Phase 1):** simplest = Python service runs a round (manual/CLI trigger or a thin endpoint the panel calls), writes `agent_runs`/`agent_actions` to Supabase; the panel **reads/replays**. A panel "Run" button can trigger the round (hybrid) once the trigger path is wired.
- **Shared bus = Supabase.** No direct TS↔Python calls needed for state; both sides converge on the tables. Action side-effects reuse the existing TS action functions (exposed as RPC/scripts) so business rules stay in one place.

## 9. Phasing

- **Phase 1 — substrate + one chain end-to-end:** done. Migration 0022; Python service skeleton; **数分 → 决策 → 投广** with `placeAd`; `/merchant/agents` + run detail reading Supabase; seeded historical runs.
- **Phase 2 — close the loop + second chain:** done. **团购** (`setGroupBuyCoupon`) + **Monitor** (lift, re-dispatch 数分).
- **Phase 3 — catalog + customer ops:** done at the panel-action level. **运营 (上下架 / 提醒上架)** + **用户运营**; the new-style gate renders Approve/Reject.
- **Phase 3b — real surfaces:** partial. The local panel Run button and in-context cards on 投广 / 价格config / 老板msg are wired against `agent_actions`. Streaming, deployed triggering, true ad/coupon/message entities, and actual publish-on-approve into `merchant_style` remain pending.
- **Phase 4 (P1/later):** 客诉, HR 考核, 动态调价, 原材料, the per-user relationship chain (满意度→follow-up→老板月报); `schedule`/`event` triggers.

## 10. Open questions

- **Trigger/stream** — the local dev panel trigger spawns the Python service; deployed triggering still needs a hosted worker/endpoint, and streaming remains open.
- **Coupon/ad entities** — current surfaces render `agent_actions` payloads only. Add real ad/coupon entities only when the in-context pages need persistence beyond the demo card.
- **Cross-language model config** — the Python service owns the model client; keep `MODEL_PROVIDER` and `AGENT_MODEL` centralized in repo-root `.env.local`.
- **Transcript size** — cap stored transcript vs full (manual trigger bounds volume for now).
