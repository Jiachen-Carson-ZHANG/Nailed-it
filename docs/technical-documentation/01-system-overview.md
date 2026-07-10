# 01 — System Overview

## What this is

A B2B2C platform for nail salons on a 美团-style marketplace. Three connected products:

1. **Customer side** (`/customer/*`): style discovery feed, AI virtual try-on, image-decomposed smart
   quotation (a nail photo → catalog-item breakdown → a real price from the merchant's own price list),
   and interval-based booking with per-technician availability.
2. **Merchant side** (`/merchant/*`): an agent-first operations home (今日), style library with
   AI-assisted publish, price-list management, 团购 (group-buy) management, 投广 (ad campaign) center,
   demand-intelligence dashboard, and the agent-team panel.
3. **Agent service** (`agent-service/`, Python): an autonomous operations team that analyzes the shop,
   decides commercial actions, executes them as *real* platform objects (ad campaigns, group-buy deals),
   measures the outcomes, and remembers what it learned for the next round.

The thesis: a small salon cannot afford an operations analyst. The platform's data (funnel events,
bookings, capacity, trends) is sufficient for one — if an AI team does the reading, deciding, and
routine execution, with the merchant holding the money controls.

## Stack and shape

| Layer | Choice | One-line reason |
|---|---|---|
| Web app | Next.js App Router, TypeScript, mobile-first shell | One codebase for both roles; server actions give us an API surface without a second service |
| Data | Supabase (Postgres) behind a repository seam (`src/lib/repositories/`) | Same interfaces run in-memory for tests and Postgres for the demo — tests never touch the network |
| Agent runtime | Our own Python service (`agent-service/`), no framework | Tool loops are ~100 lines; a framework adds a dependency layer without adding judged behavior (see doc 02) |
| Agent ↔ app | Supabase as a shared bus + HTTP calls into the app's API routes | Agents create entities through the SAME validated server actions the UI uses — no second write path |
| Models | OpenRouter (gemini-2.5-flash lanes / gemini-2.5-pro orchestrator) or Anthropic — one flag | Provider-agnostic runner; model tiering is a measured decision (doc 06) |

### The repository seam (ADR-0004)

Every read/write goes through `getRepositories()` — async interfaces with an in-memory and a Supabase
implementation. Consequences we cash in daily: the 500+ TS tests run with zero network; the demo can run
without a database; and when we moved group-buy off browser `localStorage` (ADR-0012), only the
implementation changed, not the consumers.

### The intelligence layer is compute-on-read (ADR-0006)

Analytics are an **event log** (`analytics_events`) + pure derivation functions
(`src/domain/intelligence/`, `src/domain/decision/`). No materialized aggregates to drift out of sync;
every number the agents cite is recomputed from events at read time. The cost (recompute per read) is
irrelevant at salon scale and buys us a single source of truth.

## The one diagram that matters

```
CUSTOMER EVENTS                MERCHANT DATA                    EXTERNAL
impressions/clicks/saves/      styles, prices, bookings,        platform-hot tags,
try-ons/bookings               technician schedules             Pinterest trends
        │                              │                              │
        ▼                              ▼                              ▼
┌─────────────────────── TS intelligence + decision brain (pure, deterministic) ──────────────────┐
│ funnel scores · profit-per-hour economics · next-week capacity intervals · ROAS + exposure gates │
└──────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                               │ GET /api/agent/* (grounded reads)
                                               ▼
┌────────────────────────── Python agent team (ADR-0007/0013) ─────────────────────────────────────┐
│ 运营助手 (orchestrator, dispatch tools) ──► lanes: 数分·选品·决策·投广·团购·上下架·用户运营·监测  │
│ round blackboard · cross-round memory · bounded revision edge                                     │
└──────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                               │ POST /api/agent/propose-* (validated writes)
                                               ▼
                              REAL ENTITIES: style_ad_campaign · groupbuy_deal
                              (merchant reviews / publishes / pauses / undoes in the UI)
```

Two properties of this shape we defend everywhere:

- **Determinism lives below the line, judgment above it.** Math, state machines, and money guards are
  TypeScript/Postgres/Python code; the LLM synthesizes across their outputs and writes the reasons.
  No single tool returns "the answer" (ADR-0012 §5).
- **Agents write through the app, not past it.** `place_ad` calls the same server action the 投广中心
  uses, with the same validation and the same budget envelope. There is no privileged AI write path.

## Where things live

| Concern | Path |
|---|---|
| Decision brain (pure) | `src/domain/decision/` (economics, funnel, capacity, ads, decision) |
| Action↔entity contract | `src/domain/action-entity-contract.ts`, migrations `0027`–`0030` |
| Merchant-readable transcripts | `src/domain/agent-transcript.ts` + `TranscriptChain.tsx` |
| Agent runtime | `agent-service/nailed_agents/` (orchestrator, runner, tools, bus, config) |
| Agent process prompts | `agent-service/skills/*.md` (versioned, owned, per-agent) |
| Evaluation | `agent-service/eval/agents_eval.py`, `agent-service/tests/`, `src/**/*.test.ts` |
| Decision records | `docs/decisions/ADR-0001…0013` |

## Current scale honesty

Single demo merchant, ~40 published styles, synthetic-but-structured funnel/booking data (seeded PRNG,
scenario-controlled capacity: idle/busy/full). The architecture decisions were made for the multi-merchant
step (repository seam, merchant-scoped queries, per-merchant policy fields), but we have not load-tested
it — see doc 07, question "what breaks at 1,000 merchants".
