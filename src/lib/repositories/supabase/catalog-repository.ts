import { getServiceClient } from '@/lib/db/client';
import type {
  CatalogItem,
  CatalogItemType,
  AiDetectable,
  DurationConfigLevel,
  PricingUnit,
  TriState,
  YesNo,
} from '@/domain/catalog';
import type { CatalogRepository } from '../types';

export interface CatalogItemRow {
  id: string;
  name_zh: string;
  type: string;
  category: string;
  parent_id: string | null;
  user_visible: string;
  ai_detectable: string;
  billable: string;
  merchant_price_required: string;
  merchant_duration_required: string;
  duration_config_level: string;
  affects_booking_duration: string;
  default_duration_min: number | null;
  allowed_pricing_units: PricingUnit[];
  default_pricing_unit: string;
  quantity_supported: string;
  complexity_supported: string;
  notes: string;
}

export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    nameZh: row.name_zh,
    type: row.type as CatalogItemType,
    category: row.category,
    parentId: row.parent_id,
    userVisible: row.user_visible as YesNo,
    aiDetectable: row.ai_detectable as AiDetectable,
    billable: row.billable as TriState,
    merchantPriceRequired: row.merchant_price_required as TriState,
    merchantDurationRequired: row.merchant_duration_required as TriState,
    durationConfigLevel: row.duration_config_level as DurationConfigLevel,
    affectsBookingDuration: row.affects_booking_duration as TriState,
    defaultDurationMin: row.default_duration_min,
    allowedPricingUnits: row.allowed_pricing_units,
    defaultPricingUnit: row.default_pricing_unit as PricingUnit,
    quantitySupported: row.quantity_supported as TriState,
    complexitySupported: row.complexity_supported as YesNo,
    notes: row.notes,
  };
}

export function createSupabaseCatalogRepository(): CatalogRepository {
  return {
    async list(): Promise<CatalogItem[]> {
      const { data, error } = await getServiceClient()
        .from('catalog_item')
        .select('*');
      if (error) {
        throw new Error(`CatalogRepository.list failed: ${error.message}`);
      }
      return (data as CatalogItemRow[]).map(rowToCatalogItem);
    },

    async getById(id: string): Promise<CatalogItem | null> {
      const { data, error } = await getServiceClient()
        .from('catalog_item')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`CatalogRepository.getById failed: ${error.message}`);
      }
      return data ? rowToCatalogItem(data as CatalogItemRow) : null;
    },

    async listByType(type: CatalogItemType): Promise<CatalogItem[]> {
      const { data, error } = await getServiceClient()
        .from('catalog_item')
        .select('*')
        .eq('type', type);
      if (error) {
        throw new Error(`CatalogRepository.listByType failed: ${error.message}`);
      }
      return (data as CatalogItemRow[]).map(rowToCatalogItem);
    },
  };
}
