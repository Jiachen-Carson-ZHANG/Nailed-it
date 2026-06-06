-- Staff availability (P3, see ADR-0005). Reuses the existing `technicians` table as the
-- staff/provider entity rather than introducing a parallel `staff` table.
--
-- working_plan: recurring weekly hours per technician per weekday (0=Sun … 6=Sat), with
--   mid-day breaks stored as a JSONB array of {startMin,endMin} (minutes from local midnight).
-- blocked_time: one-off calendar blocks as absolute instants (timestamptz).
-- The duration-aware overlap checks live in src/domain/scheduling.ts.

create table if not exists public.working_plan (
  technician_id text not null references public.technicians(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  open_min integer not null check (open_min >= 0 and open_min < 1440),
  close_min integer not null check (close_min > open_min and close_min <= 1440),
  breaks jsonb not null default '[]'::jsonb,
  primary key (technician_id, weekday)
);
create index if not exists working_plan_technician_idx on public.working_plan (technician_id);

create table if not exists public.blocked_time (
  id text primary key,
  technician_id text not null references public.technicians(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text not null default ''
);
create index if not exists blocked_time_technician_idx on public.blocked_time (technician_id);

alter table public.working_plan enable row level security;
alter table public.blocked_time enable row level security;

create policy "public read working_plan" on public.working_plan for select to anon using (true);
create policy "public read blocked_time" on public.blocked_time for select to anon using (true);
