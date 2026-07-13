import type { Merchant } from '@/domain/merchant';

export const demoMerchantId = 'merchant-nailed-it';

export const mockMerchants: Merchant[] = [
  { id: demoMerchantId, name: 'Nailed-it Studio', timezone: 'Asia/Shanghai', currency: 'CNY' },
  // Filler shops (design spec 2026-06-27 §1) — populate the multi-merchant feed + ads + platform-hot.
  { id: 'merchant-gloss-lab', name: 'Gloss Lab', timezone: 'Asia/Shanghai', currency: 'CNY' },
  { id: 'merchant-aurora-nails', name: 'Aurora Nail Bar', timezone: 'Asia/Shanghai', currency: 'CNY' },
  { id: 'merchant-velvet-tips', name: 'Velvet Tips', timezone: 'Asia/Shanghai', currency: 'CNY' },
  { id: 'merchant-mond-studio', name: 'MöND Studio', timezone: 'Asia/Shanghai', currency: 'CNY' },
];
