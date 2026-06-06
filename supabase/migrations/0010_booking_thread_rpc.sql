-- Atomic booking + conversation-thread create (see ADR-0005, P4d follow-up).
-- Replaces the two-round-trip create + compensating-cancel that createBookingAction used:
-- booking + items + thread + greeting message(s) all commit in ONE transaction. A thread or
-- message insert failure now rolls the booking back too, so there is no orphan booking and no
-- empty thread. Server-only, like create_booking.

create or replace function public.create_booking_with_thread(
  p_booking jsonb,
  p_items jsonb,
  p_thread jsonb,
  p_messages jsonb
)
returns text
language plpgsql
as $$
declare
  v_id text;
begin
  -- Reuse create_booking in the same transaction: booking + items, with the GiST
  -- exclusion-constraint overlap handling. It raises 'booking_overlap' (errcode 23P01) on a
  -- conflict, which propagates out of this function and aborts the whole insert.
  v_id := public.create_booking(p_booking, p_items);

  insert into public.conversation_threads (
    id, booking_id, customer_name, merchant_name, related_booking_time
  ) values (
    p_thread->>'id',
    p_thread->>'booking_id',
    coalesce(p_thread->>'customer_name', ''),
    coalesce(p_thread->>'merchant_name', ''),
    coalesce(p_thread->>'related_booking_time', '')
  );

  insert into public.messages (id, thread_id, author_role, body, sent_at)
  select
    elem->>'id',
    p_thread->>'id',
    elem->>'author_role',
    coalesce(elem->>'body', ''),
    coalesce(elem->>'sent_at', '')
  from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) as elem;

  return v_id;
end;
$$;

revoke all on function public.create_booking_with_thread(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_booking_with_thread(jsonb, jsonb, jsonb, jsonb)
  to service_role;
