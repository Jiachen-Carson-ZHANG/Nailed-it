import { describe, expect, it } from 'vitest';
import {
  BASE_MANICURE_CATALOG_ID,
  quoteableStyleSelections,
  withBaseManicure,
} from '@/domain/style-selections';

describe('withBaseManicure', () => {
  it('prepends base manicure when missing', () => {
    const result = withBaseManicure([{ catalogItemId: 'builder_gel', quantity: 1 }]);
    expect(result[0]).toEqual({ catalogItemId: BASE_MANICURE_CATALOG_ID, quantity: 1 });
    expect(result[1]).toEqual({ catalogItemId: 'builder_gel', quantity: 1 });
  });

  it('is idempotent when base manicure is already present', () => {
    const input = [{ catalogItemId: BASE_MANICURE_CATALOG_ID, quantity: 1 }];
    expect(withBaseManicure(input)).toEqual(input);
  });
});

describe('quoteableStyleSelections', () => {
  it('removes container service modules', () => {
    const result = quoteableStyleSelections([
      { catalogItemId: 'builder_service', quantity: 1 },
      { catalogItemId: 'builder_gel', quantity: 1 },
    ]);
    expect(result).toEqual([{ catalogItemId: 'builder_gel', quantity: 1 }]);
  });
});
