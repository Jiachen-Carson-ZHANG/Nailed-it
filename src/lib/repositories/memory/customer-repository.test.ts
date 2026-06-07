import { describe, it, expect } from 'vitest';
import { createMemoryCustomerRepository } from './customer-repository';

describe('memory customer repository', () => {
  it('resolves the demo customer by handle (locks the Melissa name-join invariant)', async () => {
    const repo = createMemoryCustomerRepository();
    const melissa = await repo.getByHandle('melissa');
    // name MUST equal booking.customer_name for the intel panel's appointment-context join (ADR-0006).
    expect(melissa?.name).toBe('Melissa Tan');
    expect(melissa?.id).toBe('cust-melissa');
  });

  it('returns null for an unknown handle', async () => {
    const repo = createMemoryCustomerRepository();
    expect(await repo.getByHandle('nobody')).toBeNull();
  });

  it('lists customers scoped to a merchant', async () => {
    const repo = createMemoryCustomerRepository();
    const list = await repo.listByMerchant('merchant-nailed-it');
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((c) => c.merchantId === 'merchant-nailed-it')).toBe(true);
  });
});
