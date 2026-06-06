import type { PricingUnit } from './catalog';

/**
 * A per-set service represents one complete nail set. Quantity-bearing units keep their supplied
 * value, while a model or browser cannot turn one per-set line into several sets.
 */
export function normalizeQuantityForPricingUnit(quantity: number, pricingUnit: PricingUnit): number {
  return pricingUnit === 'per_set' ? 1 : quantity;
}
