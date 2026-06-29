import type { GroupbuyDeal } from '@/domain/groupbuy';
import { isValidGroupbuyDeal } from '@/domain/groupbuy';
import { getBrowserStorage } from '@/lib/browser-storage';

const STORAGE_KEY = 'nailed-it.groupbuy-deals.v1';

function readStoredDeals(): GroupbuyDeal[] {
  const storage = getBrowserStorage('local');
  if (!storage) return [];

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidGroupbuyDeal);
  } catch {
    return [];
  }
}

function writeStoredDeals(deals: GroupbuyDeal[]): void {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function upsertDeal(next: GroupbuyDeal): GroupbuyDeal {
  const updated: GroupbuyDeal = { ...next, updatedAt: new Date().toISOString() };
  const existing = readStoredDeals().filter((deal) => deal.id !== updated.id);
  writeStoredDeals([updated, ...existing]);
  return updated;
}

export function listGroupbuyDeals(): GroupbuyDeal[] {
  return readStoredDeals();
}

export function saveGroupbuyDraft(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'draft' });
}

export function publishGroupbuyDeal(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'published' });
}

export function clearGroupbuyDealsForTests(): void {
  const storage = getBrowserStorage('local');
  storage?.removeItem(STORAGE_KEY);
}
