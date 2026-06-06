create table if not exists public.technicians (
  id text primary key,
  name text not null,
  initials text not null,
  title text not null,
  active boolean not null default true
);

create table if not exists public.styles (
  id text primary key,
  title text not null,
  image_url text not null,
  popularity_score integer not null,
  discovery_facets jsonb not null,
  recognition jsonb not null
);

create table if not exists public.pricing_rules (
  id text primary key,
  category text not null,
  target text not null,
  price numeric not null,
  duration integer not null,
  enabled boolean not null default true
);

create table if not exists public.bookings (
  id text primary key,
  customer_name text not null,
  merchant_name text not null,
  style_title text not null,
  style_image_url text not null,
  date text not null,
  time text not null,
  quote jsonb not null,
  status text not null,
  technician jsonb not null,
  conversation_id text,
  notes text not null default '',
  recognition jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_threads (
  id text primary key,
  booking_id text not null,
  customer_name text not null,
  merchant_name text not null,
  related_booking_time text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  thread_id text not null references public.conversation_threads(id) on delete cascade,
  author_role text not null,
  body text not null,
  sent_at text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_id_created_at_idx on public.messages (thread_id, created_at);

-- Row Level Security

alter table public.technicians enable row level security;
alter table public.styles enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.bookings enable row level security;
alter table public.conversation_threads enable row level security;
alter table public.messages enable row level security;

-- Public read-only policies (anon may SELECT; all writes go via service role which bypasses RLS)

create policy "public read technicians"
  on public.technicians for select to anon using (true);

create policy "public read styles"
  on public.styles for select to anon using (true);

create policy "public read pricing_rules"
  on public.pricing_rules for select to anon using (true);

create policy "public read bookings"
  on public.bookings for select to anon using (true);

create policy "public read conversation_threads"
  on public.conversation_threads for select to anon using (true);

create policy "public read messages"
  on public.messages for select to anon using (true);
