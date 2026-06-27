# Nailed-it Agent Service (ADR-0007, Phase 3)

Full-Python merchant operations agent team. Reasoning runs on **Claude** (prod) or **OpenRouter**
(cheap dev) — one flag, same code (see Setup); the team reads grounded numbers from the TS app and
writes its runs + actions to **Supabase**, which the `/merchant/agents` panel reads. Supabase is the
shared bus — the only TS contact is the briefing + customer-roster reads.

```
TS app ──/api/agent/briefing──▶ (grounded insights, ADR-0006)
   ▲                                        │
   │ panel reads agent_runs/agent_actions   ▼
Supabase ◀──── this service writes runs+actions, calls Claude
```

## Phase 3 chain — the full team loop, tool-call loops
`数分` → `决策` → `投广` → `团购` → `运营(上下架)` → `用户运营` → `Monitor` → `数分'`. The **outer sequence is
deterministic** (fixed, demo-predictable); **inside each step the agent runs a Claude tool-call loop**
via the Anthropic SDK's **`tool_runner` (beta)** — it reasons, calls a tool from its allow-list, reads
the result, and loops. Each agent's *process* is a **skill file we own** under `skills/` (loaded as the
system prompt) — **not** the `.claude/skills` feature. Each step opens a `running` agent_run, the
loop's tools write `agent_actions` + transcript steps against it, then the run is finalized. Runs are
**parented** so the panel renders the loop as a tree.

- 决策 emits **both** an 投广 and a 团购 action.
- 运营 lists/delists existing styles (auto, reversible). When a demand gap has **no internal match**, it
  can only **`propose_listing`** — written `status='proposed'`, the run finalizes as
  `awaiting_approval`, and the merchant must **Approve** (+ supply the image) in the panel. This is
  **the one human gate** (ADR-0007 §4); the agent cannot fabricate the design.
- 用户运营 reads the grounded customer roster (`/api/agent/customers`) and sends a boss-message to the
  most-lapsed customer (auto, reversible).
- Monitor is read-only (measures/baselines lift, **never invents %**) and re-dispatches a short `数分'`
  re-baseline parented to itself — closing the B→C loop without recursing.

**Deferred (Phase 3b):** the actual publish-on-approve into `merchant_style`, and the in-context
surfaces (投广页面 / 价格config / 老板msg). Like Phase 1/2's `place_ad`/`coupon`, Phase 3 actions are
panel-level `agent_actions` rows (undoable / approvable) — rendering them on the real pages is a
separate cross-cutting pass that touches the style + messages features.

> `tool_runner` and the `@beta_tool` decorator are **beta** in the `anthropic` SDK — `pip install -e .`
> pulls the latest; run `pip install -U anthropic` if `client.beta.messages.tool_runner` is missing.

## Setup
Prereqs: migration `0022` applied + `npm run seed:agents` (so the `agents` rows exist).

```bash
cd agent-service
python -m venv .venv && source .venv/bin/activate   # or: uv venv && source .venv/bin/activate
pip install -e .                                     # or: uv pip install -e .
# the TS app must be running (npm run dev) so the briefing/customers endpoints are reachable
python -m nailed_agents
```

### Pick a model provider (one flag — same orchestrator/skills/tools either way)
Set keys in the **repo-root `.env.local`** (Supabase keys are already there).

- **`MODEL_PROVIDER=anthropic`** (default, prod) — Claude via the SDK `tool_runner` (beta). Needs
  `ANTHROPIC_API_KEY`. Default model `claude-haiku-4-5` (cheap); set `AGENT_MODEL=claude-opus-4-8`
  (or `claude-sonnet-4-6`) for the demo.
- **`MODEL_PROVIDER=openrouter`** (cheap dev) — Gemini/GPT/etc via the OpenAI SDK pointed at
  OpenRouter. Needs `OPENROUTER_API_KEY` (one key → many models). Default model
  `google/gemini-2.5-flash` (verified live); set `AGENT_MODEL=openai/gpt-4o-mini` etc. to switch.
  Note: a standalone `GEMINI_API_KEY` is **not** used — OpenRouter reaches Gemini via `OPENROUTER_API_KEY`.

```bash
# cheap dev round on Gemini via OpenRouter:
MODEL_PROVIDER=openrouter OPENROUTER_API_KEY=sk-or-... python -m nailed_agents
```

> ⚠️ Dev≠prod skew: you're testing on Gemini/GPT but shipping on Claude — small behavior differences
> are possible (these agents are simple, so low-risk). Final verification should run once on Claude.

Other env (all optional): `NAILED_APP_URL` (default `http://localhost:3000`), `NAILED_MERCHANT_ID`
(default `merchant-nailed-it`), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`).

After a run, open `/merchant/agents` → the eight new runs appear with their thinking chains; 投广/团购
carry undoable actions, 运营 may carry a **proposed** `draft_upload` with **Approve/Reject**, 用户运营 an
undoable boss-message. (`npm run seed:agents` also writes a cold demo of the full loop incl. the gate —
no API key needed.)

## Tests
Network-free (bus I/O + the model client are stubbed — no Supabase / model calls):
```bash
.venv/bin/pip install -e ".[dev]"   # pytest
.venv/bin/python -m pytest tests/ -q
```
Covers: OpenAI-schema derivation, registry integrity, tool side-effects + transcript, the gated
proposal (`propose_listing` → awaiting_approval), and the OpenRouter loop (tool execution, plain-text
turn, tool-error feedback). The panel/repo side is covered by
`src/lib/repositories/memory/agent-repository.test.ts` (vitest), incl. the approve-gate regression.

## Layout
- `config.py` — env + `MODEL_PROVIDER` selection (reuses repo-root `.env.local`).
- `bus.py` — Supabase I/O + the grounded reads (`fetch_briefing` / `fetch_customers`) + `start_run` / `finish_run` / `write_action`.
- `tools.py` — ONE set of plain tool functions (get_merchant_insights, get_customer_intelligence, place_ad, set_group_buy_coupon, list_style, delist_style, propose_listing [gated], send_customer_message), exposed as both `BETA_TOOLS` (Anthropic) and auto-derived `OPENAI_TOOLS` (OpenRouter); they record their own transcript steps + side-effects.
- `runner.py` — runs one agent as a tool-call loop; `MODEL_PROVIDER` picks the backend (Anthropic `tool_runner` or an OpenAI-format loop via OpenRouter). Both drive the same tool bodies + transcript.
- `orchestrator.py` — the deterministic full loop 数分→决策→投广→团购→运营→用户运营→Monitor→数分'; each step is a tool-call loop; the gate (propose_listing) finalizes its run as `awaiting_approval`.
- `skills/*.md` — each agent's process spec (system prompt). Ours, not `.claude/skills`.
- `__main__.py` — `python -m nailed_agents`.
