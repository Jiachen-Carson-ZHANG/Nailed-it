-- 0029 — atomic group-buy save (ADR-0012 Phase 2).
--
-- GroupbuyRepository.save was three separate PostgREST calls: upsert the deal, delete its items, insert the
-- new items. A failure between the delete and the insert left a PUBLISHED deal with zero services — a live
-- offer the merchant cannot honour. This RPC runs all three inside one implicit transaction: either the
-- deal and its full item list land together, or nothing changes.
--
-- security invoker (the default): only service_role may execute it, so the caller's privileges already
-- carry the merchant scope. search_path is pinned so an injected schema cannot shadow public.

create or replace function public.save_groupbuy_deal(p_deal jsonb, p_items jsonb)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_id       text := p_deal->>'id';
  v_merchant text := p_deal->>'merchant_id';
  v_owner    text;
begin
  if v_id is null or v_merchant is null then
    raise exception 'save_groupbuy_deal: id and merchant_id are required';
  end if;

  -- A deal never changes hands. Without this an id collision would silently reassign it.
  select merchant_id into v_owner from public.groupbuy_deal where id = v_id;
  if v_owner is not null and v_owner <> v_merchant then
    raise exception 'save_groupbuy_deal: deal % belongs to merchant %', v_id, v_owner;
  end if;

  insert into public.groupbuy_deal (
    id, merchant_id, title, status, original_price_cents, deal_price_cents, currency,
    sale_start, sale_end, validity, sale_channel, availability, benefit_sharing, purchase_limit,
    source_run_id, updated_at
  ) values (
    v_id,
    v_merchant,
    coalesce(p_deal->>'title', ''),
    coalesce(p_deal->>'status', 'draft'),
    coalesce((p_deal->>'original_price_cents')::integer, 0),
    nullif(p_deal->>'deal_price_cents', '')::integer,
    coalesce(p_deal->>'currency', 'SGD'),
    -- An explicit INSERT overrides the column default, so a missing key would be a NOT NULL violation
    -- rather than falling back. Restate the table's defaults here.
    coalesce(p_deal->'sale_start', '{"type":"afterApproval"}'::jsonb),
    coalesce(p_deal->'sale_end', '{"type":"autoExtend"}'::jsonb),
    coalesce(p_deal->'validity', '{"type":"days","days":90}'::jsonb),
    coalesce(p_deal->>'sale_channel', 'unlimited'),
    coalesce(p_deal->'availability', '{"type":"all"}'::jsonb),
    coalesce(p_deal->>'benefit_sharing', 'notStackable'),
    coalesce(p_deal->'purchase_limit', '{"type":"none"}'::jsonb),
    nullif(p_deal->>'source_run_id', '')::uuid,
    coalesce((p_deal->>'updated_at')::timestamptz, now())
  )
  on conflict (id) do update set
    title                = excluded.title,
    status               = excluded.status,
    original_price_cents = excluded.original_price_cents,
    deal_price_cents     = excluded.deal_price_cents,
    currency             = excluded.currency,
    sale_start           = excluded.sale_start,
    sale_end             = excluded.sale_end,
    validity             = excluded.validity,
    sale_channel         = excluded.sale_channel,
    availability         = excluded.availability,
    benefit_sharing      = excluded.benefit_sharing,
    purchase_limit       = excluded.purchase_limit,
    source_run_id        = excluded.source_run_id,
    updated_at           = excluded.updated_at;
  -- created_at is intentionally absent: the column default owns it, and an update must not reset it.

  -- The item list is authoritative — replace it wholesale rather than diffing.
  delete from public.groupbuy_deal_item where groupbuy_deal_id = v_id;

  insert into public.groupbuy_deal_item (id, groupbuy_deal_id, catalog_item_id, quantity, position)
  select
    v_id || ':' || (item->>'catalog_item_id'),
    v_id,
    item->>'catalog_item_id',
    coalesce((item->>'quantity')::integer, 1),
    coalesce((item->>'position')::integer, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;

  return v_id;
end;
$$;

revoke all on function public.save_groupbuy_deal(jsonb, jsonb) from anon, authenticated;
grant execute on function public.save_groupbuy_deal(jsonb, jsonb) to service_role;
