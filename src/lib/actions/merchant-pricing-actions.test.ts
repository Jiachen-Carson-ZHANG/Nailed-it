import { beforeEach, describe, expect, it } from 'vitest';
import { getRepositories, resetRepositoriesForTests } from '@/lib/repositories';
import { quoteCatalogSelectionsAction } from './booking-actions';
import {
  listMerchantPricingSettingsAction,
  saveMerchantPricingSettingsAction,
} from './merchant-pricing-actions';

describe('merchant pricing actions', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('persists merchant pricing and makes it authoritative for quotes', async () => {
    const settings = await listMerchantPricingSettingsAction();
    const basic = settings.find((setting) => setting.id === 'basic_manicure_service');
    expect(basic).toBeDefined();

    await saveMerchantPricingSettingsAction([
      { ...basic!, price: 41, duration: 70, enabled: true },
    ]);

    const quote = await quoteCatalogSelectionsAction([
      { catalogItemId: 'basic_manicure_service', quantity: 1 },
    ]);
    expect(quote).toMatchObject({ totalPriceCents: 4100, totalDurationMin: 70 });
    expect(await getRepositories().merchantPricing.listByMerchant('merchant-nailed-it')).toHaveLength(1);
  });
});
