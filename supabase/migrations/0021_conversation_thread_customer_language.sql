-- Persist the customer's UI language on the booking thread so server-generated messages
-- (e.g. completion thank-you) stay in the right language across restarts and instances.

alter table public.conversation_threads
  add column if not exists customer_language text not null default 'zh-CN';

-- Keep create_booking_with_thread in sync (0010 + 0019 pattern).
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
  v_id := public.create_booking(p_booking, p_items);

  insert into public.conversation_threads (
    id, booking_id, customer_name, merchant_name, related_booking_time, customer_language
  ) values (
    p_thread->>'id',
    p_thread->>'booking_id',
    coalesce(p_thread->>'customer_name', ''),
    coalesce(p_thread->>'merchant_name', ''),
    coalesce(p_thread->>'related_booking_time', ''),
    coalesce(p_thread->>'customer_language', 'zh-CN')
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
