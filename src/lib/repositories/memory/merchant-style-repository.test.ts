import { describe, expect, it } from 'vitest';
import { createMemoryMerchantStyleRepository } from './merchant-style-repository';
import { mockMerchantStyles } from '@/mock/merchant-styles';

describe('createMemoryMerchantStyleRepository', () => {
  it('scopes merchant and customer published reads', async () => {
    const repo = createMemoryMerchantStyleRepository(mockMerchantStyles);

    expect(await repo.listByMerchant('merchant-nailed-it')).toHaveLength(mockMerchantStyles.length);
    expect(await repo.listPublished()).toHaveLength(mockMerchantStyles.length);
    expect(await repo.getPublishedById(mockMerchantStyles[0].id)).not.toBeNull();
  });

  it('creates, publishes, and archives a merchant style record', async () => {
    const repo = createMemoryMerchantStyleRepository([]);
    const draft = {
      ...mockMerchantStyles[0],
      id: 'draft-style',
      status: 'needs_review' as const,
      publishedAt: null,
      media: {
        ...mockMerchantStyles[0].media,
        id: 'draft-media',
        state: 'uploaded' as const,
        publishedBucket: null,
        publishedPath: null,
      },
    };

    await repo.create(draft);
    expect(await repo.listPublished()).toEqual([]);

    const published = await repo.publish({
      id: draft.id,
      merchantId: draft.merchantId,
      title: 'Reviewed title',
      previewPriceCents: 7200,
      previewDurationMin: 95,
      publishedBucket: 'merchant-style-published',
      publishedPath: 'merchant-nailed-it/draft-style.webp',
      publishedAt: '2026-06-06T01:00:00.000Z',
    });
    expect(published?.status).toBe('published');
    expect(published?.media.state).toBe('published');

    expect(await repo.archive(draft.id, draft.merchantId, '2026-06-06T02:00:00.000Z')).toMatchObject({
      status: 'archived',
    });
    expect(await repo.listPublished()).toEqual([]);
  });
});
