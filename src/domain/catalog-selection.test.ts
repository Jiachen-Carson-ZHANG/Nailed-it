import { describe, expect, it } from 'vitest';
import { normalizeQuantityForPricingUnit } from './catalog-selection';

describe('normalizeQuantityForPricingUnit', () => {
  it('forces per-set selections to one', () => {
    expect(normalizeQuantityForPricingUnit(10, 'per_set')).toBe(1);
  });

  it('preserves quantities for every other pricing unit', () => {
    expect(normalizeQuantityForPricingUnit(3, 'fixed')).toBe(3);
    expect(normalizeQuantityForPricingUnit(4, 'per_finger')).toBe(4);
    expect(normalizeQuantityForPricingUnit(5, 'per_piece')).toBe(5);
  });
});
