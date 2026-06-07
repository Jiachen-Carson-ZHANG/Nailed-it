import { describe, it, expect } from 'vitest';
import { createMemoryAnalyticsRepository } from './analytics-repository';

describe('memory analytics repository', () => {
  it('records an event and lists it by merchant', async () => {
    const repo = createMemoryAnalyticsRepository();
    await repo.record({ eventType: 'style_card_click', merchantId: 'm1', customerId: 'c1', styleId: 's1' });
    await repo.record({ eventType: 'style_save', merchantId: 'm2', customerId: 'c1' });

    const m1 = await repo.listByMerchant('m1');
    expect(m1).toHaveLength(1);
    expect(m1[0]).toMatchObject({ eventType: 'style_card_click', merchantId: 'm1', styleId: 's1', metadata: {} });
    expect(m1[0].id).toBeTruthy();
    expect(m1[0].createdAt).toBeTruthy();
  });

  it('lists a customer across merchants', async () => {
    const repo = createMemoryAnalyticsRepository();
    await repo.record({ eventType: 'style_save', merchantId: 'm1', customerId: 'c1' });
    await repo.record({ eventType: 'style_save', merchantId: 'm2', customerId: 'c1' });
    await repo.record({ eventType: 'style_save', merchantId: 'm1', customerId: 'c2' });

    expect(await repo.listByCustomer('c1')).toHaveLength(2);
    expect(await repo.listByCustomer('c2')).toHaveLength(1);
  });

  it('preserves an explicit createdAt so the seed can backdate history', async () => {
    const repo = createMemoryAnalyticsRepository();
    const when = '2026-05-20T00:00:00.000Z';
    await repo.record({ eventType: 'search_submitted', merchantId: 'm1', query: '暗黑', createdAt: when });

    const [event] = await repo.listByMerchant('m1');
    expect(event.createdAt).toBe(when);
    expect(event.query).toBe('暗黑');
  });

  it('defaults nullable dimensions and metadata', async () => {
    const repo = createMemoryAnalyticsRepository();
    await repo.record({ eventType: 'style_impression', merchantId: 'm1' });

    const [event] = await repo.listByMerchant('m1');
    expect(event.customerId).toBeNull();
    expect(event.styleId).toBeNull();
    expect(event.metadata).toEqual({});
  });
});
