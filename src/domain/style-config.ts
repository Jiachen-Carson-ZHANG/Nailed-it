import type { CatalogItem, CatalogSelection } from './catalog';
import type { StyleDiscoveryFacet, StyleDiscoveryFacetKind } from './nail';
import {
  bucketRecognition,
  toCatalogSelections,
  type RecognizedCatalogItem,
} from './recognition-catalog';

export type StyleConfig = {
  catalogBreakdown: CatalogSelection[];
  discoveryFacets: StyleDiscoveryFacet[];
  description: string;
};

const categoryToFacetKind: Partial<Record<string, StyleDiscoveryFacetKind>> = {
  nail_shape: 'shape',
  color: 'style',
  nail_length: 'style',
  style: 'style',
  texture: 'style',
  finish: 'style',
  art: 'style',
  color_effect: 'style',
};

function toFacetKind(item: CatalogItem): StyleDiscoveryFacetKind {
  if (item.type === 'style_tag') return 'style';
  return categoryToFacetKind[item.category] ?? 'addon';
}

/**
 * Turn raw recognizer output into a persisted style configuration.
 *
 * Recognition is untrusted JSON, so it flows through `bucketRecognition` (validates ids, drops
 * unknown / non-detectable ids, normalizes confidence + quantity) and `toCatalogSelections` (merges
 * the detected items plus any user-confirmed uncertain ones, preserving quantity). The validated
 * selections then split two ways:
 *
 * - priced billable leaves (`billable !== 'no'` + a platform `defaultPriceCents`) → `catalogBreakdown`,
 *   the authoritative, quantity-bearing input to quoteService.
 * - everything else (shapes, colors, style_tags, unpriced container parents) → `discoveryFacets`,
 *   which drive filtering and hashtag display, not pricing.
 */
export function buildStyleConfig(
  recognized: RecognizedCatalogItem[],
  catalog: CatalogItem[],
  confirmedUncertainIds: string[] = [],
): StyleConfig {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const recognition = bucketRecognition(recognized, catalog);
  const selections = toCatalogSelections(recognition, confirmedUncertainIds);

  const catalogBreakdown: CatalogSelection[] = [];
  const discoveryFacets: StyleDiscoveryFacet[] = [];

  for (const sel of selections) {
    const item = byId.get(sel.catalogItemId);
    if (!item) continue; // toCatalogSelections only emits validated ids; guard keeps the type honest.

    if (item.billable !== 'no' && item.defaultPriceCents !== null) {
      catalogBreakdown.push(sel); // keeps the merged quantity
    } else {
      // Non-billable visual attributes (shape, color, length, texture) go into discoveryFacets for
      // filtering AND into catalogBreakdown so the customer chip UI can reconstruct the full look.
      discoveryFacets.push({ kind: toFacetKind(item), label: item.nameZh });
      if (item.type === 'visual_attribute') {
        catalogBreakdown.push(sel);
      }
    }
  }

  return {
    catalogBreakdown,
    discoveryFacets,
    description: buildDescription(catalogBreakdown, discoveryFacets, byId),
  };
}

function buildDescription(
  breakdown: CatalogSelection[],
  facets: StyleDiscoveryFacet[],
  byId: Map<string, CatalogItem>,
): string {
  const shapeLabels = facets.filter((f) => f.kind === 'shape').map((f) => f.label);
  const styleLabels = facets.filter((f) => f.kind === 'style').map((f) => f.label);
  const serviceNames = breakdown
    .map((s) => byId.get(s.catalogItemId)?.nameZh)
    .filter((n): n is string => Boolean(n));

  const parts: string[] = [];
  if (shapeLabels.length > 0) parts.push(shapeLabels.join('、') + '形');
  if (styleLabels.length > 0) parts.push(styleLabels.join('、'));
  if (serviceNames.length > 0) parts.push(serviceNames.join(' + '));
  return (parts.length > 0 ? parts.join('，') : '') + '美甲';
}
