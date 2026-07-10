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

  it('walks the lifecycle: draft → published → unlisted → relist', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-2' }, demoMerchantId));
    expect((await repo.setStatus('gb-2', demoMerchantId, 'published'))?.status).toBe('published');
    expect((await repo.setStatus('gb-2', demoMerchantId, 'unlisted'))?.status).toBe('unlisted');
    expect((await repo.setStatus('gb-2', demoMerchantId, 'published'))?.status).toBe('published');
  });

  it('shelves a rejected draft (draft→unlisted) — rejecting an agent proposal must not delete it', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-4' }, demoMerchantId, 'SGD', 'run-9'));
    expect((await repo.setStatus('gb-4', demoMerchantId, 'unlisted'))?.status).toBe('unlisted');
    // The audit trail survives: the shelved deal still names the run that proposed it.
    expect((await repo.getByIdForMerchant('gb-4', demoMerchantId))?.sourceRunId).toBe('run-9');
  });

  it('rejects an illegal transition (unlisting what is already unlisted)', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-5' }, demoMerchantId));
    await repo.setStatus('gb-5', demoMerchantId, 'unlisted');
    expect(await repo.setStatus('gb-5', demoMerchantId, 'unlisted')).toBeNull();
  });

  it('carries the source run link for agent-proposed deals', async () => {
    await repo.save(toGroupbuyRecord({ ...createDefaultGroupbuyDraft(), id: 'gb-3' }, demoMerchantId, 'SGD', 'run-42'));
    expect((await repo.getByIdForMerchant('gb-3', demoMerchantId))?.sourceRunId).toBe('run-42');
  });
});
