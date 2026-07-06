-- Allow custom exposure targets between 1,000 and 1,000,000.

alter table public.style_ad_campaign
  drop constraint if exists style_ad_campaign_target_exposure_check;

alter table public.style_ad_campaign
  add constraint style_ad_campaign_target_exposure_check
    check (target_exposure >= 1000 and target_exposure <= 1000000);
