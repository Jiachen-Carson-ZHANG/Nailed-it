import type { Merchant } from '@/domain/merchant';
import { mockMerchants } from '@/mock/merchants';
import type { MerchantRepository } from '../types';

export function createMemoryMerchantRepository(
  seed: Merchant[] = mockMerchants,
): MerchantRepository {
  const state: Merchant[] = structuredClone(seed);

  return {
    async list(): Promise<Merchant[]> {
      return structuredClone(state);
    },

    async getById(id: string): Promise<Merchant | null> {
      const found = state.find((m) => m.id === id);
      return found ? structuredClone(found) : null;
    },

    async updateCurrency(id: string, currency: string): Promise<void> {
      const found = state.find((m) => m.id === id);
      if (found) {
        found.currency = currency;
      }
    },
  };
}
