import type { Merchant } from '@/domain/merchant';

export const demoMerchantId = 'merchant-nailed-it';

export const mockMerchants: Merchant[] = [
  { id: demoMerchantId, name: 'Nailed-it Studio', timezone: 'Asia/Singapore', currency: 'SGD' },
];
