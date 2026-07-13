-- 0030 — round blackboard + cross-round memory (ADR-0013 P2).
--
-- agent_rounds: one row per orchestrated round; `blackboard` is the round's shared working state
-- (sections written deterministically by the Python orchestrator as lanes conclude). agent_runs.round_id
-- groups a round's runs for the panel.
--
-- agent_memory: what the team LEARNED, surviving across rounds. Contract (ADR-0013 §3, audit-tightened):
-- raw metrics stay in style_ad_campaign / event tables — those are the truth and always win a conflict.
-- Memory rows are windowed, entity-keyed VERDICTS ("7d 实测 ROAS 2.1，估算 4.1 —— 高估 2 倍") with an
-- evidence run and an expiry. unique(merchant_id, kind, key) makes re-measurement an upsert, not a stack.

create table if not exists public.agent_rounds (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  text not null references public.merchant(id) on delete cascade,
  status       text not null default 'running'
                 check (status in ('running', 'completed', 'failed')),
  blackboard   jsonb not null default '{}',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists agent_rounds_merchant_idx
  on public.agent_rounds (merchant_id, started_at desc);

alter table public.agent_runs
  add column if not exists round_id uuid references public.agent_rounds(id) on delete set null;

create index if not exists agent_runs_round_idx on public.agent_runs (round_id);

create table if not exists public.agent_memory (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     text not null references public.merchant(id) on delete cascade,
  agent_slug      text not null,
  kind            text not null
                    check (kind in ('ad_outcome', 'coupon_outcome', 'round_verdict')),
  key             text not null,
  content         jsonb not null default '{}',
  entity_type     text check (entity_type in ('style_ad', 'groupbuy_deal')),
  entity_id       text,
  window_start    timestamptz,
  window_end      timestamptz,
  evidence_run_id uuid references public.agent_runs(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  unique (merchant_id, kind, key)
);

create index if not exists agent_memory_merchant_idx
  on public.agent_memory (merchant_id, created_at desc);

-- RLS + grants: service_role only, mirroring the other agent tables (0022).
alter table public.agent_rounds enable row level security;
alter table public.agent_memory enable row level security;
revoke all on public.agent_rounds, public.agent_memory from anon, authenticated;
grant  all on public.agent_rounds, public.agent_memory to service_role;
