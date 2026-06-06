-- P6.5 merchant style library + media foundation.
-- The DB stores Storage object paths and lifecycle metadata, never image bytes or signed URLs.

create table if not exists public.media_asset (
  id text primary key,
  merchant_id text not null references public.merchant(id) on delete cascade,
  original_bucket text not null,
  original_path text not null,
  published_bucket text,
  published_path text,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  source text not null check (source in ('merchant_upload', 'completed_booking', 'seed')),
  state text not null check (state in ('uploaded', 'published', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (original_bucket, original_path),
  unique (published_bucket, published_path),
  constraint media_asset_published_path_pair check (
    (published_bucket is null and published_path is null)
    or (published_bucket is not null and published_path is not null)
  )
);

create table if not exists public.merchant_style (
  id text primary key,
  merchant_id text not null references public.merchant(id) on delete cascade,
  primary_media_asset_id text not null references public.media_asset(id),
  title text not null check (length(trim(title)) > 0),
  status text not null check (status in ('processing', 'needs_review', 'published', 'archived', 'failed')),
  discovery_facets jsonb not null default '[]'::jsonb,
  recognition jsonb,
  catalog_breakdown jsonb not null default '[]'::jsonb,
  preview_price_cents integer check (preview_price_cents > 0),
  preview_duration_min integer check (preview_duration_min > 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_style_publishable check (
    status <> 'published'
    or (
      preview_price_cents is not null
      and preview_duration_min is not null
      and published_at is not null
    )
  )
);

-- Composite references make cross-merchant media/style pairing impossible.
alter table public.media_asset
  add constraint media_asset_id_merchant_unique unique (id, merchant_id);

alter table public.merchant_style
  add constraint merchant_style_media_same_merchant_fk
  foreign key (primary_media_asset_id, merchant_id)
  references public.media_asset (id, merchant_id);

create index if not exists media_asset_merchant_created_idx
  on public.media_asset (merchant_id, created_at desc);

create index if not exists merchant_style_merchant_status_updated_idx
  on public.merchant_style (merchant_id, status, updated_at desc);

create index if not exists merchant_style_published_idx
  on public.merchant_style (published_at desc)
  where status = 'published';

alter table public.media_asset enable row level security;
alter table public.merchant_style enable row level security;

-- Operational writes and reads go through service-role server actions. Customer reads also go
-- through a published-only server action so private paths never enter browser responses.
revoke all on public.media_asset from anon, authenticated;
revoke all on public.merchant_style from anon, authenticated;
grant all on public.media_asset to service_role;
grant all on public.merchant_style to service_role;

-- Bucket creation is idempotent when this migration runs through the Supabase SQL editor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-style-originals',
  'merchant-style-originals',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
    id, merchant_id, primary_media_asset_id, title, status, discovery_facets, recognition,
    catalog_breakdown, preview_price_cents, preview_duration_min
  ) values (
    p_style->>'id',
    p_style->>'merchant_id',
    p_style->>'primary_media_asset_id',
    p_style->>'title',
    p_style->>'status',
    coalesce(p_style->'discovery_facets', '[]'::jsonb),
    p_style->'recognition',
    coalesce(p_style->'catalog_breakdown', '[]'::jsonb),
    nullif(p_style->>'preview_price_cents', '')::integer,
    nullif(p_style->>'preview_duration_min', '')::integer
  );
end;
$$;

create or replace function public.publish_merchant_style(
  p_style_id text,
  p_merchant_id text,
  p_title text,
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
  set published_bucket = p_published_bucket,
      published_path = p_published_path,
      state = 'published',
      updated_at = p_published_at
  where id = v_media_id and merchant_id = p_merchant_id;

  update public.merchant_style
  set title = trim(p_title),
      preview_price_cents = p_preview_price_cents,
      preview_duration_min = p_preview_duration_min,
      status = 'published',
      published_at = p_published_at,
      updated_at = p_published_at
  where id = p_style_id and merchant_id = p_merchant_id;
end;
$$;

revoke all on function public.create_merchant_style(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_merchant_style(jsonb, jsonb) to service_role;
revoke all on function public.publish_merchant_style(text, text, text, integer, integer, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.publish_merchant_style(text, text, text, integer, integer, text, text, timestamptz) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-style-published',
  'merchant-style-published',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
