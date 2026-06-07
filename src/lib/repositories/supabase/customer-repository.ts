import { getServiceClient } from '@/lib/db/client';
import type { Customer } from '@/domain/analytics';
import type { CustomerRepository } from '../types';

export interface CustomerRow {
  id: string;
  merchant_id: string;
  handle: string | null;
  name: string;
  avatar_url: string | null;
  persona_note: string | null;
  created_at: string;
}

export function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    handle: row.handle,
    name: row.name,
    avatarUrl: row.avatar_url,
    personaNote: row.persona_note,
    createdAt: row.created_at,
  };
}

export function createSupabaseCustomerRepository(): CustomerRepository {
  return {
    async listByMerchant(merchantId: string): Promise<Customer[]> {
      const { data, error } = await getServiceClient()
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId);
      if (error) {
        throw new Error(`CustomerRepository.listByMerchant failed: ${error.message}`);
      }
      return (data as CustomerRow[]).map(rowToCustomer);
    },

    async getByHandle(handle: string): Promise<Customer | null> {
      const { data, error } = await getServiceClient()
        .from('customers')
        .select('*')
        .eq('handle', handle)
        .maybeSingle();
      if (error) {
        throw new Error(`CustomerRepository.getByHandle failed: ${error.message}`);
      }
      return data ? rowToCustomer(data as CustomerRow) : null;
    },

    async getById(id: string): Promise<Customer | null> {
      const { data, error } = await getServiceClient()
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`CustomerRepository.getById failed: ${error.message}`);
      }
      return data ? rowToCustomer(data as CustomerRow) : null;
    },
  };
}
