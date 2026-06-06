-- Per-staff duration overrides (P4a, see ADR-0005). For catalog items whose
-- duration_config_level = 'staff_level': a given technician may work faster/slower than
-- the catalog default. P4b's quoteService prefers a staff override when present.
-- Server-only (no anon policies).

create table if not exists public.staff_item_duration (
  technician_id text not null references public.technicians(id) on delete cascade,
  catalog_item_id text not null references public.catalog_item(id) on delete cascade,
  duration_min integer not null check (duration_min >= 0),
  primary key (technician_id, catalog_item_id)
);
create index if not exists staff_item_duration_technician_idx on public.staff_item_duration (technician_id);

alter table public.staff_item_duration enable row level security;
-- No anon policies: read server-side via the service role only.
