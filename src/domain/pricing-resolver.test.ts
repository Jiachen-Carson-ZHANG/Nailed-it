import { describe, it, expect } from 'vitest';
import type { CatalogItem } from '@/domain/catalog';
import type { MerchantPricing } from '@/domain/merchant';
import { resolveEffectivePricing } from './pricing-resolver';

function makeCatalogItem(overrides: Partial<CatalogItem> & { id: string; billable: CatalogItem['billable'] }): CatalogItem {
  const base: CatalogItem = {
    id: overrides.id,
    nameZh: '测试',
    type: 'billable_component',
    category: 'test',
    parentId: null,
    userVisible: 'yes',
    aiDetectable: 'no',
    billable: overrides.billable,
    merchantPriceRequired: 'yes',
    merchantDurationRequired: 'no',
    durationConfigLevel: 'platform_default',
    affectsBookingDuration: 'yes',
    defaultDurationMin: 30,
    allowedPricingUnits: ['fixed'],
    defaultPricingUnit: 'fixed',
    quantitySupported: 'no',
    complexitySupported: 'no',
    notes: '',
  };
  return { ...base, ...overrides };
}

describe('resolveEffectivePricing', () => {
  it('excludes items with billable === "no"', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({ id: 'svc-yes', billable: 'yes' }),
      makeCatalogItem({ id: 'svc-no', billable: 'no' }),
      makeCatalogItem({ id: 'svc-optional', billable: 'optional' }),
    ];
    const result = resolveEffectivePricing(catalog, []);
    const ids = result.map((r) => r.catalogItemId);
    expect(ids).toContain('svc-yes');
    expect(ids).toContain('svc-optional');
    expect(ids).not.toContain('svc-no');
    expect(result).toHaveLength(2);
  });

  it('merchant override sets price, duration, unit, enabled and source=merchant', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({ id: 'svc-a', billable: 'yes', defaultDurationMin: 30, defaultPricingUnit: 'fixed' }),
    ];
    const override: MerchantPricing = {
      merchantId: 'merchant-1',
      catalogItemId: 'svc-a',
      priceCents: 2500,
      durationMin: 45,
      pricingUnit: 'per_set',
      enabled: false,
    };
    const [item] = resolveEffectivePricing(catalog, [override]);
    expect(item.catalogItemId).toBe('svc-a');
    expect(item.priceCents).toBe(2500);
    expect(item.durationMin).toBe(45);
    expect(item.pricingUnit).toBe('per_set');
    expect(item.enabled).toBe(false);
    expect(item.source).toBe('merchant');
  });

  it('merchant override with null durationMin falls back to catalog defaultDurationMin', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({ id: 'svc-b', billable: 'yes', defaultDurationMin: 60 }),
    ];
    const override: MerchantPricing = {
      merchantId: 'merchant-1',
      catalogItemId: 'svc-b',
      priceCents: 1000,
      durationMin: null,
      pricingUnit: 'fixed',
      enabled: true,
    };
    const [item] = resolveEffectivePricing(catalog, [override]);
    expect(item.durationMin).toBe(60);
    expect(item.source).toBe('merchant');
  });

  it('fails closed: a required-price item with no merchant row is unresolved + disabled', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({
        id: 'svc-c',
        billable: 'yes',
        merchantPriceRequired: 'yes',
        defaultDurationMin: 20,
        defaultPricingUnit: 'per_finger',
      }),
    ];
    const [item] = resolveEffectivePricing(catalog, []);
    expect(item.priceCents).toBe(0);
    expect(item.durationMin).toBe(20);
    expect(item.pricingUnit).toBe('per_finger');
    expect(item.enabled).toBe(false);
    expect(item.source).toBe('unresolved');
  });

  it('an optional-price item with no merchant row falls back to catalog_default + enabled', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({
        id: 'svc-opt',
        billable: 'optional',
        merchantPriceRequired: 'optional',
        defaultDurationMin: 15,
        defaultPricingUnit: 'included',
      }),
    ];
    const [item] = resolveEffectivePricing(catalog, []);
    expect(item.priceCents).toBe(0);
    expect(item.enabled).toBe(true);
    expect(item.source).toBe('catalog_default');
  });

  it('fallback duration is 0 when catalog defaultDurationMin is null', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({ id: 'svc-d', billable: 'yes', defaultDurationMin: null }),
    ];
    const [item] = resolveEffectivePricing(catalog, []);
    expect(item.durationMin).toBe(0);
  });

  it('returns items in catalog order', () => {
    const catalog: CatalogItem[] = [
      makeCatalogItem({ id: 'first', billable: 'yes' }),
      makeCatalogItem({ id: 'second', billable: 'yes' }),
      makeCatalogItem({ id: 'third', billable: 'yes' }),
    ];
    const result = resolveEffectivePricing(catalog, []);
    expect(result.map((r) => r.catalogItemId)).toEqual(['first', 'second', 'third']);
  });
});
