import type {
  MediaAsset,
  MerchantStyleRecord,
  MerchantStyleStatus,
  MediaAssetSource,
  MediaAssetState,
} from '@/domain/merchant-style';
import type { AIRecognitionResult, StyleDiscoveryFacet } from '@/domain/nail';
import { getServiceClient } from '@/lib/db/client';
import type {
  MerchantStyleRepository,
  PublishMerchantStyleInput,
  SetMerchantStyleConfigInput,
} from '../types';

type MediaAssetRow = {
  id: string;
  merchant_id: string;
  original_bucket: string;
  original_path: string;
  published_bucket: string | null;
  published_path: string | null;
  mime_type: string;
  byte_size: number;
  source: MediaAssetSource;
  state: MediaAssetState;
  created_at: string;
  updated_at: string;
};

type MerchantStyleItemRow = {
  catalog_item_id: string;
  quantity: number;
  position: number;
};

type MerchantStyleRow = {
  id: string;
  merchant_id: string;
  primary_media_asset_id: string;
  title: string;
  description: string;
  status: MerchantStyleStatus;
  discovery_facets: StyleDiscoveryFacet[];
  recognition: AIRecognitionResult | null;
  preview_price_cents: number | null;
  preview_duration_min: number | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  media_asset: MediaAssetRow;
  merchant_style_item: MerchantStyleItemRow[];
};

const selectRecord =
  '*, media_asset!merchant_style_media_same_merchant_fk(*), merchant_style_item(catalog_item_id, quantity, position)';

function rowToMedia(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    originalBucket: row.original_bucket,
    originalPath: row.original_path,
    publishedBucket: row.published_bucket,
    publishedPath: row.published_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    source: row.source,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRecord(row: MerchantStyleRow): MerchantStyleRecord {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    primaryMediaAssetId: row.primary_media_asset_id,
    title: row.title,
    description: row.description,
    status: row.status,
    discoveryFacets: row.discovery_facets,
    recognition: row.recognition,
    catalogBreakdown: [...(row.merchant_style_item ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ catalogItemId: i.catalog_item_id, quantity: i.quantity })),
    previewPriceCents: row.preview_price_cents,
    previewDurationMin: row.preview_duration_min,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: rowToMedia(row.media_asset),
  };
}

function mediaToRpc(record: MerchantStyleRecord) {
  return {
    id: record.media.id,
    merchant_id: record.media.merchantId,
    original_bucket: record.media.originalBucket,
    original_path: record.media.originalPath,
    mime_type: record.media.mimeType,
    byte_size: record.media.byteSize,
    source: record.media.source,
    state: record.media.state,
  };
}

function styleToRpc(record: MerchantStyleRecord) {
  return {
    id: record.id,
    merchant_id: record.merchantId,
    primary_media_asset_id: record.primaryMediaAssetId,
    title: record.title,
    description: record.description,
    status: record.status,
    discovery_facets: record.discoveryFacets,
    recognition: record.recognition,
    preview_price_cents: record.previewPriceCents,
    preview_duration_min: record.previewDurationMin,
  };
}

export function createSupabaseMerchantStyleRepository(): MerchantStyleRepository {
  async function getByIdForMerchant(id: string, merchantId: string): Promise<MerchantStyleRecord | null> {
    const { data, error } = await getServiceClient()
      .from('merchant_style')
      .select(selectRecord)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (error) throw new Error(`MerchantStyleRepository.getByIdForMerchant failed: ${error.message}`);
    return data ? rowToRecord(data as unknown as MerchantStyleRow) : null;
  }

  return {
    async listByMerchant(merchantId) {
      const { data, error } = await getServiceClient()
        .from('merchant_style')
        .select(selectRecord)
        .eq('merchant_id', merchantId)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(`MerchantStyleRepository.listByMerchant failed: ${error.message}`);
      return (data as unknown as MerchantStyleRow[]).map(rowToRecord);
    },

    async listPublished() {
      const { data, error } = await getServiceClient()
        .from('merchant_style')
        .select(selectRecord)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw new Error(`MerchantStyleRepository.listPublished failed: ${error.message}`);
      return (data as unknown as MerchantStyleRow[]).map(rowToRecord);
    },

    async getPublishedById(id) {
      const { data, error } = await getServiceClient()
        .from('merchant_style')
        .select(selectRecord)
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw new Error(`MerchantStyleRepository.getPublishedById failed: ${error.message}`);
      return data ? rowToRecord(data as unknown as MerchantStyleRow) : null;
    },

    getByIdForMerchant,

    async create(record) {
      const { error } = await getServiceClient().rpc('create_merchant_style', {
        p_media: mediaToRpc(record),
        p_style: styleToRpc(record),
      });
      if (error) throw new Error(`MerchantStyleRepository.create failed: ${error.message}`);
      const created = await getByIdForMerchant(record.id, record.merchantId);
      if (!created) throw new Error('MerchantStyleRepository.create failed: created row missing');
      return created;
    },

    async claimAnalysis(id, merchantId) {
      const { data, error } = await getServiceClient().rpc('claim_merchant_style_analysis', {
        p_style_id: id,
        p_merchant_id: merchantId,
      });
      if (error) throw new Error(`MerchantStyleRepository.claimAnalysis failed: ${error.message}`);
      return data === true;
    },

    async completeAnalysis(input) {
      const { error } = await getServiceClient().rpc('complete_merchant_style_analysis', {
        p_style_id: input.id,
        p_merchant_id: input.merchantId,
        p_title: input.title,
        p_description: input.description,
        p_discovery_facets: input.discoveryFacets,
        p_items: input.items.map((sel, index) => ({
          id: `msitem-${input.id}-${sel.catalogItemId}`,
          catalog_item_id: sel.catalogItemId,
          quantity: sel.quantity,
          position: index,
        })),
        p_preview_price_cents: input.previewPriceCents,
        p_preview_duration_min: input.previewDurationMin,
      });
      if (error) throw new Error(`MerchantStyleRepository.completeAnalysis failed: ${error.message}`);
      return getByIdForMerchant(input.id, input.merchantId);
    },

    async failAnalysis(id, merchantId) {
      const { error } = await getServiceClient().rpc('fail_merchant_style_analysis', {
        p_style_id: id,
        p_merchant_id: merchantId,
      });
      if (error) throw new Error(`MerchantStyleRepository.failAnalysis failed: ${error.message}`);
      return getByIdForMerchant(id, merchantId);
    },

    async setConfig(input: SetMerchantStyleConfigInput) {
      const { error } = await getServiceClient().rpc('set_merchant_style_config', {
        p_style_id: input.id,
        p_merchant_id: input.merchantId,
        p_description: input.description,
        p_discovery_facets: input.discoveryFacets,
        p_items: input.items.map((sel, index) => ({
          id: `msitem-${input.id}-${sel.catalogItemId}`,
          catalog_item_id: sel.catalogItemId,
          quantity: sel.quantity,
          position: index,
        })),
        p_preview_price_cents: input.previewPriceCents,
        p_preview_duration_min: input.previewDurationMin,
        p_title: input.title ?? '',
      });
      if (error) throw new Error(`MerchantStyleRepository.setConfig failed: ${error.message}`);
      return getByIdForMerchant(input.id, input.merchantId);
    },

    async publish(input: PublishMerchantStyleInput) {
      const { error } = await getServiceClient().rpc('publish_merchant_style', {
        p_style_id: input.id,
        p_merchant_id: input.merchantId,
        p_title: input.title,
        p_description: input.description,
        p_preview_price_cents: input.previewPriceCents,
        p_preview_duration_min: input.previewDurationMin,
        p_published_bucket: input.publishedBucket,
        p_published_path: input.publishedPath,
        p_published_at: input.publishedAt,
      });
      if (error) throw new Error(`MerchantStyleRepository.publish failed: ${error.message}`);
      return getByIdForMerchant(input.id, input.merchantId);
    },

    async archive(id, merchantId, archivedAt) {
      const { data, error } = await getServiceClient()
        .from('merchant_style')
        .update({ status: 'archived', archived_at: archivedAt, updated_at: archivedAt })
        .eq('id', id)
        .eq('merchant_id', merchantId)
        .in('status', ['needs_review', 'published', 'failed'])
        .select('id')
        .maybeSingle();
      if (error) throw new Error(`MerchantStyleRepository.archive failed: ${error.message}`);
      return data ? getByIdForMerchant(id, merchantId) : null;
    },

    async deleteDraft(id, merchantId) {
      const client = getServiceClient();
      await client.from('merchant_style_item').delete().eq('merchant_style_id', id);
      const { data, error } = await client
        .from('merchant_style')
        .delete()
        .eq('id', id)
        .eq('merchant_id', merchantId)
        .neq('status', 'published')
        .select('id')
        .maybeSingle();
      if (error) throw new Error(`MerchantStyleRepository.deleteDraft failed: ${error.message}`);
      return Boolean(data);
    },
  };
}
