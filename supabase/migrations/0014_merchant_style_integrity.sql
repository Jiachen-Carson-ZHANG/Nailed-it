-- Integrity hardening for the merchant style config/publish path (audit follow-up to 0012/0013).
-- 0013 is already applied, so corrections land here rather than editing it.
-- Pure SQL: the RPC signatures are unchanged, so no application code changes are required.

-- 1. Quantity upper bound aligns the DB with quoteService (which accepts 1..100). The lower bound
--    (> 0) already exists from 0013. Drop-then-add keeps the migration re-runnable.
alter table public.merchant_style_item
  drop constraint if exists merchant_style_item_quantity_max;
alter table public.merchant_style_item
  add constraint merchant_style_item_quantity_max check (quantity <= 100);

-- 2. set_merchant_style_config: validate the JSONB inputs are arrays and refuse to edit an archived
--    style (it only checked id + merchant before). Items + derived preview are still written together
--    in one transaction, so they can never diverge.
create or replace function public.set_merchant_style_config(
  p_style_id text,
  p_merchant_id text,
  p_description text,
  p_discovery_facets jsonb,
  p_items jsonb,
  p_preview_price_cents integer,
  p_preview_duration_min integer,
  p_title text default ''
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'merchant_style_items_not_array';
  end if;
  if jsonb_typeof(coalesce(p_discovery_facets, '[]'::jsonb)) <> 'array' then
    raise exception 'merchant_style_facets_not_array';
  end if;

  select status into v_status
  from public.merchant_style
  where id = p_style_id and merchant_id = p_merchant_id
  for update;

  if v_status is null then
    raise exception 'merchant_style_not_found';
  end if;
  if v_status = 'archived' then
    raise exception 'merchant_style_archived';
  end if;

  update public.merchant_style
  set description = coalesce(p_description, ''),
      discovery_facets = coalesce(p_discovery_facets, '[]'::jsonb),
      preview_price_cents = p_preview_price_cents,
      preview_duration_min = p_preview_duration_min,
      -- AI naming sets the title; an empty p_title preserves the existing one.
      title = coalesce(nullif(trim(p_title), ''), title),
      updated_at = now()
  where id = p_style_id and merchant_id = p_merchant_id;

  delete from public.merchant_style_item where merchant_style_id = p_style_id;

  insert into public.merchant_style_item (id, merchant_style_id, catalog_item_id, quantity, position)
  select
    elem->>'id',
    p_style_id,
    elem->>'catalog_item_id',
    coalesce((elem->>'quantity')::integer, 1),
    coalesce((elem->>'position')::integer, (ord - 1)::integer)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(elem, ord);
end;
$$;

-- 3. publish_merchant_style: require at least one relational item, and STOP writing the preview
--    snapshot. set_merchant_style_config is now the sole writer of items + preview (atomically
--    together), so a concurrent reconfigure can no longer leave items from B with a preview from A.
--    Signature is unchanged (the preview params are accepted but intentionally ignored) so callers
--    do not change; the publishable CHECK still guarantees preview is non-null at publish time.
create or replace function public.publish_merchant_style(
  p_style_id text,
  p_merchant_id text,
  p_title text,
  p_description text,
  p_preview_price_cents integer,
  p_preview_duration_min integer,
  p_published_bucket text,
  p_published_path text,
  p_published_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_media_id text;
  v_item_count integer;
begin
  select primary_media_asset_id
  into v_media_id
  from public.merchant_style
  where id = p_style_id
    and merchant_id = p_merchant_id
    and status = 'needs_review'
  for update;

  if v_media_id is null then
    raise exception 'merchant_style_not_publishable';
  end if;

  select count(*) into v_item_count
  from public.merchant_style_item
  where merchant_style_id = p_style_id;

  if v_item_count = 0 then
    raise exception 'merchant_style_no_items';
  end if;

  update public.media_asset
  set published_bucket = p_published_bucket,
      published_path = p_published_path,
      state = 'published',
      updated_at = p_published_at
  where id = v_media_id and merchant_id = p_merchant_id;

  -- preview_price_cents / preview_duration_min are owned by set_merchant_style_config; do not touch.
  update public.merchant_style
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      status = 'published',
      published_at = p_published_at,
      updated_at = p_published_at
  where id = p_style_id and merchant_id = p_merchant_id;
end;
$$;

revoke all on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer, text)
  to service_role;
-- Drop the prior 7-arg signature (superseded by the title-bearing one above).
drop function if exists public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer);
revoke all on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  to service_role;
