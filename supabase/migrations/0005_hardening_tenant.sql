-- Pre-P4 hardening (see ADR-0005 audit). Two changes:
--
-- 1. Remove anon SELECT from operational tables. Every app read goes through the
--    server-only service-role client (src/lib/db/client.ts), so these policies were
--    unused, and once the project URL ships they would let anyone read bookings,
--    messages, staff, schedules, and blocked-time reasons. Genuinely public reference
--    data (styles, catalog_item) keeps its anon read policy.
-- 2. Give technicians a merchant owner. Availability/booking are otherwise a single
--    global namespace; P4 cannot answer "this merchant's technicians" without it.

drop policy if exists "public read technicians" on public.technicians;
drop policy if exists "public read pricing_rules" on public.pricing_rules;
drop policy if exists "public read bookings" on public.bookings;
drop policy if exists "public read conversation_threads" on public.conversation_threads;
drop policy if exists "public read messages" on public.messages;
drop policy if exists "public read working_plan" on public.working_plan;
drop policy if exists "public read blocked_time" on public.blocked_time;

-- Tenant ownership for staff. Nail staff belong to one salon, so a single FK column
-- is enough (no merchant_technician join). Backfill existing rows, then enforce NOT NULL.
alter table public.technicians
  add column if not exists merchant_id text references public.merchant(id);
update public.technicians set merchant_id = 'merchant-nailed-it' where merchant_id is null;
alter table public.technicians alter column merchant_id set not null;
create index if not exists technicians_merchant_idx on public.technicians (merchant_id);
