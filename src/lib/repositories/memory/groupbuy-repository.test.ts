import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultGroupbuyDraft, toGroupbuyRecord } from '@/domain/groupbuy';
import { demoMerchantId } from '@/mock/merchants';
import { createMemoryGroupbuyRepository } from './groupbuy-repository';

describe('memory groupbuy repository', () => {
  let repo: ReturnType<typeof createMemoryGroupbuyRepository>;
  beforeEach(() => {
    repo = createMemoryGroupbuyRepository([]);
  });

  it('saves and lists a draft scoped to the merchant', async () => {
    const draft = toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-1', title: '工作日套餐' }, demoMerchantId);
    await repo.save(draft);
    const list = await repo.listByMerchant(demoMerchantId);
    expect(list.map((d) => d.id)).toEqual(['gb-1']);
    expect(await repo.listByMerchant('other-merchant')).toEqual([]);
    expect((await repo.getByIdForMerchant('gb-1', demoMerchantId))?.title).toBe('工作日套餐');
  });

  it('publishes then unlists via legal transitions, rejecting illegal ones', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-2' }, demoMerchantId));
    expect(await repo.setStatus('gb-2', demoMerchantId, 'unlisted')).toBeNull(); // draft→unlisted illegal
    expect((await repo.setStatus('gb-2', demoMerchantId, 'published'))?.status).toBe('published');
    expect((await repo.setStatus('gb-2', demoMerchantId, 'unlisted'))?.status).toBe('unlisted');
  });

  it('carries the source run link for agent-proposed deals', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-3' }, demoMerchantId, 'SGD', 'run-42'));
    expect((await repo.getByIdForMerchant('gb-3', demoMerchantId))?.sourceRunId).toBe('run-42');
  });
});
