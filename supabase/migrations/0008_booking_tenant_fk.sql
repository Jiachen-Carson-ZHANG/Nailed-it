-- P4a contract tightening (pre-P4b audit). Three guards on the booking contract.

-- 1. Tenant-consistent staff FK. booking.merchant_id and booking.technician_id were
--    independent FKs, so the DB would accept a technician from a different merchant.
--    A composite FK forces (technician_id, merchant_id) to be a real pair in technicians.
alter table public.technicians
  add constraint technicians_id_merchant_unique unique (id, merchant_id);

alter table public.booking
  add constraint booking_technician_same_merchant_fk
  foreign key (technician_id, merchant_id)
  references public.technicians (id, merchant_id);

-- 2. Lock down the create RPC. Postgres grants EXECUTE to PUBLIC by default; even with RLS
--    we should not expose it to anon/authenticated PostgREST callers. Service role only.
revoke all on function public.create_booking(jsonb, jsonb) from public;
revoke all on function public.create_booking(jsonb, jsonb) from anon;
revoke all on function public.create_booking(jsonb, jsonb) from authenticated;
grant execute on function public.create_booking(jsonb, jsonb) to service_role;

-- 3. A real appointment has positive duration (additive named CHECK alongside 0006's >= 0).
alter table public.booking
  add constraint booking_duration_positive check (duration_min > 0);
