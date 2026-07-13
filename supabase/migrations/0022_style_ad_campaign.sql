-- Merchant style promotion campaigns.
-- Campaigns reference the real merchant_style rows used by the style library, so the
-- promotion editor cannot drift onto mock style ids.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchant_style_id_merchant_unique'
      and conrelid = 'public.merchant_style'::regclass
  ) then
    alter table public.merchant_style
      add constraint merchant_style_id_merchant_unique unique (id, merchant_id);
  end if;
end $$;

create table if not exists public.style_ad_campaign (
  id text primary key,
  merchant_id text not null references public.merchant(id) on delete cascade,
  merchant_style_id text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  daily_budget_cents integer check (daily_budget_cents is null or daily_budget_cents > 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  bookings integer not null default 0 check (bookings >= 0),
  spend_cents integer not null default 0 check (spend_cents >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, merchant_style_id),
  constraint style_ad_campaign_style_same_merchant_fk
    foreign key (merchant_style_id, merchant_id)
    references public.merchant_style (id, merchant_id)
    on delete cascade
);

create index if not exists style_ad_campaign_merchant_status_updated_idx
  on public.style_ad_campaign (merchant_id, status, updated_at desc);

alter table public.style_ad_campaign enable row level security;
revoke all on public.style_ad_campaign from anon, authenticated;
grant all on public.style_ad_campaign to service_role;
