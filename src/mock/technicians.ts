import type { Technician } from '@/domain/nail';
import { demoMerchantId } from './merchants';

export const mockTechnicians: Technician[] = [
  { id: 'tech-mei', merchantId: demoMerchantId, name: 'Mei Chen', initials: 'MC', title: 'Lead nail artist', active: true },
  { id: 'tech-lina', merchantId: demoMerchantId, name: 'Lina Park', initials: 'LP', title: 'Gel specialist', active: true },
  { id: 'tech-anna', merchantId: demoMerchantId, name: 'Anna Lim', initials: 'AL', title: 'Nail artist', active: true }
];
