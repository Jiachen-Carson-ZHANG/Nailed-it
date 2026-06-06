import type { MerchantStyleRecord } from '@/domain/merchant-style';
import { calculateEstimate } from '@/domain/pricing';
import { demoMerchantId } from './merchants';
import { defaultPricingRules } from './pricing';
import { styleDefinitions } from './styles';

const SEEDED_AT = '2026-05-01T00:00:00.000Z';

export const mockMerchantStyles: MerchantStyleRecord[] = styleDefinitions.map((style) => {
  const preview = calculateEstimate(style.recognition, defaultPricingRules);
  return {
    id: style.id,
    merchantId: demoMerchantId,
    primaryMediaAssetId: `media-${style.id}`,
    title: style.title,
    status: 'published',
    discoveryFacets: style.discoveryFacets,
    recognition: style.recognition,
    catalogBreakdown: [],
    previewPriceCents: preview.price * 100,
    previewDurationMin: preview.duration,
    publishedAt: SEEDED_AT,
    archivedAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
    media: {
      id: `media-${style.id}`,
      merchantId: demoMerchantId,
      originalBucket: 'external',
      originalPath: style.imageUrl,
      publishedBucket: 'external',
      publishedPath: style.imageUrl,
      mimeType: 'image/jpeg',
      byteSize: 1,
      source: 'seed',
      state: 'published',
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    },
  };
});
