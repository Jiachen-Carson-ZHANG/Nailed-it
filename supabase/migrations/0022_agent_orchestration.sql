-- 0022_agent_orchestration.sql  (ADR-0007 — Merchant Operations Agent Team)
-- The thin observability substrate the Python agent service writes to and the /merchant/agents
-- panel reads from. Agents-as-data + targeted runs + transcript + concrete actions. Scoped by
-- merchant_id; no tenancy/RLS (competition demo, ADR-0006). Server-only writes via service client.
--
-- MANUAL Supabase apply (no CLI), same as 0017 / 0019.

-- Agent definitions (Multica agenttmpl analogue) — agents are data.
create table if not exists public.agents (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,          -- 'orchestrator'|'insight'|'decision'|'ad'|'coupon'|'catalog'|'customer_ops'|'monitor'
  name         text not null,
  role         text not null,                 -- 'lead'|'analyst'|'planner'|'operator'|'reviewer'
  instructions text not null default '',       -- system prompt, verbatim into the Claude call
  tools        text[] not null default '{}',   -- allow-list of tool names
  version      int  not null default 1,
  created_at   timestamptz not null default now()
);

-- One row per targeted dispatch + its thinking-chain transcript.
create table if not exists public.agent_runs (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.agents(id) on delete cascade,
  merchant_id    text not null,
  trigger_source text not null default 'manual',   -- manual|event|schedule
  parent_run_id  uuid references public.agent_runs(id) on delete set null,  -- Monitor → 数分 closes loop
  status         text not null default 'running',   -- running|completed|failed|awaiting_approval
  input          jsonb not null default '{}',
  output         jsonb,
  transcript     jsonb not null default '[]',       -- reasoning ⇄ tool ⇄ action steps
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index if not exists agent_runs_merchant_started_idx
  on public.agent_runs (merchant_id, started_at desc);

-- Concrete side-effects a run performed (the undo / future-approval ramp).
create table if not exists public.agent_actions (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.agent_runs(id) on delete cascade,
  merchant_id text not null,
  type        text not null,                     -- place_ad|set_group_buy_coupon|list_style|delist_style|draft_upload|send_customer_message
  risk        text not null default 'reversible',-- reversible|irreversible
  status      text not null default 'applied',   -- applied|undone|proposed|approved
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists agent_actions_run_idx on public.agent_actions (run_id);

alter table public.agents        enable row level security;
alter table public.agent_runs    enable row level security;
alter table public.agent_actions enable row level security;
-- No anon policies: service-role only (the Python service + server actions).
