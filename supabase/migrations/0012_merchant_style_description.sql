-- Add description to merchant_style and update publish_merchant_style RPC to accept it.

alter table public.merchant_style
  add column if not exists description text not null default '';

-- Drop the old 8-param signature before creating the new 9-param one.
drop function if exists public.publish_merchant_style(
  text, text, text, integer, integer, text, text, timestamptz
);

create or replace function public.publish_merchant_style(
  p_style_id        text,
  p_merchant_id     text,
  p_title           text,
  p_description     text,
  p_preview_price_cents   integer,
  p_preview_duration_min  integer,
  p_published_bucket      text,
  p_published_path        text,
  p_published_at          timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_media_id text;
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

  update public.media_asset
  set
    published_bucket = p_published_bucket,
    published_path   = p_published_path,
    state            = 'published',
    updated_at       = p_published_at
  where id = v_media_id
    and merchant_id = p_merchant_id;

  update public.merchant_style
  set
    title               = p_title,
    description         = p_description,
    status              = 'published',
    preview_price_cents = p_preview_price_cents,
    preview_duration_min = p_preview_duration_min,
    published_at        = p_published_at,
    updated_at          = p_published_at
  where id = p_style_id
    and merchant_id = p_merchant_id;
end;
$$;

revoke all on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.publish_merchant_style(text, text, text, text, integer, integer, text, text, timestamptz)
  to service_role;
