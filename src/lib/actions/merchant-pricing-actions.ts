'use server';

import type { MerchantPricingSetting } from '@/domain/merchant';
import { getRepositories } from '@/lib/repositories';
import { createMerchantPricingService } from '@/lib/services/merchant-pricing-service';
import { demoMerchantId } from '@/mock/merchants';

export async function listMerchantPricingSettingsAction(): Promise<MerchantPricingSetting[]> {
  return createMerchantPricingService(getRepositories()).listSettings(demoMerchantId);
}

export async function saveMerchantPricingSettingsAction(
  settings: MerchantPricingSetting[],
): Promise<MerchantPricingSetting[]> {
  return createMerchantPricingService(getRepositories()).saveSettings(demoMerchantId, settings);
}
