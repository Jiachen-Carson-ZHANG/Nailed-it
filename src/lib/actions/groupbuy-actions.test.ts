import { beforeEach, describe, expect, it } from 'vitest';
import { resetRepositoriesForTests, getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { createDefaultGroupbuyDraft } from '@/domain/groupbuy';
import { proposeGroupbuyDealAction } from './groupbuy-actions';

describe('proposeGroupbuyDealAction', () => {
  beforeEach(() => resetRepositoriesForTests());

  it('persists a valid proposal as a traceable draft the merchant can find', async () => {
    const deal = { ...createDefaultGroupbuyDraft(), id: 'gb-agent-1', title: '闲时套餐', originalPrice: 158, dealPrice: 128, serviceSelections: [{ catalogItemId: 'ci-1', enabled: true, quantity: 1 }] };
    const res = await proposeGroupbuyDealAction(deal, 'run-7');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deal.status).toBe('draft');
    expect(res.deal.sourceRunId).toBe('run-7');
    expect(res.deal.merchantId).toBe(demoMerchantId);
    const listed = await getRepositories().groupbuy.listByMerchant(demoMerchantId);
    expect(listed.some((d) => d.id === 'gb-agent-1')).toBe(true);
  });

  it('rejects invalid terms without persisting', async () => {
    const bad = { ...createDefaultGroupbuyDraft(), id: 'gb-bad', originalPrice: 100, dealPrice: 200 };
    const res = await proposeGroupbuyDealAction(bad, 'run-7');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors).toContain('deal_price_above_original');
    const listed = await getRepositories().groupbuy.listByMerchant(demoMerchantId);
    expect(listed.some((d) => d.id === 'gb-bad')).toBe(false);
  });
});
