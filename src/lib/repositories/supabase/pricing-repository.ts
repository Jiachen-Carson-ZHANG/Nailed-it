import { getServiceClient } from '@/lib/db/client';
import type { PricingItem, PricingCategory } from '@/domain/nail';
import type { PricingRepository } from '../types';

interface PricingRuleRow {
  id: string;
  category: string;
  target: string;
  price: number;
  duration: number;
  enabled: boolean;
}

function rowToPricingItem(row: PricingRuleRow): PricingItem {
  return {
    id: row.id,
    category: row.category as PricingCategory,
    target: row.target,
    price: Number(row.price),
    duration: row.duration,
    enabled: row.enabled,
  } as PricingItem;
}

function pricingItemToRow(item: PricingItem): PricingRuleRow {
  return {
    id: item.id,
    category: item.category,
    target: item.target,
    price: item.price,
    duration: item.duration,
    enabled: item.enabled,
  };
}

export function createSupabasePricingRepository(): PricingRepository {
  return {
    async list(): Promise<PricingItem[]> {
      const { data, error } = await getServiceClient()
        .from('pricing_rules')
        .select('*');
      if (error) {
        throw new Error(`PricingRepository.list failed: ${error.message}`);
      }
      return (data as PricingRuleRow[]).map(rowToPricingItem);
    },

    async replaceAll(rules: PricingItem[]): Promise<PricingItem[]> {
      const client = getServiceClient();

      const { error: deleteError } = await client.from('pricing_rules').delete().neq('id', '');
      if (deleteError) {
        throw new Error(`PricingRepository.replaceAll (delete) failed: ${deleteError.message}`);
      }

      if (rules.length === 0) {
        return [];
      }

      const rows = rules.map(pricingItemToRow);
      const { data, error: insertError } = await client
        .from('pricing_rules')
        .insert(rows)
        .select('*');
      if (insertError) {
        throw new Error(`PricingRepository.replaceAll (insert) failed: ${insertError.message}`);
      }

      return (data as PricingRuleRow[]).map(rowToPricingItem);
    },
  };
}
