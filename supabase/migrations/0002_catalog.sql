-- Catalog (platform source of truth) — see ADR-0005.
-- CHECK constraints mirror the TypeScript unions in src/domain/catalog.ts so the DB
-- stays a trustworthy source of truth even when edited outside the app.
create table if not exists public.catalog_item (
  id text primary key,
  name_zh text not null,
  type text not null
    check (type in ('service_module','procedure','billable_component','visual_attribute','complexity_level','style_tag')),
  category text not null,
  parent_id text references public.catalog_item(id),
  user_visible text not null check (user_visible in ('yes','no')),
  ai_detectable text not null check (ai_detectable in ('yes','no','weak','user_confirmed')),
  billable text not null check (billable in ('yes','no','optional')),
  merchant_price_required text not null check (merchant_price_required in ('yes','no','optional')),
  merchant_duration_required text not null check (merchant_duration_required in ('yes','no','optional')),
  duration_config_level text not null
    check (duration_config_level in ('platform_default','merchant_optional','merchant_level','staff_level','none')),
  affects_booking_duration text not null check (affects_booking_duration in ('yes','no','optional')),
  default_duration_min integer check (default_duration_min is null or default_duration_min >= 0),
  allowed_pricing_units jsonb not null default '[]'::jsonb,
  default_pricing_unit text not null
    check (default_pricing_unit in ('fixed','included','per_finger','per_level','per_piece','per_set','tag_only')),
  quantity_supported text not null check (quantity_supported in ('yes','no','optional')),
  complexity_supported text not null check (complexity_supported in ('yes','no')),
  notes text not null default '',
  -- default unit must be one of the allowed units (mirrors the catalog integrity test)
  check (allowed_pricing_units ? default_pricing_unit)
);
create index if not exists catalog_item_type_idx on public.catalog_item (type);
alter table public.catalog_item enable row level security;
create policy "public read catalog_item" on public.catalog_item for select to anon using (true);
