import { describe, expect, it } from 'vitest';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { calculateGroupbuyOriginalPrice } from './groupbuy-pricing';

const settings = (rows: GlossaryEntrySettings[]) => new Map(rows.map((row) => [row.id, row]));

describe('calculateGroupbuyOriginalPrice', () => {
  it('counts per-set and fixed services once', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 8 },
        { catalogItemId: 'removal_extension', enabled: true, quantity: 4 },
      ],
      settingsById: settings([
        { id: 'basic_manicure_service', price: 28, duration: 50, enabled: true, unit: 'per_set' },
        { id: 'removal_extension', price: 20, duration: 30, enabled: true, unit: 'fixed' },
      ]),
    });

    expect(result.total).toBe(48);
    expect(result.lines).toEqual([
      expect.objectContaining({ catalogItemId: 'basic_manicure_service', linePrice: 28, quantity: 1 }),
      expect.objectContaining({ catalogItemId: 'removal_extension', linePrice: 20, quantity: 1 }),
    ]);
  });

  it('multiplies per-finger and per-piece services by quantity', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'gradient', enabled: true, quantity: 3 },
        { catalogItemId: 'rhinestone_small', enabled: true, quantity: 12 },
      ],
      settingsById: settings([
        { id: 'gradient', price: 5, duration: 20, enabled: true, unit: 'per_finger' },
        { id: 'rhinestone_small', price: 1.5, duration: 2, enabled: true, unit: 'per_piece' },
      ]),
    });

    expect(result.total).toBe(33);
    expect(result.lines).toEqual([
      expect.objectContaining({ catalogItemId: 'gradient', linePrice: 15, quantity: 3 }),
      expect.objectContaining({ catalogItemId: 'rhinestone_small', linePrice: 18, quantity: 12 }),
    ]);
  });

  it('skips disabled, unselected, and zero-price rows', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'cat_eye', enabled: false, quantity: 1 },
        { catalogItemId: 'glitter', enabled: true, quantity: 1 },
        { catalogItemId: 'missing_item', enabled: true, quantity: 1 },
      ],
      settingsById: settings([
        { id: 'cat_eye', price: 10, duration: 20, enabled: true, unit: 'per_set' },
        { id: 'glitter', price: 0, duration: 10, enabled: true, unit: 'per_set' },
      ]),
    });

    expect(result.total).toBe(0);
    expect(result.lines).toEqual([]);
  });
});
