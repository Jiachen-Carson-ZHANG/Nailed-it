-- Promotion goal targets: exposure volume for homepage campaigns, ROI for booking campaigns.

alter table public.style_ad_campaign
  add column if not exists promotion_goal text not null default 'homepage_exposure'
    check (promotion_goal in ('homepage_exposure', 'booking_conversion')),
  add column if not exists target_exposure integer not null default 5000
    check (target_exposure > 0),
  add column if not exists target_roi numeric(4, 1) not null default 2.0
    check (target_roi >= 1.0 and target_roi <= 10.0);
