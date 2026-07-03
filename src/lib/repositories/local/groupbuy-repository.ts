import type { GroupbuyDeal } from '@/domain/groupbuy';
import { isValidGroupbuyDeal } from '@/domain/groupbuy';
import { mockGroupbuyDealsById, mockGroupbuyEntries } from '@/data/mock-groupbuy-deals';
import type { MockGroupbuyMeta } from '@/data/mock-groupbuy-deals';
import { getBrowserStorage } from '@/lib/browser-storage';

const STORAGE_KEY = 'nailed-it.groupbuy-deals.v1';
const MOCK_OVERRIDES_KEY = 'nailed-it.groupbuy-mock-overrides.v1';

// ── user-created deals ────────────────────────────────────────────────────────

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

// ── mock-deal overrides ───────────────────────────────────────────────────────

function readMockOverrides(): Record<string, GroupbuyDeal> {
  const storage = getBrowserStorage('local');
  if (!storage) return {};

  const raw = storage.getItem(MOCK_OVERRIDES_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const result: Record<string, GroupbuyDeal> = {};
    for (const [key, value] of Object.entries(record)) {
      if (isValidGroupbuyDeal(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeMockOverride(deal: GroupbuyDeal): void {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  const overrides = readMockOverrides();
  overrides[deal.id] = deal;
  storage.setItem(MOCK_OVERRIDES_KEY, JSON.stringify(overrides));
}

// ── combined read helpers ─────────────────────────────────────────────────────

function resolvedMockDeal(id: string): GroupbuyDeal | undefined {
  const overrides = readMockOverrides();
  if (overrides[id]) return overrides[id];
  return mockGroupbuyDealsById.get(id)?.deal;
}

// ── core mutations ────────────────────────────────────────────────────────────

function upsertDeal(next: GroupbuyDeal): GroupbuyDeal {
  const updated: GroupbuyDeal = { ...next, updatedAt: new Date().toISOString() };
  if (mockGroupbuyDealsById.has(updated.id)) {
    writeMockOverride(updated);
    return updated;
  }
  const existing = readStoredDeals().filter((deal) => deal.id !== updated.id);
  writeStoredDeals([updated, ...existing]);
  return updated;
}

// ── public API ────────────────────────────────────────────────────────────────

export function listGroupbuyDeals(): GroupbuyDeal[] {
  return readStoredDeals();
}

export type GroupbuyListEntry = {
  deal: GroupbuyDeal;
  meta: MockGroupbuyMeta;
};

export function listAllGroupbuyDeals(): GroupbuyListEntry[] {
  const overrides = readMockOverrides();
  const userDeals = readStoredDeals();

  const userEntries: GroupbuyListEntry[] = userDeals.map((deal) => ({
    deal,
    meta: { purchaseCount: 0, redemptionCount: 0 },
  }));

  const mockEntries: GroupbuyListEntry[] = mockGroupbuyEntries.map((entry) => ({
    deal: overrides[entry.deal.id] ?? entry.deal,
    meta: entry.meta,
  }));

  return [...userEntries, ...mockEntries];
}

export function getGroupbuyDealById(id: string): GroupbuyDeal | undefined {
  const userDeal = readStoredDeals().find((deal) => deal.id === id);
  if (userDeal) return userDeal;
  return resolvedMockDeal(id);
}

export function saveGroupbuyDraft(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'draft' });
}

export function publishGroupbuyDeal(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'published' });
}

export function unlistGroupbuyDeal(id: string): GroupbuyDeal | undefined {
  const deal = getGroupbuyDealById(id);
  if (!deal) return undefined;
  return upsertDeal({ ...deal, status: 'unlisted' });
}

export function relistGroupbuyDeal(id: string): GroupbuyDeal | undefined {
  const deal = getGroupbuyDealById(id);
  if (!deal) return undefined;
  return upsertDeal({ ...deal, status: 'published' });
}

export function copyGroupbuyDeal(source: GroupbuyDeal): GroupbuyDeal {
  const now = new Date();
  const copy: GroupbuyDeal = {
    ...source,
    id: `groupbuy-${now.getTime()}`,
    title: `${source.title} 副本`,
    status: 'draft',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const existing = readStoredDeals().filter((deal) => deal.id !== copy.id);
  writeStoredDeals([copy, ...existing]);
  return copy;
}

export function clearGroupbuyDealsForTests(): void {
  const storage = getBrowserStorage('local');
  storage?.removeItem(STORAGE_KEY);
  storage?.removeItem(MOCK_OVERRIDES_KEY);
}
