import type { CatalogSelection } from './catalog';
import type { AIRecognitionResult, NailStyleCard, StyleDiscoveryFacet } from './nail';

export const merchantStyleStatuses = [
  'processing',
  'needs_review',
  'published',
  'archived',
  'failed',
] as const;

export type MerchantStyleStatus = typeof merchantStyleStatuses[number];
export type MediaAssetState = 'uploaded' | 'published' | 'failed';
export type MediaAssetSource = 'merchant_upload' | 'completed_booking' | 'seed';

export type MediaAsset = {
  id: string;
  merchantId: string;
  originalBucket: string;
  originalPath: string;
  publishedBucket: string | null;
  publishedPath: string | null;
  mimeType: string;
  byteSize: number;
  source: MediaAssetSource;
  state: MediaAssetState;
  createdAt: string;
  updatedAt: string;
};

export type MerchantStyle = {
  id: string;
  merchantId: string;
  primaryMediaAssetId: string;
  title: string;
  description: string;
  status: MerchantStyleStatus;
  discoveryFacets: StyleDiscoveryFacet[];
  recognition: AIRecognitionResult | null;
  /** Authoritative catalog selections (relational merchant_style_item). Derives price + duration. */
  catalogBreakdown: CatalogSelection[];
  previewPriceCents: number | null;
  previewDurationMin: number | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantStyleRecord = MerchantStyle & {
  media: MediaAsset;
};

export type PublishedMerchantStyle = NailStyleCard & {
  merchantId: string;
  description: string;
  /** The published catalog selections, so the customer booking flow can re-quote them server-side. */
  catalogBreakdown: CatalogSelection[];
  recognition: AIRecognitionResult | null;
};

export type MerchantStyleView = Pick<
  MerchantStyle,
  | 'id'
  | 'merchantId'
  | 'title'
  | 'description'
  | 'status'
  | 'catalogBreakdown'
  | 'previewPriceCents'
  | 'previewDurationMin'
  | 'updatedAt'
> & {
  imageUrl: string;
};

const transitions: Record<MerchantStyleStatus, MerchantStyleStatus[]> = {
  processing: ['needs_review', 'failed'],
  needs_review: ['published', 'archived', 'failed'],
  published: ['archived'],
  archived: [],
  failed: ['needs_review', 'archived'],
};

export function canTransitionMerchantStyle(
  from: MerchantStyleStatus,
  to: MerchantStyleStatus,
): boolean {
  return transitions[from].includes(to);
}

export function toPublishedMerchantStyle(
  record: MerchantStyleRecord,
  publicImageUrl: string,
): PublishedMerchantStyle | null {
  if (
    record.status !== 'published' ||
    !record.media.publishedBucket ||
    !record.media.publishedPath ||
    record.previewPriceCents === null ||
    record.previewDurationMin === null ||
    record.previewPriceCents <= 0 ||
    record.previewDurationMin <= 0
  ) {
    return null;
  }

  return {
    id: record.id,
    merchantId: record.merchantId,
    title: record.title,
    description: record.description,
    catalogBreakdown: structuredClone(record.catalogBreakdown),
    imageUrl: publicImageUrl,
    discoveryFacets: structuredClone(record.discoveryFacets),
    popularityScore: 0,
    recognition: record.recognition ? structuredClone(record.recognition) : null,
    previewQuote: {
      source: 'style_preview',
      price: record.previewPriceCents / 100,
      duration: record.previewDurationMin,
    },
  };
}
