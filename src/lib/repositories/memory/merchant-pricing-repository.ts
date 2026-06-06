import type { MerchantPricing } from '@/domain/merchant';
import type { MerchantPricingRepository } from '../types';

export function createMemoryMerchantPricingRepository(
  seed: MerchantPricing[] = [],
): MerchantPricingRepository {
  const state: MerchantPricing[] = structuredClone(seed);

  return {
    async listByMerchant(merchantId: string): Promise<MerchantPricing[]> {
      return structuredClone(state.filter((r) => r.merchantId === merchantId));
    },

    async upsertMany(rows: MerchantPricing[]): Promise<MerchantPricing[]> {
      for (const incoming of rows) {
        const idx = state.findIndex(
          (r) => r.merchantId === incoming.merchantId && r.catalogItemId === incoming.catalogItemId,
        );
        if (idx !== -1) {
          state[idx] = structuredClone(incoming);
        } else {
          state.push(structuredClone(incoming));
        }
      }
      return structuredClone(rows);
    },
  };
}
