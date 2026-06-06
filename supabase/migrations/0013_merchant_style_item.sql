-- Relational, FK-enforced catalog selections for a style. Replaces the jsonb catalog_breakdown:
-- the breakdown is authoritative for pricing/editing/booking, so it must enforce catalog FKs and
-- never go stale when a catalog id is removed. Raw AI recognition stays jsonb (it is a snapshot).
-- Price/duration are DERIVED from these items via quoteService, never client-supplied.
-- Requires 0012 (merchant_style.description) applied first.

create table if not exists public.merchant_style_item (
  id text primary key,
  merchant_style_id text not null references public.merchant_style(id) on delete cascade,
  catalog_item_id text not null references public.catalog_item(id),
  quantity integer not null default 1 check (quantity > 0),
  position integer not null default 0,
  unique (merchant_style_id, catalog_item_id)
);

create index if not exists merchant_style_item_style_idx
  on public.merchant_style_item (merchant_style_id, position);

alter table public.merchant_style_item enable row level security;
revoke all on public.merchant_style_item from anon, authenticated;
grant all on public.merchant_style_item to service_role;

-- The jsonb mirror is superseded; the relational table is the single source of truth.
alter table public.merchant_style drop column if exists catalog_breakdown;

-- create_merchant_style no longer writes catalog_breakdown (uploads start with no items) and now
-- carries description. Items are written later via set_merchant_style_config.
create or replace function public.create_merchant_style(p_media jsonb, p_style jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.media_asset (
    id, merchant_id, original_bucket, original_path, mime_type, byte_size, source, state
  ) values (
    p_media->>'id',
    p_media->>'merchant_id',
    p_media->>'original_bucket',
    p_media->>'original_path',
    p_media->>'mime_type',
    (p_media->>'byte_size')::integer,
    p_media->>'source',
    p_media->>'state'
  );

  insert into public.merchant_style (
    id, merchant_id, primary_media_asset_id, title, description, status, discovery_facets, recognition,
    preview_price_cents, preview_duration_min
  ) values (
    p_style->>'id',
    p_style->>'merchant_id',
    p_style->>'primary_media_asset_id',
    p_style->>'title',
    coalesce(p_style->>'description', ''),
    p_style->>'status',
    coalesce(p_style->'discovery_facets', '[]'::jsonb),
    p_style->'recognition',
    nullif(p_style->>'preview_price_cents', '')::integer,
    nullif(p_style->>'preview_duration_min', '')::integer
  );
end;
$$;

-- Atomically replace a style's configuration: description, facets, derived price/duration snapshots,
-- and the relational catalog items. Preserves status, media, and recognition (audit finding 7 —
-- backfill must not recreate rows or change status). Price/duration are computed by the server
-- (quoteService) before this is called.
create or replace function public.set_merchant_style_config(
  p_style_id text,
  p_merchant_id text,
  p_description text,
  p_discovery_facets jsonb,
  p_items jsonb,
  p_preview_price_cents integer,
  p_preview_duration_min integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_found boolean;
begin
  select true into v_found
  from public.merchant_style
  where id = p_style_id and merchant_id = p_merchant_id
  for update;

  if v_found is null then
    raise exception 'merchant_style_not_found';
  end if;

  update public.merchant_style
  set description = coalesce(p_description, ''),
      discovery_facets = coalesce(p_discovery_facets, '[]'::jsonb),
      preview_price_cents = p_preview_price_cents,
      preview_duration_min = p_preview_duration_min,
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

revoke all on function public.create_merchant_style(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_merchant_style(jsonb, jsonb) to service_role;
revoke all on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.set_merchant_style_config(text, text, text, jsonb, jsonb, integer, integer)
  to service_role;
