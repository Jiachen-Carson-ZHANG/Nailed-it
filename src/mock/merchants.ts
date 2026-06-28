import type { Merchant } from '@/domain/merchant';

export const demoMerchantId = 'merchant-nailed-it';

export const mockMerchants: Merchant[] = [
  { id: demoMerchantId, name: 'Nailed-it Studio', timezone: 'Asia/Singapore', currency: 'SGD' },
  // Filler shops (design spec 2026-06-27 §1) — populate the multi-merchant feed + ads + platform-hot.
  { id: 'merchant-gloss-lab', name: 'Gloss Lab', timezone: 'Asia/Singapore', currency: 'SGD' },
  { id: 'merchant-aurora-nails', name: 'Aurora Nail Bar', timezone: 'Asia/Singapore', currency: 'SGD' },
  { id: 'merchant-velvet-tips', name: 'Velvet Tips', timezone: 'Asia/Singapore', currency: 'SGD' },
  { id: 'merchant-mond-studio', name: 'MöND Studio', timezone: 'Asia/Singapore', currency: 'SGD' },
];
