import type { MerchantStyleRecord } from '@/domain/merchant-style';
import type { CatalogSelection } from '@/domain/catalog';
import { effectiveDurationMin } from '@/domain/catalog';
import { catalogItems } from './catalog';
import { demoMerchantId } from './merchants';
import { styleDefinitions } from './styles';

const SEEDED_AT = '2026-05-01T00:00:00.000Z';
const defaultStyleItem = catalogItems.find((item) => item.id === 'basic_manicure_service');
if (!defaultStyleItem || defaultStyleItem.defaultPriceCents === null) {
  throw new Error('mock merchant styles require the priced basic_manicure_service catalog item');
}
const defaultPreviewDurationMin = effectiveDurationMin(defaultStyleItem, catalogItems);

// Per-style catalog breakdowns: billable items + non-billable visual_attributes (shape / color /
// length / texture) so the customer chip UI can reconstruct the look without re-calling AI.
const styleBreakdowns: Record<string, CatalogSelection[]> = {
  'rose-cat-eye': [
    { catalogItemId: 'basic_manicure_service', quantity: 1 },
    { catalogItemId: 'cat_eye',               quantity: 1 },
    { catalogItemId: 'rhinestone_small',       quantity: 5 },
    { catalogItemId: 'shape_oval',             quantity: 1 },
    { catalogItemId: 'length_medium',          quantity: 1 },
    { catalogItemId: 'color_pink',             quantity: 1 },
    { catalogItemId: 'texture_glossy',         quantity: 1 },
  ],
  'soft-french': [
    { catalogItemId: 'basic_manicure_service', quantity: 1 },
    { catalogItemId: 'french_tip_basic',       quantity: 1 },
    { catalogItemId: 'shape_squoval',          quantity: 1 },
    { catalogItemId: 'length_short',           quantity: 1 },
    { catalogItemId: 'color_nude',             quantity: 1 },
    { catalogItemId: 'texture_glossy',         quantity: 1 },
  ],
  'chrome-mirror': [
    { catalogItemId: 'basic_manicure_service', quantity: 1 },
    { catalogItemId: 'chrome_powder',          quantity: 1 },
    { catalogItemId: 'shape_almond',           quantity: 1 },
    { catalogItemId: 'length_medium',          quantity: 1 },
    { catalogItemId: 'color_silver',           quantity: 1 },
    { catalogItemId: 'texture_metallic',       quantity: 1 },
  ],
  'minimal-solid': [
    { catalogItemId: 'basic_manicure_service', quantity: 1 },
    { catalogItemId: 'solid_color',            quantity: 1 },
    { catalogItemId: 'shape_round',            quantity: 1 },
    { catalogItemId: 'length_short',           quantity: 1 },
    { catalogItemId: 'color_nude',             quantity: 1 },
    { catalogItemId: 'texture_glossy',         quantity: 1 },
  ],
};

const defaultBreakdown: CatalogSelection[] = [
  { catalogItemId: 'basic_manicure_service', quantity: 1 },
];

export const mockMerchantStyles: MerchantStyleRecord[] = styleDefinitions.map((style) => {
  return {
    id: style.id,
    merchantId: demoMerchantId,
    primaryMediaAssetId: `media-${style.id}`,
    title: style.title,
    description: '',
    status: 'published',
    discoveryFacets: style.discoveryFacets,
    recognition: style.recognition,
    catalogBreakdown: structuredClone(styleBreakdowns[style.id] ?? defaultBreakdown),
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
