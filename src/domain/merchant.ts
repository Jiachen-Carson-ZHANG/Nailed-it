import type { PricingUnit } from './catalog';

export type Merchant = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
};

export type MerchantPricing = {
  merchantId: string;
  catalogItemId: string;
  priceCents: number;
  durationMin: number | null;
  pricingUnit: PricingUnit;
  enabled: boolean;
};

export type EffectivePricing = {
  catalogItemId: string;
  priceCents: number;
  durationMin: number;
  pricingUnit: PricingUnit;
  enabled: boolean;
  source: 'merchant' | 'catalog_default';
};
