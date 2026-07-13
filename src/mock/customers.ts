import type { Customer } from '@/domain/analytics';
import { demoMerchantId } from './merchants';

// The live demo customer. The mock customer session maps to this Melissa persona, so her clicks
// attach to `cust-melissa` and move both her profile and the merchant dashboard during the demo.
// `demoCustomerName` must equal the seeded `customers.name` AND the `booking.customer_name` the
// confirm flow writes, so the intel panel's appointment-context join lands (ADR-0006).
export const demoCustomerName = 'Melissa Tan';
export const demoCustomerHandle = 'melissa';
export const demoCustomerId = 'cust-melissa';

export const mockCustomers: Customer[] = [
  {
    id: demoCustomerId,
    merchantId: demoMerchantId,
    handle: demoCustomerHandle,
    name: demoCustomerName,
    avatarUrl: null,
    personaNote: '裸色/粉色 · 椭圆/圆形 · 韩系/法式风/极简 · budget ~¥80',
  },
];
