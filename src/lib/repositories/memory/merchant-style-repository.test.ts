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
      description: '裸色美甲',
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

  it('atomically completes or fails processing analysis into needs review', async () => {
    const repo = createMemoryMerchantStyleRepository([]);
    const processing = {
      ...mockMerchantStyles[0],
      id: 'processing-style',
      title: 'Untitled design',
      status: 'processing' as const,
      description: '',
      discoveryFacets: [],
      catalogBreakdown: [],
      previewPriceCents: null,
      previewDurationMin: null,
      publishedAt: null,
      media: {
        ...mockMerchantStyles[0].media,
        id: 'processing-media',
        state: 'uploaded' as const,
        publishedBucket: null,
        publishedPath: null,
      },
    };
    await repo.create(processing);
    expect(await repo.claimAnalysis(processing.id, processing.merchantId)).toBe(true);
    expect(await repo.claimAnalysis(processing.id, processing.merchantId)).toBe(false);

    expect(await repo.completeAnalysis({
      id: processing.id,
      merchantId: processing.merchantId,
      title: 'AI title',
      description: 'AI description',
      discoveryFacets: [{ kind: 'style', label: 'Cat eye' }],
      items: [{ catalogItemId: 'cat_eye', quantity: 1 }],
      previewPriceCents: 1000,
      previewDurationMin: 20,
    })).toMatchObject({
      status: 'needs_review',
      title: 'AI title',
      catalogBreakdown: [{ catalogItemId: 'cat_eye', quantity: 1 }],
    });

    const another = { ...processing, id: 'failed-analysis', media: { ...processing.media, id: 'failed-media' } };
    await repo.create(another);
    expect(await repo.claimAnalysis(another.id, another.merchantId)).toBe(true);
    expect(await repo.failAnalysis(another.id, another.merchantId)).toMatchObject({
      status: 'needs_review',
      catalogBreakdown: [],
    });
  });
});
