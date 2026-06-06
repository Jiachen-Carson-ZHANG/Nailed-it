import { describe, expect, it } from 'vitest';
import {
  canTransitionMerchantStyle,
  toPublishedMerchantStyle,
  type MerchantStyleRecord,
} from './merchant-style';

const publishedRecord: MerchantStyleRecord = {
  id: 'style-1',
  merchantId: 'merchant-1',
  primaryMediaAssetId: 'media-1',
  title: 'Rose chrome',
  status: 'published',
  discoveryFacets: [{ kind: 'style', label: 'Chrome' }],
  recognition: null,
  catalogBreakdown: [],
  previewPriceCents: 6500,
  previewDurationMin: 90,
  publishedAt: '2026-06-06T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:00.000Z',
  media: {
    id: 'media-1',
    merchantId: 'merchant-1',
    originalBucket: 'merchant-style-originals',
    originalPath: 'merchant-1/media-1/original.webp',
    publishedBucket: 'merchant-style-published',
    publishedPath: 'merchant-1/style-1.webp',
    mimeType: 'image/webp',
    byteSize: 1200,
    source: 'merchant_upload',
    state: 'published',
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  },
};

describe('merchant style lifecycle', () => {
  it('permits explicit review and publication transitions only', () => {
    expect(canTransitionMerchantStyle('processing', 'needs_review')).toBe(true);
    expect(canTransitionMerchantStyle('needs_review', 'published')).toBe(true);
    expect(canTransitionMerchantStyle('published', 'archived')).toBe(true);
    expect(canTransitionMerchantStyle('processing', 'published')).toBe(false);
    expect(canTransitionMerchantStyle('archived', 'published')).toBe(false);
  });

  it('maps a complete published record to a customer-safe style', () => {
    expect(toPublishedMerchantStyle(publishedRecord, 'https://cdn.example/style.webp')).toMatchObject({
      id: 'style-1',
      merchantId: 'merchant-1',
      imageUrl: 'https://cdn.example/style.webp',
      previewQuote: { source: 'style_preview', price: 65, duration: 90 },
    });
  });

  it('rejects unpublished or incomplete records from the customer view', () => {
    expect(
      toPublishedMerchantStyle({ ...publishedRecord, status: 'needs_review' }, 'https://cdn.example/style.webp'),
    ).toBeNull();
    expect(
      toPublishedMerchantStyle(
        { ...publishedRecord, media: { ...publishedRecord.media, publishedPath: null } },
        'https://cdn.example/style.webp',
      ),
    ).toBeNull();
  });
});
