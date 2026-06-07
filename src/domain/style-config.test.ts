import { describe, it, expect } from 'vitest';
import type { CatalogItem } from './catalog';
import type { RecognizedCatalogItem } from './recognition-catalog';
import { buildStyleConfig } from './style-config';

function makeItem(overrides: Partial<CatalogItem> & { id: string }): CatalogItem {
  const nameZh = overrides.nameZh ?? overrides.id;
  return {
    name: overrides.name ?? { zh: nameZh, en: nameZh },
    nameZh,
    type: 'billable_component',
    category: 'base_service',
    parentId: null,
    userVisible: 'yes',
    aiDetectable: 'yes',
    billable: 'yes',
    merchantPriceRequired: 'no',
    merchantDurationRequired: 'no',
    durationConfigLevel: 'platform_default',
    affectsBookingDuration: 'yes',
    defaultDurationMin: 30,
    allowedPricingUnits: ['per_set'],
    defaultPricingUnit: 'per_set',
    defaultPriceCents: null,
    quantitySupported: 'no',
    complexitySupported: 'no',
    notes: '',
    notesLocalized: overrides.notesLocalized ?? { zh: '', en: '' },
    ...overrides,
  };
}

const catalog: CatalogItem[] = [
  makeItem({ id: 'basic_manicure_service', nameZh: '基础美甲', type: 'service_module', defaultPriceCents: 2800 }),
  makeItem({ id: 'rhinestone_large', nameZh: '大钻', billable: 'yes', defaultPriceCents: 500, defaultPricingUnit: 'per_piece', category: 'decoration' }),
  makeItem({ id: 'removal_service', nameZh: '卸甲服务', type: 'service_module', billable: 'yes', defaultPriceCents: null, aiDetectable: 'user_confirmed' }),
  makeItem({ id: 'shape_round', nameZh: '圆形', type: 'visual_attribute', billable: 'no', category: 'nail_shape', defaultPricingUnit: 'tag_only', defaultPriceCents: null }),
  makeItem({ id: 'color_nude', nameZh: '裸色', type: 'visual_attribute', billable: 'no', category: 'color', defaultPricingUnit: 'tag_only', defaultPriceCents: null }),
];

function rec(id: string, confidence: number, quantity = 1): RecognizedCatalogItem {
  return { catalogItemId: id, confidence, quantity };
}

describe('buildStyleConfig', () => {
  it('routes priced billable items to catalogBreakdown and PRESERVES quantity', () => {
    const { catalogBreakdown } = buildStyleConfig(
      [rec('basic_manicure_service', 0.95), rec('rhinestone_large', 0.9, 5)],
      catalog,
    );
    expect(catalogBreakdown).toEqual([
      { catalogItemId: 'basic_manicure_service', quantity: 1 },
      { catalogItemId: 'rhinestone_large', quantity: 5 },
    ]);
  });

  it('routes non-billable descriptive items to discoveryFacets with the right kind', () => {
    const { discoveryFacets } = buildStyleConfig(
      [rec('shape_round', 0.95), rec('color_nude', 0.9)],
      catalog,
    );
    expect(discoveryFacets).toMatchObject([
      { kind: 'shape', label: '圆形' },
      { kind: 'style', label: '裸色' },
    ]);
  });

  it('drops unknown ids (recognition is untrusted)', () => {
    const config = buildStyleConfig([rec('unknown_id', 0.99)], catalog);
    expect(config.catalogBreakdown).toHaveLength(0);
    expect(config.discoveryFacets).toHaveLength(0);
  });

  it('keeps a low-confidence priced item OUT of the breakdown until confirmed', () => {
    // rhinestone confidence below threshold -> uncertain -> excluded unless confirmed.
    const low = buildStyleConfig([rec('rhinestone_large', 0.3, 5)], catalog);
    expect(low.catalogBreakdown).toHaveLength(0);

    const confirmed = buildStyleConfig([rec('rhinestone_large', 0.3, 5)], catalog, ['rhinestone_large']);
    expect(confirmed.catalogBreakdown).toEqual([{ catalogItemId: 'rhinestone_large', quantity: 5 }]);
  });

  it('routes a user_confirmed container to facets only when confirmed', () => {
    // removal_service is aiDetectable user_confirmed -> always uncertain.
    const unconfirmed = buildStyleConfig([rec('removal_service', 0.99)], catalog);
    expect(unconfirmed.discoveryFacets).toHaveLength(0);

    const confirmed = buildStyleConfig([rec('removal_service', 0.99)], catalog, ['removal_service']);
    expect(confirmed.discoveryFacets).toMatchObject([{ kind: 'addon', label: '卸甲服务' }]);
  });

  it('builds a description from shape, style facets, and service names', () => {
    const { description } = buildStyleConfig(
      [rec('shape_round', 0.95), rec('color_nude', 0.9), rec('basic_manicure_service', 0.95)],
      catalog,
    );
    expect(description).toContain('圆形');
    expect(description).toContain('裸色');
    expect(description).toContain('基础美甲');
  });

  it('returns the default description when nothing is recognized', () => {
    expect(buildStyleConfig([], catalog).description).toBe('美甲');
  });
});
