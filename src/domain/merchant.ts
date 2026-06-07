import type { BilingualText, PricingUnit } from './catalog';

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

/** Merchant-facing editable view. Money is expressed in major currency units for form controls. */
export type MerchantPricingSetting = {
  id: string;
  name: BilingualText;
  nameZh: string;
  groupLabel: string;
  groupLabelLocalized: BilingualText;
  price: number;
  duration: number;
  enabled: boolean;
};

export type EffectivePricing = {
  catalogItemId: string;
  priceCents: number;
  durationMin: number;
  pricingUnit: PricingUnit;
  enabled: boolean;
  // 'unresolved' = a billable item that REQUIRES a merchant price but has none yet.
  // It is returned disabled (enabled:false) so callers fail closed instead of offering it free.
  source: 'merchant' | 'catalog_default' | 'unresolved';
};
