-- Allow an archived merchant style to be explicitly republished from the review editor.
-- The app still blocks plain "save draft" for archived rows; this only supports the
-- republish path, which rewrites config/items and recreates the public image copy.

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
  if v_status not in ('needs_review', 'published', 'archived') then
    raise exception 'merchant_style_not_editable';
  end if;

  update public.merchant_style
  set description = coalesce(p_description, ''),
      discovery_facets = coalesce(p_discovery_facets, '[]'::jsonb),
      preview_price_cents = p_preview_price_cents,
      preview_duration_min = p_preview_duration_min,
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
    and status in ('needs_review', 'archived')
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

  update public.merchant_style
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      status = 'published',
      published_at = p_published_at,
      archived_at = null,
      updated_at = p_published_at
  where id = p_style_id and merchant_id = p_merchant_id;
end;
$$;

revoke all on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer, text)
  to service_role;
revoke all on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  to service_role;
