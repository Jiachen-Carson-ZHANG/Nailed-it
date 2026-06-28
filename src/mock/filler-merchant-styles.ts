// Filler-merchant catalogs (design spec 2026-06-27 §1). Four non-hero shops populate the multi-merchant
// customer feed, enable cross-merchant ads, and — the key win — make 平台热门 a REAL signal (aggregate
// cross-merchant popularity) so 选品's external comparison isn't mocked.
//
// NOTE: nail images are PLACEHOLDERS — they reuse the hero pics as stand-ins (duplicates are allowed
// across merchants per the plan). When the 100 real pics arrive, swap `imageUrl` here; nothing else
// changes. Tags are authored now so trend-matching works; refine via the breakdown AI on real pics later.
import type { MerchantStyleRecord } from '@/domain/merchant-style';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { LocalizedText } from '@/i18n/types';
import { mockAIResult } from './ai';
import { styleDefinitions } from './styles';

const SEEDED_AT = '2026-05-01T00:00:00.000Z';
const PLACEHOLDER_IMAGES = styleDefinitions.map((s) => s.imageUrl); // hero pics as stand-ins
const placeholderImage = (i: number) => PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length];
const CATALOG_BREAKDOWN = [{ catalogItemId: 'basic_manicure_service', quantity: 1 }];

type SeededRecord = MerchantStyleRecord & { titleLocalized: LocalizedText; descriptionLocalized: LocalizedText };

type FillerSpec = {
  merchantId: string;
  brand: string;
  prefix: string;
  /** tag pool; each style draws a rotating window from it (overlaps hero tags for platform-hot). */
  pool: string[];
  count: number;
};

const SPECS: FillerSpec[] = [
  { merchantId: 'merchant-gloss-lab', brand: 'Gloss Lab', prefix: 'gloss', count: 18,
    pool: ['镜面', '猫眼', '金属感', '银色', '亮面', '贵气', '派对风', '辣妹风', '蓝色', '闪亮感'] },
  { merchantId: 'merchant-aurora-nails', brand: 'Aurora', prefix: 'aurora', count: 18,
    pool: ['法式风', '裸色', '透色', '清冷感', '新娘风', '杏仁形', '日常通勤', '白色', '极简', '韩系'] },
  { merchantId: 'merchant-velvet-tips', brand: 'Velvet', prefix: 'velvet', count: 18,
    pool: ['暗黑', 'Y2K', '辣妹风', '红色', '棺材形 / 梯形', '可爱', '透感', '复杂', '贵气'] },
  { merchantId: 'merchant-mond-studio', brand: 'MöND', prefix: 'mond', count: 18,
    pool: ['甜美', '可爱', '韩系', '粉色', '果冻感', '圆形', '短甲', '奶茶', '多色'] },
];

const facets = (labels: string[]): StyleDiscoveryFacet[] => labels.map((label) => ({ kind: 'style', label }));

function buildFiller(spec: FillerSpec, imgOffset: number): SeededRecord[] {
  return Array.from({ length: spec.count }, (_, i) => {
    // rotating 3-tag window over the pool → deterministic, varied, overlapping tag sets
    const labels = [0, 1, 2].map((k) => spec.pool[(i + k) % spec.pool.length]);
    const id = `style-${spec.prefix}-${i + 1}`;
    const title = `${spec.brand} ${labels[0]} #${i + 1}`;
    const localized: LocalizedText = { 'zh-CN': `${labels[0]}${spec.brand}${i + 1}`, en: title };
    // Placeholder image (hero pic stand-in). The `#id` fragment makes the stored media path unique
    // (media_asset has a unique (bucket, path) constraint; dupes across fillers would collide) while
    // the browser drops the fragment → the same image still renders. Swap the base URL for real pics.
    const imageUrl = `${placeholderImage(imgOffset + i)}#${id}`;
    const previewPriceCents = 6800 + ((i * 700) % 7000); // ~SGD 68–138, varied
    return {
      id,
      merchantId: spec.merchantId,
      primaryMediaAssetId: `media-${id}`,
      title,
      description: title,
      titleLocalized: localized,
      descriptionLocalized: localized,
      status: 'published',
      discoveryFacets: facets(labels),
      recognition: mockAIResult,
      catalogBreakdown: structuredClone(CATALOG_BREAKDOWN),
      previewPriceCents,
      previewDurationMin: 60,
      publishedAt: SEEDED_AT,
      archivedAt: null,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
      media: {
        id: `media-${id}`,
        merchantId: spec.merchantId,
        originalBucket: 'external',
        originalPath: imageUrl,
        publishedBucket: 'external',
        publishedPath: imageUrl,
        mimeType: 'image/jpeg',
        byteSize: 1,
        source: 'seed',
        state: 'published',
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      },
    } satisfies SeededRecord;
  });
}

export const fillerMerchantStyles: SeededRecord[] = SPECS.flatMap((spec, idx) =>
  buildFiller(spec, idx * 7),
);
