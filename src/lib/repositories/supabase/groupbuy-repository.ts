import 'server-only';
import { getServiceClient } from '@/lib/db/client';
import type { GroupbuyDeal, GroupbuyDealRecord, GroupbuyStatus, GroupbuyServiceSelection } from '@/domain/groupbuy';
import { canTransitionGroupbuy } from '@/domain/action-entity-contract';
import type { GroupbuyRepository } from '../types';

// Supabase group-buy repo (ADR-0012 Phase 0a) over groupbuy_deal + groupbuy_deal_item (migration 0027).
// Prices are stored in cents + a currency snapshot; the UI-facing GroupbuyDeal keeps whole-unit numbers.
// Only enabled service selections are persisted as item rows (presence = enabled); disabled toggles are
// transient UI state, not authoritative.

const SELECT = '*, groupbuy_deal_item(catalog_item_id, quantity, position)';

type ItemRow = { catalog_item_id: string; quantity: number; position: number };
type DealRow = {
  id: string; merchant_id: string; title: string; status: GroupbuyStatus;
  original_price_cents: number; deal_price_cents: number | null; currency: string;
  sale_start: GroupbuyDeal['saleStart']; sale_end: GroupbuyDeal['saleEnd']; validity: GroupbuyDeal['validity'];
  sale_channel: GroupbuyDeal['saleChannel']; availability: GroupbuyDeal['availability'];
  benefit_sharing: GroupbuyDeal['benefitSharing']; purchase_limit: GroupbuyDeal['purchaseLimit'];
  source_run_id: string | null; created_at: string; updated_at: string;
  groupbuy_deal_item: ItemRow[] | null;
};

const toUnits = (cents: number): number => Math.round(cents) / 100;
const toCents = (units: number): number => Math.round(units * 100);

function rowToRecord(row: DealRow): GroupbuyDealRecord {
  const serviceSelections: GroupbuyServiceSelection[] = [...(row.groupbuy_deal_item ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((it) => ({ catalogItemId: it.catalog_item_id, enabled: true, quantity: it.quantity }));
  return {
    id: row.id, title: row.title, status: row.status, serviceSelections,
    originalPrice: toUnits(row.original_price_cents),
    dealPrice: row.deal_price_cents === null ? null : toUnits(row.deal_price_cents),
    saleStart: row.sale_start, saleEnd: row.sale_end, validity: row.validity,
    saleChannel: row.sale_channel, availability: row.availability,
    benefitSharing: row.benefit_sharing, purchaseLimit: row.purchase_limit,
    createdAt: row.created_at, updatedAt: row.updated_at,
    merchantId: row.merchant_id, currency: row.currency, sourceRunId: row.source_run_id,
  };
}

export function createSupabaseGroupbuyRepository(): GroupbuyRepository {
  const db = getServiceClient();

  async function fetchOne(id: string, merchantId: string): Promise<GroupbuyDealRecord | null> {
    const { data, error } = await db.from('groupbuy_deal').select(SELECT).eq('id', id).eq('merchant_id', merchantId).maybeSingle();
    if (error) throw new Error(`GroupbuyRepository.get failed: ${error.message}`);
    return data ? rowToRecord(data as DealRow) : null;
  }

  return {
    async listByMerchant(merchantId) {
      const { data, error } = await db.from('groupbuy_deal').select(SELECT).eq('merchant_id', merchantId).order('updated_at', { ascending: false });
      if (error) throw new Error(`GroupbuyRepository.list failed: ${error.message}`);
      return (data as DealRow[]).map(rowToRecord);
    },

    getByIdForMerchant: fetchOne,

    // One RPC (migration 0029), not upsert + delete + insert: a failure between the item delete and the
    // item insert used to leave a published deal with zero services. Deal and items now commit together.
    async save(record) {
      const items = record.serviceSelections.filter((s) => s.enabled).map((s, position) => ({
        catalog_item_id: s.catalogItemId, quantity: s.quantity, position,
      }));
      const { error } = await db.rpc('save_groupbuy_deal', {
        p_deal: {
          id: record.id, merchant_id: record.merchantId, title: record.title, status: record.status,
          original_price_cents: toCents(record.originalPrice),
          deal_price_cents: record.dealPrice === null ? null : toCents(record.dealPrice),
          currency: record.currency,
          sale_start: record.saleStart, sale_end: record.saleEnd, validity: record.validity,
          sale_channel: record.saleChannel, availability: record.availability,
          benefit_sharing: record.benefitSharing, purchase_limit: record.purchaseLimit,
          source_run_id: record.sourceRunId, updated_at: record.updatedAt,
        },
        p_items: items,
      });
      if (error) {
        if (/save_groupbuy_deal/i.test(error.message) && /(does not exist|schema cache|could not find)/i.test(error.message)) {
          throw new Error(`save_groupbuy_deal RPC missing — apply migration 0029_save_groupbuy_deal_rpc.sql (${error.message})`);
        }
        throw new Error(`GroupbuyRepository.save failed: ${error.message}`);
      }

      const saved = await fetchOne(record.id, record.merchantId);
      if (!saved) throw new Error('GroupbuyRepository.save: not found after upsert');
      return saved;
    },

    async setStatus(id, merchantId, status: GroupbuyStatus) {
      const current = await fetchOne(id, merchantId);
      if (!current || !canTransitionGroupbuy(current.status, status)) return null;
      const { error } = await db.from('groupbuy_deal').update({ status }).eq('id', id).eq('merchant_id', merchantId);
      if (error) throw new Error(`GroupbuyRepository.setStatus failed: ${error.message}`);
      return fetchOne(id, merchantId);
    },
  };
}
