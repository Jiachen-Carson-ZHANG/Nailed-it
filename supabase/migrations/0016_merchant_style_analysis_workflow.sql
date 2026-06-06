-- Dedicated merchant review workflow: upload creates a processing draft, then stored-image AI
-- analysis atomically writes its suggestion and moves the draft to needs_review.

alter table public.merchant_style
  add column if not exists analysis_started_at timestamptz;

-- Claim external AI work before calling the provider. The stale timeout recovers rows if a
-- serverless request dies after claiming but before completing/failing the analysis.
create or replace function public.claim_merchant_style_analysis(
  p_style_id text,
  p_merchant_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.merchant_style
  set analysis_started_at = now(),
      updated_at = now()
  where id = p_style_id
    and merchant_id = p_merchant_id
    and status = 'processing'
    and (
      analysis_started_at is null
      or analysis_started_at < now() - interval '10 minutes'
    );

  return found;
end;
$$;

create or replace function public.complete_merchant_style_analysis(
  p_style_id text,
  p_merchant_id text,
  p_title text,
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
  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'style_title_required';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'merchant_style_items_not_array';
  end if;
  if jsonb_typeof(coalesce(p_discovery_facets, '[]'::jsonb)) <> 'array' then
    raise exception 'merchant_style_facets_not_array';
  end if;

  select true into v_found
  from public.merchant_style
  where id = p_style_id and merchant_id = p_merchant_id and status = 'processing'
  for update;

  if v_found is null then
    raise exception 'merchant_style_not_processing';
  end if;

  update public.merchant_style
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      discovery_facets = coalesce(p_discovery_facets, '[]'::jsonb),
      preview_price_cents = p_preview_price_cents,
      preview_duration_min = p_preview_duration_min,
      status = 'needs_review',
      analysis_started_at = null,
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

create or replace function public.fail_merchant_style_analysis(
  p_style_id text,
  p_merchant_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.merchant_style
  set status = 'needs_review',
      analysis_started_at = null,
      updated_at = now()
  where id = p_style_id and merchant_id = p_merchant_id and status = 'processing';

  if not found then
    raise exception 'merchant_style_not_processing';
  end if;
end;
$$;

revoke all on function public.claim_merchant_style_analysis(text, text) from public, anon, authenticated;
grant execute on function public.claim_merchant_style_analysis(text, text) to service_role;
revoke all on function public.complete_merchant_style_analysis(text, text, text, text, jsonb, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.complete_merchant_style_analysis(text, text, text, text, jsonb, jsonb, integer, integer)
  to service_role;
revoke all on function public.fail_merchant_style_analysis(text, text) from public, anon, authenticated;
grant execute on function public.fail_merchant_style_analysis(text, text) to service_role;
