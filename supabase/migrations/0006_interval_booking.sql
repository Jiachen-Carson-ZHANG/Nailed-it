-- Interval-based booking (P4a, see ADR-0005). Coexists with the flat `bookings` table
-- from 0001 until P4e retires the flat model. Server-only (no anon policies).
--
-- The no-double-book guarantee is enforced in Postgres, not app code: a partial GiST
-- exclusion constraint makes two overlapping live bookings for one technician physically
-- impossible. btree_gist is required to combine `technician_id =` with the range `&&`.

create extension if not exists btree_gist;

create table if not exists public.booking (
  id text primary key,
  merchant_id text not null references public.merchant(id),
  technician_id text not null references public.technicians(id),
  customer_name text not null default '',
  style_title text not null default '',
  style_image_url text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_min integer not null check (duration_min >= 0),
  status text not null
    check (status in ('pending_review','confirmed','in_progress','completed','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  -- tstzrange default '[)' is half-open, matching the kernel's overlap semantics.
  constraint booking_no_overlap exclude using gist (
    technician_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled')
);
create index if not exists booking_technician_time_idx on public.booking (technician_id, start_at);
create index if not exists booking_merchant_idx on public.booking (merchant_id);

create table if not exists public.booking_item (
  id text primary key,
  booking_id text not null references public.booking(id) on delete cascade,
  catalog_item_id text references public.catalog_item(id) on delete set null,
  label text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_min integer not null default 0 check (duration_min >= 0),
  quantity integer not null default 1 check (quantity >= 1),
  pricing_unit text not null
    check (pricing_unit in ('fixed','included','per_finger','per_level','per_piece','per_set','tag_only')),
  affects_duration boolean not null default false
);
create index if not exists booking_item_booking_idx on public.booking_item (booking_id);

alter table public.booking enable row level security;
alter table public.booking_item enable row level security;
-- No anon policies: bookings are read/written server-side via the service role only.

-- Atomic create: booking + its items in one transaction. The exclusion constraint rejects
-- overlaps, so two concurrent calls cannot both pass an availability check and insert.
create or replace function public.create_booking(p_booking jsonb, p_items jsonb)
returns text
language plpgsql
as $$
declare
  v_id text;
begin
  insert into public.booking (
    id, merchant_id, technician_id, customer_name, style_title, style_image_url,
    start_at, end_at, duration_min, status, notes
  ) values (
    p_booking->>'id',
    p_booking->>'merchant_id',
    p_booking->>'technician_id',
    coalesce(p_booking->>'customer_name', ''),
    coalesce(p_booking->>'style_title', ''),
    coalesce(p_booking->>'style_image_url', ''),
    (p_booking->>'start_at')::timestamptz,
    (p_booking->>'end_at')::timestamptz,
    (p_booking->>'duration_min')::int,
    p_booking->>'status',
    coalesce(p_booking->>'notes', '')
  )
  returning id into v_id;

  insert into public.booking_item (
    id, booking_id, catalog_item_id, label, price_cents, duration_min, quantity, pricing_unit, affects_duration
  )
  select
    elem->>'id',
    v_id,
    elem->>'catalog_item_id',
    coalesce(elem->>'label', ''),
    coalesce((elem->>'price_cents')::int, 0),
    coalesce((elem->>'duration_min')::int, 0),
    coalesce((elem->>'quantity')::int, 1),
    elem->>'pricing_unit',
    coalesce((elem->>'affects_duration')::boolean, false)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem;

  return v_id;
exception
  when exclusion_violation then
    raise exception 'booking_overlap: technician % already booked for that interval', p_booking->>'technician_id'
      using errcode = '23P01';
end;
$$;
