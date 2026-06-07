import type { StyleDiscoveryFacet } from '@/domain/nail';
import { categoryOf, isServiceModule } from '@/domain/catalog-tags';

// Tag→category resolution lives in the shared catalog adapter (catalog-tags.ts). This module owns
// only the feed's discovery-filter sections — the AI's stored facet `kind` is unreliable, so labels
// are bucketed by the catalog's real category.

export type FacetSection = { key: string; label: string; categories: string[] };

// Filter sections, in display order. Categories not listed here (e.g. complexity) are intentionally
// dropped — they don't make useful discovery filters.
export const FACET_SECTIONS: FacetSection[] = [
  { key: 'shape', label: '甲型', categories: ['nail_shape', 'nail_length'] },
  { key: 'color', label: '颜色', categories: ['color'] },
  { key: 'effect', label: '效果', categories: ['color_effect', 'texture', 'finish', 'art', 'decoration', 'structure'] },
  { key: 'style', label: '风格', categories: ['style'] },
];
const sectionKeyByCategory = new Map(
  FACET_SECTIONS.flatMap((section) => section.categories.map((category) => [category, section.key])),
);

function sectionKeyForLabel(label: string): string | undefined {
  const category = categoryOf(label);
  return category ? sectionKeyByCategory.get(category) : undefined;
}

// Distinct facet labels that belong to a known section (drops service modules + uncategorizable labels).
export function cleanFacetLabels(facets: StyleDiscoveryFacet[]): string[] {
  const out: string[] = [];
  for (const facet of facets) {
    if (isServiceModule(facet.label)) continue;
    if (!sectionKeyForLabel(facet.label)) continue;
    if (!out.includes(facet.label)) out.push(facet.label);
  }
  return out;
}

// Group a set of labels into ordered, non-empty sections for the filter bar.
export function groupLabelsBySection(labels: string[]): { section: FacetSection; labels: string[] }[] {
  return FACET_SECTIONS.flatMap((section) => {
    const inSection = labels.filter((label) => sectionKeyForLabel(label) === section.key);
    return inSection.length > 0 ? [{ section, labels: inSection }] : [];
  });
}

// A few representative pills for a card, ordered by section priority (甲形 → 颜色 → 效果 → …).
export function cardFacetLabels(facets: StyleDiscoveryFacet[], max = 3): string[] {
  const clean = cleanFacetLabels(facets);
  const ordered = FACET_SECTIONS.flatMap((section) =>
    clean.filter((label) => sectionKeyForLabel(label) === section.key),
  );
  return ordered.slice(0, max);
}
