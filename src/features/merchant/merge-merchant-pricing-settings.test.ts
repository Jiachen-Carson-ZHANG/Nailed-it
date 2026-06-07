import { describe, expect, it } from 'vitest';
import { getDefaultSettings } from '@/data/glossary-settings-store';
import { mergeMerchantPricingIntoDefaults } from '@/features/merchant/merge-merchant-pricing-settings';
import type { MerchantPricingSetting } from '@/domain/merchant';

describe('getDefaultSettings', () => {
  it('uses catalog default prices instead of zero', () => {
    const basic = getDefaultSettings().find((s) => s.id === 'basic_manicure_service');
    expect(basic?.price).toBe(28);
    expect(basic?.duration).toBeGreaterThan(0);
  });
});

describe('mergeMerchantPricingIntoDefaults', () => {
  it('overlays DB merchant prices onto the full glossary entry set', () => {
    const db: MerchantPricingSetting[] = [{
      id: 'aura_blush',
      name: { zh: '腮红', en: 'Aura blush' },
      nameZh: '腮红',
      groupLabel: '颜色效果',
      groupLabelLocalized: { zh: '颜色效果', en: 'Color effects' },
      price: 99,
      duration: 45,
      enabled: true,
    }];

    const merged = mergeMerchantPricingIntoDefaults(db);
    const aura = merged.find((s) => s.id === 'aura_blush');
    expect(aura?.price).toBe(99);
    expect(aura?.duration).toBe(45);
    expect(merged.some((s) => s.id === 'basic_manicure_service')).toBe(true);
  });
});
