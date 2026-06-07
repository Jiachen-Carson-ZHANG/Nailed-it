import type { CatalogSelection } from '@/domain/catalog';

/** Every bookable nail set includes base prep — ai_detectable=no so models never emit it. */
export const BASE_MANICURE_CATALOG_ID = 'basic_manicure_service';

/** Container service modules are grouping parents, not quotable line items. */
const NON_QUOTE_SERVICE_MODULE_IDS = new Set([
  'removal_service',
  'extension_service',
  'builder_service',
  'color_effect_service',
  'art_service',
  'decoration_service',
  'finish_service',
]);

/** Prepend the base manicure floor when style layers omit it (matches server publish/quote). */
export function withBaseManicure(selections: CatalogSelection[]): CatalogSelection[] {
  if (selections.some((selection) => selection.catalogItemId === BASE_MANICURE_CATALOG_ID)) {
    return selections;
  }
  return [{ catalogItemId: BASE_MANICURE_CATALOG_ID, quantity: 1 }, ...selections];
}

/** Strip container modules before quoting — callers still run {@link withBaseManicure} after. */
export function quoteableStyleSelections(selections: CatalogSelection[]): CatalogSelection[] {
  return selections.filter((selection) => !NON_QUOTE_SERVICE_MODULE_IDS.has(selection.catalogItemId));
}
