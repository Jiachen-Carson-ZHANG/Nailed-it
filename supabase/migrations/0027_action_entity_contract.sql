-- ADR-0012 Phase 0a — action <-> commercial-entity linkage + group-buy persistence.
-- Agent actions today are fire-and-forget log rows with no reference to the real object they
-- created. This adds a polymorphic forward link (agent_actions -> entity) and a back link
-- (entity.source_run_id -> agent_runs), and moves group-buy deals out of browser localStorage into
-- real tables (mirroring merchant_style / merchant_style_item). No UI behaviour changes in this slice.

-- 1) agent_actions: forward link to the real commercial object it produced.
--    entity_type is polymorphic (style_ad | groupbuy_deal), so entity_id is a plain text ref (no FK).
--    Existing rows keep NULLs (they predate the entity model).
alter table public.agent_actions
  add column if not exists entity_type text
    check (entity_type is null or entity_type in ('style_ad', 'groupbuy_deal')),
  add column if not exists entity_id text;

create index if not exists agent_actions_entity_idx
  on public.agent_actions (entity_type, entity_id);

-- 2) style_ad_campaign: back link to the run that proposed it (NULL = merchant-authored, not agent).
--    Guarded: the ad-campaign tables (0022_style_ad_campaign, 0023-0025) may not be applied on every DB.
--    Re-run this migration after applying them to pick up the column (idempotent).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'style_ad_campaign'
  ) then
    alter table public.style_ad_campaign
      add column if not exists source_run_id uuid references public.agent_runs(id) on delete set null;
  end if;
end $$;

-- 3) group-buy deal (was localStorage 'nailed-it.groupbuy-deals.v1'). Authoritative service selections
--    are relational (groupbuy_deal_item); flexible policy fields stay JSONB. Prices in cents + a currency
--    snapshot so historical deals don't change meaning if the merchant currency changes (audit).
create table if not exists public.groupbuy_deal (
  id                text primary key,
  merchant_id       text not null references public.merchant(id) on delete cascade,
  title             text not null default '',
  status            text not null default 'draft'
                      check (status in ('draft', 'published', 'unlisted')),
  original_price_cents integer not null default 0 check (original_price_cents >= 0),
  deal_price_cents  integer check (deal_price_cents is null or deal_price_cents >= 0),
  currency          text not null default 'SGD',
  sale_start        jsonb not null default '{"type":"afterApproval"}',
  sale_end          jsonb not null default '{"type":"autoExtend"}',
  validity          jsonb not null default '{"type":"days","days":90}',
  sale_channel      text not null default 'unlimited'
                      check (sale_channel in ('unlimited', 'followersOnly')),
  availability      jsonb not null default '{"type":"all"}',
  benefit_sharing   text not null default 'notStackable'
                      check (benefit_sharing in ('notStackable', 'stackableAll', 'stackablePartial')),
  purchase_limit    jsonb not null default '{"type":"none"}',
  source_run_id     uuid references public.agent_runs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists groupbuy_deal_merchant_status_idx
  on public.groupbuy_deal (merchant_id, status, updated_at desc);

-- 4) group-buy deal items — the authoritative catalog selections (mirror of merchant_style_item).
create table if not exists public.groupbuy_deal_item (
  id               text primary key,
  groupbuy_deal_id text not null references public.groupbuy_deal(id) on delete cascade,
  catalog_item_id  text not null references public.catalog_item(id),
  quantity         integer not null default 1 check (quantity > 0),
  position         integer not null default 0,
  unique (groupbuy_deal_id, catalog_item_id)
);

create index if not exists groupbuy_deal_item_deal_idx
  on public.groupbuy_deal_item (groupbuy_deal_id, position);

-- 5) RLS + grants (service_role only, mirroring the other operational tables).
alter table public.groupbuy_deal      enable row level security;
alter table public.groupbuy_deal_item enable row level security;
revoke all on public.groupbuy_deal,      public.groupbuy_deal_item from anon, authenticated;
grant  all on public.groupbuy_deal,      public.groupbuy_deal_item to service_role;
