-- Merchant Intelligence Layer (ADR-0006). Two real tables; everything else — profiles, demand
-- trends, catalog gaps, low-conversion flags, ranking — is computed on read from analytics_events
-- through the catalog adapter. No materialized metric/profile tables.
--
-- Identifier columns are text to match the existing text PKs (merchant.id, merchant_style.id,
-- technicians.id, booking.id). analytics_events.id is uuid (it is never referenced by an FK).
-- Server-only: read/written via the service role, no anon policies (mirrors 0006).

create table if not exists public.customers (
  id text primary key,
  merchant_id text not null references public.merchant(id),
  handle text unique,                       -- stable key the mock customer session maps to ('melissa')
  name text not null,                       -- must equal booking.customer_name for the intel panel join
  avatar_url text,
  persona_note text,
  created_at timestamptz not null default now()
);
create index if not exists customers_merchant_idx on public.customers (merchant_id);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id text references public.merchant(id),
  customer_id text references public.customers(id),  -- null for anonymous
  session_id text,
  event_type text not null,                 -- style_impression | style_card_click | style_detail_view |
                                            -- style_save | search_submitted | search_no_result |
                                            -- try_on_completed | booking_confirmed | recommended_style_sent
  event_source text,                        -- surface: customer_home_feed | search | try_on | ...
  style_id text,                            -- soft ref to merchant_style(id): styles archive, keep the event
  booking_id text,
  technician_id text,
  query text,
  rank_position integer,
  algorithm_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_merchant_time_idx on public.analytics_events (merchant_id, created_at);
create index if not exists analytics_events_customer_time_idx on public.analytics_events (customer_id, created_at);
create index if not exists analytics_events_style_idx on public.analytics_events (style_id);
create index if not exists analytics_events_type_time_idx on public.analytics_events (event_type, created_at);

alter table public.customers enable row level security;
alter table public.analytics_events enable row level security;
-- No anon policies: intelligence is read/written server-side via the service role only.
