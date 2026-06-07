import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import { categoryOf, isServiceModule } from '@/domain/catalog-tags';

export type FacetSection = { key: string; label: string; categories: string[] };

const FACET_SECTION_DEFS: Array<{ key: string; categories: string[] }> = [
  { key: 'shape', categories: ['nail_shape', 'nail_length'] },
  { key: 'color', categories: ['color'] },
  { key: 'effect', categories: ['color_effect', 'texture', 'finish', 'art', 'decoration', 'structure'] },
  { key: 'style', categories: ['style'] },
];

const facetSectionLabels: Record<AppLanguage, Record<string, string>> = {
  'zh-CN': {
    shape: '甲型',
    color: '颜色',
    effect: '效果',
    style: '风格',
  },
  en: {
    shape: 'Shape',
    color: 'Color',
    effect: 'Effect',
    style: 'Style',
  },
};

/** Filter sections in display order. Categories not listed (e.g. complexity) are dropped. */
export function getFacetSections(language: AppLanguage): FacetSection[] {
  const labels = facetSectionLabels[language];
  return FACET_SECTION_DEFS.map((def) => ({
    key: def.key,
    label: labels[def.key] ?? def.key,
    categories: def.categories,
  }));
}

// Backward-compatible default for callers that don't pass language yet.
export const FACET_SECTIONS: FacetSection[] = getFacetSections('zh-CN');

const sectionKeyByCategory = new Map(
  FACET_SECTION_DEFS.flatMap((section) => section.categories.map((category) => [category, section.key])),
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
export function groupLabelsBySection(
  labels: string[],
  language: AppLanguage = 'zh-CN',
): { section: FacetSection; labels: string[] }[] {
  const sections = getFacetSections(language);
  return sections.flatMap((section) => {
    const inSection = labels.filter((label) => sectionKeyForLabel(label) === section.key);
    return inSection.length > 0 ? [{ section, labels: inSection }] : [];
  });
}

// A few representative pills for a card, ordered by section priority (甲形 → 颜色 → 效果 → …).
export function cardFacetLabels(facets: StyleDiscoveryFacet[], max = 3): string[] {
  const clean = cleanFacetLabels(facets);
  const ordered = FACET_SECTION_DEFS.flatMap((section) =>
    clean.filter((label) => sectionKeyForLabel(label) === section.key),
  );
  return ordered.slice(0, max);
}
