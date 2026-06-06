create table if not exists public.merchant (
  id text primary key,
  name text not null,
  timezone text not null default 'Asia/Singapore',
  currency text not null default 'SGD',
  created_at timestamptz not null default now()
);

create table if not exists public.merchant_pricing (
  merchant_id text not null references public.merchant(id) on delete cascade,
  catalog_item_id text not null references public.catalog_item(id) on delete cascade,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_min integer check (duration_min is null or duration_min >= 0),
  pricing_unit text not null
    check (pricing_unit in ('fixed','included','per_finger','per_level','per_piece','per_set','tag_only')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (merchant_id, catalog_item_id)
);
create index if not exists merchant_pricing_merchant_idx on public.merchant_pricing (merchant_id);

alter table public.merchant enable row level security;
alter table public.merchant_pricing enable row level security;
-- No anon policies: merchant business data is read server-side via the service key only.
