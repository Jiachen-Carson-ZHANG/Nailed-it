import type { MerchantPricingSetting } from '@/domain/merchant';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import type { RepositoryBundle } from '@/lib/repositories/types';

export type MerchantPricingService = {
  listSettings(merchantId: string): Promise<MerchantPricingSetting[]>;
  saveSettings(merchantId: string, settings: MerchantPricingSetting[]): Promise<MerchantPricingSetting[]>;
};

function validateSetting(setting: MerchantPricingSetting): void {
  if (!Number.isFinite(setting.price) || setting.price < 0) {
    throw new Error(`invalid_price: ${setting.id}`);
  }
  if (!Number.isFinite(setting.duration) || !Number.isInteger(setting.duration) || setting.duration < 0) {
    throw new Error(`invalid_duration: ${setting.id}`);
  }
}

export function createMerchantPricingService(repos: RepositoryBundle): MerchantPricingService {
  return {
    async listSettings(merchantId) {
      const catalog = await repos.catalog.list();
      const effective = resolveEffectivePricing(
        catalog,
        await repos.merchantPricing.listByMerchant(merchantId),
      );
      const effectiveById = new Map(effective.map((row) => [row.catalogItemId, row]));
      const catalogById = new Map(catalog.map((item) => [item.id, item]));

      return catalog
        .filter((item) => item.billable !== 'no')
        .map((item) => {
          const row = effectiveById.get(item.id);
          return {
            id: item.id,
            nameZh: item.nameZh,
            groupLabel: item.parentId
              ? (catalogById.get(item.parentId)?.nameZh ?? item.category)
              : item.nameZh,
            price: (row?.priceCents ?? 0) / 100,
            duration: row?.durationMin ?? 0,
            enabled: row?.enabled ?? false,
          };
        });
    },

    async saveSettings(merchantId, settings) {
      const [catalog, current] = await Promise.all([
        repos.catalog.list(),
        repos.merchantPricing.listByMerchant(merchantId),
      ]);
      const catalogById = new Map(catalog.map((item) => [item.id, item]));
      const currentById = new Map(current.map((row) => [row.catalogItemId, row]));
      const effectiveById = new Map(
        resolveEffectivePricing(catalog, current).map((row) => [row.catalogItemId, row]),
      );

      const rows = settings.flatMap((setting) => {
        validateSetting(setting);
        const item = catalogById.get(setting.id);
        if (!item || item.billable === 'no') throw new Error(`unknown_pricing_item: ${setting.id}`);
        const effective = effectiveById.get(item.id);
        const priceCents = Math.round(setting.price * 100);
        if (
          effective &&
          effective.priceCents === priceCents &&
          effective.durationMin === setting.duration &&
          effective.enabled === setting.enabled
        ) {
          return [];
        }
        return [{
          merchantId,
          catalogItemId: item.id,
          priceCents,
          durationMin: setting.duration,
          pricingUnit: currentById.get(item.id)?.pricingUnit ?? item.defaultPricingUnit,
          enabled: setting.enabled,
        }];
      });

      if (rows.length > 0) await repos.merchantPricing.upsertMany(rows);
      return createMerchantPricingService(repos).listSettings(merchantId);
    },
  };
}
