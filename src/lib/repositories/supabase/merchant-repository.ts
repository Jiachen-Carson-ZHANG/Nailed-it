import { getServiceClient } from '@/lib/db/client';
import type { Merchant } from '@/domain/merchant';
import type { MerchantRepository } from '../types';

interface MerchantRow {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}

function rowToMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
  };
}

export function createSupabaseMerchantRepository(): MerchantRepository {
  return {
    async list(): Promise<Merchant[]> {
      const { data, error } = await getServiceClient().from('merchant').select('*');
      if (error) {
        throw new Error(`MerchantRepository.list failed: ${error.message}`);
      }
      return (data as MerchantRow[]).map(rowToMerchant);
    },

    async getById(id: string): Promise<Merchant | null> {
      const { data, error } = await getServiceClient()
        .from('merchant')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`MerchantRepository.getById failed: ${error.message}`);
      }
      return data ? rowToMerchant(data as MerchantRow) : null;
    },
  };
}
