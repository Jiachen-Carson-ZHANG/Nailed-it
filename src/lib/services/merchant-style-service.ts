import { randomUUID } from 'node:crypto';
import type { CatalogSelection } from '@/domain/catalog';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type {
  MerchantStyleRecord,
  MerchantStyleView,
  PublishedMerchantStyle,
} from '@/domain/merchant-style';
import { toPublishedMerchantStyle } from '@/domain/merchant-style';
import type { MerchantStyleRepository } from '@/lib/repositories';
import type { QuoteService } from '@/lib/services/quote-service';
import {
  merchantStyleOriginalsBucket,
  merchantStylePublishedBucket,
} from '@/lib/storage/supabase-style-media-storage';
import type { StyleMediaStorage } from '@/lib/storage/types';

const maxUploadBytes = 10 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Every nail set includes the base manicure (clean / cuticle / prep) — the $28/51-min floor. It is
// ai_detectable='no', so it is never recognised and must be injected on every write, regardless of
// whether the config came from AI or manual editing. Without it a style can derive $0 / no prep steps.
const BASE_MANICURE_ID = 'basic_manicure_service';
function withBaseManicure(selections: CatalogSelection[]): CatalogSelection[] {
  if (selections.some((selection) => selection.catalogItemId === BASE_MANICURE_ID)) return selections;
  return [{ catalogItemId: BASE_MANICURE_ID, quantity: 1 }, ...selections];
}

export type UploadMerchantStyleInput = {
  merchantId: string;
  title: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type PublishMerchantStyleServiceInput = {
  merchantId: string;
  styleId: string;
  title: string;
  description: string;
  /** Catalog selections; price + duration are DERIVED from these, never client-supplied. */
  selections: CatalogSelection[];
  /** Descriptive facets (colour / shape / …) derived from the same selections by the caller. When
   *  omitted, the style keeps its existing facets. */
  discoveryFacets?: StyleDiscoveryFacet[];
};

export type SaveMerchantStyleDraftInput = PublishMerchantStyleServiceInput;

export type ApplyStyleConfigInput = {
  merchantId: string;
  styleId: string;
  name: string;
  description: string;
  discoveryFacets: StyleDiscoveryFacet[];
  selections: CatalogSelection[];
};

function validateTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('style_title_required');
  return trimmed;
}

function hasValidImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

export function createMerchantStyleService(
  repository: MerchantStyleRepository,
  storage: StyleMediaStorage,
  quoteService: QuoteService,
) {
  // Derive price + duration from catalog selections — the merchant never types them (finding 1).
  // Throws if the selections cannot be priced into a bookable (>0 price, >0 duration) style.
  async function deriveSnapshot(merchantId: string, selections: CatalogSelection[]) {
    if (selections.length === 0) throw new Error('style_selections_required');
    const quote = await quoteService.buildQuote({ merchantId, selections });
    if (quote.totalPriceCents <= 0) throw new Error('invalid_preview_price');
    if (quote.totalDurationMin <= 0) throw new Error('invalid_preview_duration');
    return {
      previewPriceCents: quote.totalPriceCents,
      previewDurationMin: quote.totalDurationMin,
      selections: quote.lines.map((line) => ({
        catalogItemId: line.catalogItemId,
        quantity: line.quantity,
      })),
    };
  }

  async function merchantView(record: MerchantStyleRecord): Promise<MerchantStyleView> {
    const imageUrl =
      record.status === 'published' && record.media.publishedBucket && record.media.publishedPath
        ? storage.publicUrl(record.media.publishedBucket, record.media.publishedPath)
        : await storage.privatePreviewUrl(record.media.originalBucket, record.media.originalPath);
    return {
      id: record.id,
      merchantId: record.merchantId,
      title: record.title,
      description: record.description,
      status: record.status,
      catalogBreakdown: structuredClone(record.catalogBreakdown),
      discoveryFacets: structuredClone(record.discoveryFacets),
      previewPriceCents: record.previewPriceCents,
      previewDurationMin: record.previewDurationMin,
      updatedAt: record.updatedAt,
      imageUrl,
    };
  }

  return {
    async listMerchant(merchantId: string): Promise<MerchantStyleView[]> {
      const records = await repository.listByMerchant(merchantId);
      return Promise.all(records.map(merchantView));
    },

    async getMerchant(merchantId: string, styleId: string): Promise<MerchantStyleView | null> {
      const record = await repository.getByIdForMerchant(styleId, merchantId);
      return record ? merchantView(record) : null;
    },

    async listPublished(): Promise<PublishedMerchantStyle[]> {
      const records = await repository.listPublished();
      return records.flatMap((record) => {
        if (!record.media.publishedBucket || !record.media.publishedPath) return [];
        const mapped = toPublishedMerchantStyle(
          record,
          storage.publicUrl(record.media.publishedBucket, record.media.publishedPath),
        );
        return mapped ? [mapped] : [];
      });
    },

    async getPublished(styleId: string): Promise<PublishedMerchantStyle | null> {
      const record = await repository.getPublishedById(styleId);
      if (!record?.media.publishedBucket || !record.media.publishedPath) return null;
      return toPublishedMerchantStyle(
        record,
        storage.publicUrl(record.media.publishedBucket, record.media.publishedPath),
      );
    },

    async upload(input: UploadMerchantStyleInput): Promise<MerchantStyleView> {
      const extension = imageExtensions[input.mimeType];
      if (!extension) throw new Error('unsupported_image_type');
      if (input.bytes.byteLength === 0) throw new Error('empty_image');
      if (input.bytes.byteLength > maxUploadBytes) throw new Error('image_too_large');
      if (!hasValidImageSignature(input.mimeType, input.bytes)) throw new Error('invalid_image_content');

      // The DB requires a non-empty title (merchant_style_title_check). A fresh upload has none yet, so
      // store a placeholder; the merchant renames it in the editor before publishing.
      const title = input.title.trim() || '未命名设计';
      const now = new Date().toISOString();
      const styleId = `style-${randomUUID()}`;
      const mediaId = `media-${randomUUID()}`;
      const originalPath = `${input.merchantId}/${styleId}/${mediaId}.${extension}`;
      const record: MerchantStyleRecord = {
        id: styleId,
        merchantId: input.merchantId,
        primaryMediaAssetId: mediaId,
        title,
        description: '',
        status: 'processing',
        discoveryFacets: [],
        recognition: null,
        catalogBreakdown: [],
        previewPriceCents: null,
        previewDurationMin: null,
        publishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        media: {
          id: mediaId,
          merchantId: input.merchantId,
          originalBucket: merchantStyleOriginalsBucket,
          originalPath,
          publishedBucket: null,
          publishedPath: null,
          mimeType: input.mimeType,
          byteSize: input.bytes.byteLength,
          source: 'merchant_upload',
          state: 'uploaded',
          createdAt: now,
          updatedAt: now,
        },
      };

      await storage.uploadOriginal({
        bucket: merchantStyleOriginalsBucket,
        path: originalPath,
        bytes: input.bytes,
        contentType: input.mimeType,
      });
      try {
        return merchantView(await repository.create(record));
      } catch (error) {
        await storage.remove(merchantStyleOriginalsBucket, originalPath).catch((cleanupError) => {
          console.error('[merchant-style] failed to remove orphaned original', cleanupError);
        });
        throw error;
      }
    },

    async completeAnalysis(input: ApplyStyleConfigInput): Promise<MerchantStyleView | null> {
      const record = await repository.getByIdForMerchant(input.styleId, input.merchantId);
      if (!record || record.status !== 'processing') return null;
      const snapshot = await deriveSnapshot(input.merchantId, withBaseManicure(input.selections));
      const completed = await repository.completeAnalysis({
        id: input.styleId,
        merchantId: input.merchantId,
        title: validateTitle(input.name),
        description: input.description.trim(),
        discoveryFacets: input.discoveryFacets ?? record.discoveryFacets,
        items: snapshot.selections,
        previewPriceCents: snapshot.previewPriceCents,
        previewDurationMin: snapshot.previewDurationMin,
      });
      return completed ? merchantView(completed) : null;
    },

    async failAnalysis(merchantId: string, styleId: string): Promise<MerchantStyleView | null> {
      const failed = await repository.failAnalysis(styleId, merchantId);
      return failed ? merchantView(failed) : null;
    },

    async saveDraft(input: SaveMerchantStyleDraftInput): Promise<MerchantStyleView> {
      const title = validateTitle(input.title);
      const record = await repository.getByIdForMerchant(input.styleId, input.merchantId);
      // Editable while a draft (needs_review) OR already published — a merchant can fix a wrong layer
      // on a live style. Archived styles must go through publish(), so the public copy is recreated.
      if (!record || (record.status !== 'needs_review' && record.status !== 'published')) {
        throw new Error('style_not_editable');
      }
      const snapshot = await deriveSnapshot(input.merchantId, withBaseManicure(input.selections));
      const saved = await repository.setConfig({
        id: input.styleId,
        merchantId: input.merchantId,
        title,
        description: input.description.trim(),
        discoveryFacets: input.discoveryFacets ?? record.discoveryFacets,
        items: snapshot.selections,
        previewPriceCents: snapshot.previewPriceCents,
        previewDurationMin: snapshot.previewDurationMin,
      });
      if (!saved) throw new Error('style_not_editable');
      return merchantView(saved);
    },

    async publish(input: PublishMerchantStyleServiceInput): Promise<MerchantStyleView> {
      const title = validateTitle(input.title);
      const record = await repository.getByIdForMerchant(input.styleId, input.merchantId);
      if (!record || (record.status !== 'needs_review' && record.status !== 'archived')) {
        throw new Error('style_not_publishable');
      }

      // Server derives price/duration from the chosen catalog items (finding 1). Persist the items +
      // derived snapshots first so the published row's preview always traces back to its breakdown.
      const snapshot = await deriveSnapshot(input.merchantId, withBaseManicure(input.selections));
      const configured = await repository.setConfig({
        id: input.styleId,
        merchantId: input.merchantId,
        description: input.description.trim(),
        discoveryFacets: input.discoveryFacets ?? record.discoveryFacets,
        items: snapshot.selections,
        previewPriceCents: snapshot.previewPriceCents,
        previewDurationMin: snapshot.previewDurationMin,
      });
      if (!configured) throw new Error('style_not_publishable');

      const extension = imageExtensions[record.media.mimeType];
      if (!extension) throw new Error('unsupported_image_type');
      const publishedPath = `${input.merchantId}/${input.styleId}.${extension}`;
      await storage.publishCopy({
        originalBucket: record.media.originalBucket,
        originalPath: record.media.originalPath,
        publishedBucket: merchantStylePublishedBucket,
        publishedPath,
        contentType: record.media.mimeType,
      });

      try {
        const published = await repository.publish({
          id: input.styleId,
          merchantId: input.merchantId,
          title,
          description: input.description.trim(),
          previewPriceCents: snapshot.previewPriceCents,
          previewDurationMin: snapshot.previewDurationMin,
          publishedBucket: merchantStylePublishedBucket,
          publishedPath,
          publishedAt: new Date().toISOString(),
        });
        if (!published) throw new Error('style_not_publishable');
        return merchantView(published);
      } catch (error) {
        await storage.remove(merchantStylePublishedBucket, publishedPath).catch((cleanupError) => {
          console.error('[merchant-style] failed to remove orphaned published copy', cleanupError);
        });
        throw error;
      }
    },

    async archive(merchantId: string, styleId: string): Promise<MerchantStyleView | null> {
      const existing = await repository.getByIdForMerchant(styleId, merchantId);
      if (!existing) return null;
      const archived = await repository.archive(styleId, merchantId, new Date().toISOString());
      if (archived && existing.media.publishedBucket && existing.media.publishedPath) {
        await storage.remove(existing.media.publishedBucket, existing.media.publishedPath).catch((error) => {
          console.error('[merchant-style] failed to remove archived public copy', error);
        });
      }
      return archived ? merchantView(archived) : null;
    },

    // Hard-delete an unpublished draft and best-effort clean its stored original. Published styles
    // are archived (kept), never deleted, so the repo refuses them.
    async deleteDraft(merchantId: string, styleId: string): Promise<boolean> {
      const existing = await repository.getByIdForMerchant(styleId, merchantId);
      if (!existing || existing.status === 'published') return false;
      const deleted = await repository.deleteDraft(styleId, merchantId);
      if (deleted) {
        await storage.remove(existing.media.originalBucket, existing.media.originalPath).catch((error) => {
          console.error('[merchant-style] failed to remove deleted original', error);
        });
      }
      return deleted;
    },
  };
}
