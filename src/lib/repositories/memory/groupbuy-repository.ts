import type { GroupbuyDealRecord, GroupbuyStatus } from '@/domain/groupbuy';
import { toGroupbuyRecord } from '@/domain/groupbuy';
import { canTransitionGroupbuy } from '@/domain/action-entity-contract';
import { mockGroupbuyEntries } from '@/data/mock-groupbuy-deals';
import { demoMerchantId } from '@/mock/merchants';
import type { GroupbuyRepository } from '../types';

// In-memory group-buy repo (ADR-0012 Phase 0a). Mirrors the merchant-style memory repo: a flat record
// array scoped by merchantId. Seeded from the existing demo deals so the seam has data once the UI is
// wired to it (Phase 0b); the localStorage repo is untouched in 0a.
function seedRecords(): GroupbuyDealRecord[] {
  return mockGroupbuyEntries.map((entry) => toGroupbuyRecord(entry.deal, demoMerchantId));
}

export function createMemoryGroupbuyRepository(
  seed: GroupbuyDealRecord[] = seedRecords(),
): GroupbuyRepository {
  const state = structuredClone(seed);
  const clone = (r: GroupbuyDealRecord | undefined): GroupbuyDealRecord | null => (r ? structuredClone(r) : null);

  return {
    async listByMerchant(merchantId) {
      return structuredClone(state.filter((d) => d.merchantId === merchantId));
    },

    async getByIdForMerchant(id, merchantId) {
      return clone(state.find((d) => d.id === id && d.merchantId === merchantId));
    },

    async save(record) {
      const next = { ...structuredClone(record), updatedAt: record.updatedAt };
      const i = state.findIndex((d) => d.id === record.id && d.merchantId === record.merchantId);
      if (i >= 0) state[i] = next;
      else state.push(next);
      return structuredClone(next);
    },

    async setStatus(id, merchantId, status: GroupbuyStatus) {
      const deal = state.find((d) => d.id === id && d.merchantId === merchantId);
      if (!deal || !canTransitionGroupbuy(deal.status, status)) return null;
      deal.status = status;
      return structuredClone(deal);
    },
  };
}
