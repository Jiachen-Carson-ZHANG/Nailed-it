import type { Customer } from '@/domain/analytics';
import { mockCustomers } from '@/mock/customers';
import type { CustomerRepository } from '../types';

/** In-memory customer personas. Defaults to the mock set (Melissa) so local dev without Supabase
 *  still has the demo customer for session mapping. */
export function createMemoryCustomerRepository(
  seed: Customer[] = mockCustomers,
): CustomerRepository {
  const customers: Customer[] = structuredClone(seed);

  return {
    async listByMerchant(merchantId: string): Promise<Customer[]> {
      return structuredClone(customers.filter((c) => c.merchantId === merchantId));
    },

    async getByHandle(handle: string): Promise<Customer | null> {
      const found = customers.find((c) => c.handle === handle);
      return found ? structuredClone(found) : null;
    },

    async getById(id: string): Promise<Customer | null> {
      const found = customers.find((c) => c.id === id);
      return found ? structuredClone(found) : null;
    },
  };
}
