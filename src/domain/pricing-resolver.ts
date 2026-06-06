import type { CatalogItem } from '@/domain/catalog';
import { effectiveDurationMin } from '@/domain/catalog';
import type { MerchantPricing, EffectivePricing } from '@/domain/merchant';

export function resolveEffectivePricing(
  catalog: CatalogItem[],
  merchantPricing: MerchantPricing[],
): EffectivePricing[] {
  const overrideMap = new Map<string, MerchantPricing>();
  for (const row of merchantPricing) {
    overrideMap.set(row.catalogItemId, row);
  }

  const result: EffectivePricing[] = [];
  for (const item of catalog) {
    if (item.billable === 'no') continue;

    // Time-aggregating package parents bill on the sum of their time-only children, not their own
    // stored duration (see effectiveDurationMin).
    const catalogDurationMin = effectiveDurationMin(item, catalog);

    const override = overrideMap.get(item.id);
    if (override) {
      result.push({
        catalogItemId: item.id,
        priceCents: override.priceCents,
        durationMin: override.durationMin ?? catalogDurationMin,
        pricingUnit: override.pricingUnit,
        enabled: override.enabled,
        source: 'merchant',
      });
    } else if (item.defaultPriceCents !== null) {
      // The dictionary now carries a platform default price. Use it as the resolved price even
      // when the merchant has set no override (the merchant may still override later). This is
      // what stops catalog-priced quotes from coming out at $0.
      result.push({
        catalogItemId: item.id,
        priceCents: item.defaultPriceCents,
        durationMin: catalogDurationMin,
        pricingUnit: item.defaultPricingUnit,
        enabled: true,
        source: 'catalog_default',
      });
    } else {
      // No override and no platform default. Fail closed for items that require a merchant price
      // (returning them disabled stops a merchant-required service booking at $0); items whose
      // price is genuinely optional (e.g. 'included' / 'tag_only') resolve as a free catalog default.
      const requiresMerchantPrice = item.merchantPriceRequired === 'yes';
      result.push({
        catalogItemId: item.id,
        priceCents: 0,
        durationMin: catalogDurationMin,
        pricingUnit: item.defaultPricingUnit,
        enabled: !requiresMerchantPrice,
        source: requiresMerchantPrice ? 'unresolved' : 'catalog_default',
      });
    }
  }
  return result;
}
