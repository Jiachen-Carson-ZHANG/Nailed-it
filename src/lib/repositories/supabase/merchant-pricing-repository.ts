import { getServiceClient } from '@/lib/db/client';
import type { MerchantPricing } from '@/domain/merchant';
import type { PricingUnit } from '@/domain/catalog';
import type { MerchantPricingRepository } from '../types';

interface MerchantPricingRow {
  merchant_id: string;
  catalog_item_id: string;
  price_cents: number;
  duration_min: number | null;
  pricing_unit: string;
  enabled: boolean;
}

function rowToMerchantPricing(row: MerchantPricingRow): MerchantPricing {
  return {
    merchantId: row.merchant_id,
    catalogItemId: row.catalog_item_id,
    priceCents: row.price_cents,
    durationMin: row.duration_min,
    pricingUnit: row.pricing_unit as PricingUnit,
    enabled: row.enabled,
  };
}

function merchantPricingToRow(mp: MerchantPricing): MerchantPricingRow {
  return {
    merchant_id: mp.merchantId,
    catalog_item_id: mp.catalogItemId,
    price_cents: mp.priceCents,
    duration_min: mp.durationMin,
    pricing_unit: mp.pricingUnit,
    enabled: mp.enabled,
  };
}

export function createSupabaseMerchantPricingRepository(): MerchantPricingRepository {
  return {
    async listByMerchant(merchantId: string): Promise<MerchantPricing[]> {
      const { data, error } = await getServiceClient()
        .from('merchant_pricing')
        .select('*')
        .eq('merchant_id', merchantId);
      if (error) {
        throw new Error(`MerchantPricingRepository.listByMerchant failed: ${error.message}`);
      }
      return (data as MerchantPricingRow[]).map(rowToMerchantPricing);
    },

    async upsertMany(rows: MerchantPricing[]): Promise<MerchantPricing[]> {
      if (rows.length === 0) return [];
      const { data, error } = await getServiceClient()
        .from('merchant_pricing')
        .upsert(rows.map(merchantPricingToRow), { onConflict: 'merchant_id,catalog_item_id' })
        .select('*');
      if (error) {
        throw new Error(`MerchantPricingRepository.upsertMany failed: ${error.message}`);
      }
      return (data as MerchantPricingRow[]).map(rowToMerchantPricing);
    },
  };
}
