import { describe, expect, it } from 'vitest';
import { catalogItems } from '@/mock/catalog';
import { buildBreakdownFromConfig } from './ComponentBreakdownPanel';

// Regression for the merchant editor showing "no colour configured": the merchant pipeline stores
// colour / shape / length / finish as discovery facets, NOT as priced catalogBreakdown selections.
// buildBreakdownFromConfig must merge those facet labels back into the breakdown so the editor seeds
// them, otherwise a published/re-edited style looks unconfigured.
describe('buildBreakdownFromConfig', () => {
  it('merges descriptive facets (colour) that live outside catalogBreakdown', () => {
    const color = catalogItems.find((item) => item.category === 'color');
    expect(color, 'catalog should have a colour item').toBeDefined();

    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      [color!.nameZh],
    );

    // The colour facet is seeded into the breakdown even though it was not a priced selection.
    expect(result.items.some((item) => item.nameZh === color!.nameZh)).toBe(true);
    expect(result.catalogSelections.length).toBeGreaterThan(1);
  });

  it('keeps the original priced selections', () => {
    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      [],
    );
    expect(result.catalogSelections).toEqual([{ catalogItemId: 'basic_manicure_service', quantity: 1 }]);
  });
});
