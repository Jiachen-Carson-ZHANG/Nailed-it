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
      result.push({
        catalogItemId: item.id,
        priceCents: 0,
        durationMin: item.defaultDurationMin ?? 0,
        pricingUnit: item.defaultPricingUnit,
        enabled: true,
        source: 'catalog_default',
      });
    }
  }
  return result;
}
