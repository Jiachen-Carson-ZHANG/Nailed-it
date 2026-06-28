import type { MerchantStyleRecord } from '@/domain/merchant-style';
import type { LocalizedText } from '@/i18n/types';
import { effectiveDurationMin } from '@/domain/catalog';
import { catalogItems } from './catalog';
import { demoMerchantId } from './merchants';
import { styleDefinitions } from './styles';
import { fillerMerchantStyles } from './filler-merchant-styles';

const SEEDED_AT = '2026-05-01T00:00:00.000Z';
const defaultStyleItem = catalogItems.find((item) => item.id === 'basic_manicure_service');
if (!defaultStyleItem || defaultStyleItem.defaultPriceCents === null) {
  throw new Error('mock merchant styles require the priced basic_manicure_service catalog item');
}
const defaultCatalogBreakdown = [{ catalogItemId: defaultStyleItem.id, quantity: 1 }];
const defaultPreviewDurationMin = effectiveDurationMin(defaultStyleItem, catalogItems);

type SeededMerchantStyleRecord = MerchantStyleRecord & {
  titleLocalized: LocalizedText;
  descriptionLocalized: LocalizedText;
};

const heroMerchantStyles: SeededMerchantStyleRecord[] = styleDefinitions.map((style) => {
  return {
    id: style.id,
    merchantId: demoMerchantId,
    primaryMediaAssetId: `media-${style.id}`,
    title: style.title,
    description: style.descriptionLocalized.en,
    titleLocalized: style.titleLocalized,
    descriptionLocalized: style.descriptionLocalized,
    status: 'published',
    discoveryFacets: style.discoveryFacets,
    recognition: style.recognition,
    catalogBreakdown: structuredClone(defaultCatalogBreakdown),
    previewPriceCents: defaultStyleItem.defaultPriceCents,
    previewDurationMin: defaultPreviewDurationMin,
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

// Hero (Melissa) + 4 filler shops → the multi-merchant customer feed. listPublished() returns every
// published style across merchants, so the fillers surface in the feed + power 平台热门 automatically.
export const mockMerchantStyles: SeededMerchantStyleRecord[] = [...heroMerchantStyles, ...fillerMerchantStyles];
