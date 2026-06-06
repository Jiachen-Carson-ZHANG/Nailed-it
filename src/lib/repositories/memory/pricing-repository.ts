import type { PricingItem } from '@/domain/nail';
import { defaultPricingRules } from '@/mock/pricing';
import type { PricingRepository } from '../types';

export function createMemoryPricingRepository(
  seed: PricingItem[] = defaultPricingRules,
): PricingRepository {
  let state: PricingItem[] = structuredClone(seed);

  return {
    async list(): Promise<PricingItem[]> {
      return structuredClone(state);
    },

    async replaceAll(rules: PricingItem[]): Promise<PricingItem[]> {
      state = structuredClone(rules);
      return structuredClone(state);
    },
  };
}
