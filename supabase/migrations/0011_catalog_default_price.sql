-- Catalog dictionary refresh (Phase 1, see docs/plans/2026-06-06-style-config-and-favorites.md).
-- The Lark "Dictionary" sheet changed:
--   * added a platform `default_price` column (becomes catalog_item.default_price_cents);
--   * dropped the `pricing_units` allowed-list column (the default unit is now the single allowed
--     unit, so allowed_pricing_units is generated as [default] — no schema change here);
--   * removed 7 items and added 4 (removal_short_origin, dual_color, aurora_powder, pearl_powder).
-- This migration adds the price column and removes the dropped items. Re-run
-- scripts/seed-supabase.ts afterwards to upsert the refreshed rows (incl. default_price_cents)
-- and the 4 new items.

alter table public.catalog_item
  add column if not exists default_price_cents integer
  check (default_price_cents is null or default_price_cents >= 0);

-- Remove the 7 dropped items. All are leaf items (nothing references them as a parent),
-- booking_item.catalog_item_id is ON DELETE SET NULL, and no merchant_pricing rows reference
-- them, so the delete is safe.
delete from public.catalog_item where id in (
  'extension_extra_long',
  'extension_long',
  'extension_medium',
  'extension_short',
  'magnetic_special_effect',
  'removal_short_extension',
  'texture_cat_eye_light'
);
