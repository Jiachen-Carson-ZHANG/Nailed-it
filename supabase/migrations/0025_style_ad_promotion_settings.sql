-- Promotion schedule and custom audience targeting.

alter table public.style_ad_campaign
  add column if not exists start_at date,
  add column if not exists audience_mode text not null default 'smart'
    check (audience_mode in ('smart', 'custom')),
  add column if not exists custom_audience jsonb not null default '{}'::jsonb;
