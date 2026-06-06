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
      // Non-destructive: upsert the new set first (a failure here loses nothing),
      // then prune only the rows no longer present. Avoids the delete-then-insert
      // window where a failed insert would wipe all pricing.
      const client = getServiceClient();
      const rows = rules.map(pricingItemToRow);

      if (rows.length > 0) {
        const { error: upsertError } = await client
          .from('pricing_rules')
          .upsert(rows, { onConflict: 'id' });
        if (upsertError) {
          throw new Error(`PricingRepository.replaceAll (upsert) failed: ${upsertError.message}`);
        }
      }

      const prune =
        rows.length > 0
          ? client.from('pricing_rules').delete().not('id', 'in', `(${rows.map((r) => r.id).join(',')})`)
          : client.from('pricing_rules').delete().neq('id', '');
      const { error: pruneError } = await prune;
      if (pruneError) {
        throw new Error(`PricingRepository.replaceAll (prune) failed: ${pruneError.message}`);
      }

      const { data, error } = await client.from('pricing_rules').select('*');
      if (error) {
        throw new Error(`PricingRepository.replaceAll (reload) failed: ${error.message}`);
      }
      return (data as PricingRuleRow[]).map(rowToPricingItem);
    },
  };
}
