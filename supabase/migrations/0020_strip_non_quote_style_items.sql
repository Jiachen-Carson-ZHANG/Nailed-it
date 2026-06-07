-- Strip service-module container rows from merchant_style_item. These grouping parents
-- (color_effect_service, art_service, decoration_service, …) are UI/catalog structure,
-- not billable line items. Older AI breakdowns and editor saves could persist them alongside
-- real leaf selections, which blocked publish with unresolved_pricing.
--
-- This does NOT delete merchant_style rows or media — only invalid item rows. Styles keep
-- their status, title, and preview snapshots; re-open + Save/Publish (or configure:styles)
-- recomputes preview from the remaining quoteable selections.

delete from public.merchant_style_item
where catalog_item_id in (
  'removal_service',
  'extension_service',
  'builder_service',
  'color_effect_service',
  'art_service',
  'decoration_service',
  'finish_service'
);
