// Shared catalog→tag adapter (ADR-0006). The catalog IS the taxonomy: every discovery facet label
// is a catalog item name, and the catalog's `category` is the authoritative grouping (the AI's
// stored facet `kind` is unreliable). Both the customer feed filter (style-facets.ts) and the
// intelligence read model resolve tags through here — one source of truth, no parallel tag tables.

import type { StyleDiscoveryFacet } from '@/domain/nail';
import { catalogItems } from '@/mock/catalog';

const catalogByName = new Map(
  catalogItems.map((item) => [item.nameZh, { category: item.category, type: item.type }]),
);

/** The catalog category for a facet label ('color' | 'style' | 'nail_shape' | …), or null if the
 *  label is not a known catalog item. */
export function categoryOf(label: string): string | null {
  return catalogByName.get(label)?.category ?? null;
}

/** Container service modules (颜色与效果服务 / 美术设计服务 …) leak into AI facets — never a tag. */
export function isServiceModule(label: string): boolean {
  return catalogByName.get(label)?.type === 'service_module';
}

export type CategoryTag = { label: string; category: string };

/**
 * Distinct, demand-meaningful tags from a style's facets: drops service-module containers and any
 * label with no catalog category. This is the full taxonomy view used by the intelligence read
 * model (trends / gaps / affinity) — broader than the feed's FACET_SECTIONS subset.
 */
export function tagsByCategory(facets: StyleDiscoveryFacet[]): CategoryTag[] {
  const out: CategoryTag[] = [];
  const seen = new Set<string>();
  for (const facet of facets) {
    if (seen.has(facet.label)) continue;
    if (isServiceModule(facet.label)) continue;
    const category = categoryOf(facet.label);
    if (!category) continue;
    seen.add(facet.label);
    out.push({ label: facet.label, category });
  }
  return out;
}

/** Just the demand-meaningful labels of a style's facets (tagsByCategory without the category). */
export function tagLabelsOf(facets: StyleDiscoveryFacet[]): string[] {
  return tagsByCategory(facets).map((tag) => tag.label);
}

// Generic descriptors (finish / texture / clarity / length / complexity / scene) that sit on nearly
// every style — true catalog tags, but they carry almost no taste/demand signal, so they are
// suppressed from "why recommended" chips and from trend/bot headlines (the full report still lists
// them). NOT dropped from scoring.
const GENERIC_TAGS = new Set([
  '日常通勤', '亮面', '果冻感', '透色', '纯色', '透感', '闪亮感', '简单', '中等', '复杂',
  '短甲', '中长甲', '长甲', '超长甲',
]);

export function isGenericTag(label: string): boolean {
  return GENERIC_TAGS.has(label);
}
