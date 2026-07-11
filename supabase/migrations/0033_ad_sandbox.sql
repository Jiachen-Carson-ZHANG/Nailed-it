-- 0033 — Ad Sandbox state (ADR-0016): audience-based campaigns, revision versions, and the
-- accelerated business clock. The sandbox itself (audiences, forecast engine, hidden scenario
-- parameters) lives in code (agent-service/nailed_agents/sandbox.py); the DB stores only what the
-- UI and the monitor must read: campaign configuration + accumulated "actual" metrics + the clock.
--
-- Apply AFTER 0028. Existing campaigns keep working: audience defaults to NULL (legacy slot-based
-- rows), version defaults to 1.

alter table public.style_ad_campaign
  add column if not exists audience text
    check (audience is null or audience in ('broad_local_interest', 'saved_or_viewed', 'try_on_no_booking')),
  add column if not exists total_budget_cents integer
    check (total_budget_cents is null or total_budget_cents > 0),
  add column if not exists version integer not null default 1;

comment on column public.style_ad_campaign.audience is
  'sandbox audience id (implies funnel stage) — NULL on pre-ADR-0016 slot-based campaigns';
comment on column public.style_ad_campaign.version is
  'incremented by in-place revisions (update_ad_campaign) — same entity, versioned history';

-- The accelerated business clock: one row per merchant. advance_clock() moves it forward and runs
-- the delivery simulator for every active campaign; the UI shows it as "Demo Simulation · advance
-- business clock" — honest framing, never pretending real days elapsed on stage.
create table if not exists public.sim_state (
  merchant_id    text primary key references public.merchant(id) on delete cascade,
  clock_hours    integer not null default 0 check (clock_hours >= 0),
  scenario_seed  text not null default 'default',
  updated_at     timestamptz not null default now()
);

alter table public.sim_state enable row level security;
revoke all on public.sim_state from anon, authenticated;
grant  all on public.sim_state to service_role;
