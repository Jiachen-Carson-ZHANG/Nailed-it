import type { CatalogItem } from '@/domain/catalog';
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

    const override = overrideMap.get(item.id);
    if (override) {
      result.push({
        catalogItemId: item.id,
        priceCents: override.priceCents,
        durationMin: override.durationMin ?? (item.defaultDurationMin ?? 0),
        pricingUnit: override.pricingUnit,
        enabled: override.enabled,
        source: 'merchant',
      });
    } else {
      // Fail closed: an item that requires a merchant price but has no override is
      // unresolved, not free. Returning it disabled stops P4 wiring from booking a
      // merchant-required service at price 0. Items where the price is genuinely
      // optional fall back to the catalog default.
      const requiresMerchantPrice = item.merchantPriceRequired === 'yes';
      result.push({
        catalogItemId: item.id,
        priceCents: 0,
        durationMin: item.defaultDurationMin ?? 0,
        pricingUnit: item.defaultPricingUnit,
        enabled: !requiresMerchantPrice,
        source: requiresMerchantPrice ? 'unresolved' : 'catalog_default',
      });
    }
  }
  return result;
}
