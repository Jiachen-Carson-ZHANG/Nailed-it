import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultGroupbuyDraft } from '@/domain/groupbuy';
import {
  clearGroupbuyDealsForTests,
  listGroupbuyDeals,
  publishGroupbuyDeal,
  saveGroupbuyDraft,
} from './groupbuy-repository';

const STORAGE_KEY = 'nailed-it.groupbuy-deals.v1';

describe('local groupbuy repository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearGroupbuyDealsForTests();
  });

  it('saves and lists a draft deal', () => {
    const draft = createDefaultGroupbuyDraft();
    const saved = saveGroupbuyDraft({
      ...draft,
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
    });

    expect(saved.status).toBe('draft');
    expect(listGroupbuyDeals()[0]).toEqual(saved);
  });

  it('publishes a deal with status published', () => {
    const draft = createDefaultGroupbuyDraft();
    const published = publishGroupbuyDeal({
      ...draft,
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
      dealPrice: 20,
    });

    expect(published.status).toBe('published');
    expect(listGroupbuyDeals()[0]?.status).toBe('published');
  });

  it('filters malformed stored rows from list results', () => {
    const valid = {
      ...createDefaultGroupbuyDraft(),
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
    };
    const { saleStart, ...missingSaleStart } = valid;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([missingSaleStart, valid]));

    expect(saleStart).toEqual({ type: 'afterApproval' });
    expect(listGroupbuyDeals()).toEqual([valid]);
  });

  it('filters stored rows with invalid numeric business values', () => {
    const valid = {
      ...createDefaultGroupbuyDraft(),
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
      dealPrice: 20,
      validity: { type: 'days' as const, days: 90 },
      purchaseLimit: { type: 'perUser' as const, quantity: 1 },
    };
    const invalidRows = [
      {
        ...valid,
        id: 'invalid-service-zero',
        serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 0 }],
      },
      {
        ...valid,
        id: 'invalid-service-fraction',
        serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1.5 }],
      },
      { ...valid, id: 'invalid-original-negative', originalPrice: -1 },
      { ...valid, id: 'invalid-deal-negative', dealPrice: -1 },
      { ...valid, id: 'invalid-validity-zero', validity: { type: 'days' as const, days: 0 } },
      { ...valid, id: 'invalid-validity-fraction', validity: { type: 'days' as const, days: 1.5 } },
      {
        ...valid,
        id: 'invalid-purchase-limit-zero',
        purchaseLimit: { type: 'perUser' as const, quantity: 0 },
      },
      {
        ...valid,
        id: 'invalid-purchase-limit-fraction',
        purchaseLimit: { type: 'perUser' as const, quantity: 1.5 },
      },
    ];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...invalidRows, valid]));

    expect(listGroupbuyDeals()).toEqual([valid]);
  });
});
