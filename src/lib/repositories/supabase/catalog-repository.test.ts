import { describe, expect, it } from 'vitest';
import { catalogItems } from '@/mock/catalog';
import type { CatalogItem } from '@/domain/catalog';
import { rowToCatalogItem, type CatalogItemRow } from './catalog-repository';

// Mirror of the seed script's camelCase -> snake_case mapping, so we can round-trip
// every catalog item through the DB row shape and back without a live database.
function itemToRow(i: CatalogItem): CatalogItemRow {
  return {
    id: i.id,
    name_zh: i.nameZh,
    name: i.name,
    type: i.type,
    category: i.category,
    parent_id: i.parentId,
    user_visible: i.userVisible,
    ai_detectable: i.aiDetectable,
    billable: i.billable,
    merchant_price_required: i.merchantPriceRequired,
    merchant_duration_required: i.merchantDurationRequired,
    duration_config_level: i.durationConfigLevel,
    affects_booking_duration: i.affectsBookingDuration,
    default_duration_min: i.defaultDurationMin,
    allowed_pricing_units: i.allowedPricingUnits,
    default_pricing_unit: i.defaultPricingUnit,
    default_price_cents: i.defaultPriceCents,
    quantity_supported: i.quantitySupported,
    complexity_supported: i.complexitySupported,
    notes: i.notes,
    notes_localized: i.notesLocalized
  };
}

describe('supabase catalog row mapper', () => {
  it('round-trips every catalog item through the DB row shape (item -> row -> item)', () => {
    for (const item of catalogItems) {
      expect(rowToCatalogItem(itemToRow(item))).toEqual(item);
    }
  });

  it('maps snake_case columns and preserves null parent_id', () => {
    const mapped = rowToCatalogItem({
      id: 'x',
      name_zh: '测试',
      type: 'billable_component',
      category: 'art',
      parent_id: null,
      user_visible: 'yes',
      ai_detectable: 'weak',
      billable: 'optional',
      merchant_price_required: 'optional',
      merchant_duration_required: 'no',
      duration_config_level: 'staff_level',
      affects_booking_duration: 'yes',
      default_duration_min: 42,
      allowed_pricing_units: ['per_finger', 'per_set'],
      default_pricing_unit: 'per_finger',
      default_price_cents: 1500,
      quantity_supported: 'yes',
      complexity_supported: 'no',
      notes: 'n'
    });
    expect(mapped).toEqual({
      id: 'x',
      name: { zh: '测试', en: '测试' },
      nameZh: '测试',
      type: 'billable_component',
      category: 'art',
      parentId: null,
      userVisible: 'yes',
      aiDetectable: 'weak',
      billable: 'optional',
      merchantPriceRequired: 'optional',
      merchantDurationRequired: 'no',
      durationConfigLevel: 'staff_level',
      affectsBookingDuration: 'yes',
      defaultDurationMin: 42,
      allowedPricingUnits: ['per_finger', 'per_set'],
      defaultPricingUnit: 'per_finger',
      defaultPriceCents: 1500,
      quantitySupported: 'yes',
      complexitySupported: 'no',
      notes: 'n',
      notesLocalized: { zh: 'n', en: 'n' },
    });
  });
});
