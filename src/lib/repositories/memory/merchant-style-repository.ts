import type { MerchantStyleRecord } from '@/domain/merchant-style';
import { canTransitionMerchantStyle } from '@/domain/merchant-style';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import type {
  MerchantStyleRepository,
  PublishMerchantStyleInput,
  SetMerchantStyleConfigInput,
} from '../types';

export function createMemoryMerchantStyleRepository(
  seed: MerchantStyleRecord[] = mockMerchantStyles,
): MerchantStyleRepository {
  const state = structuredClone(seed);
  const claimedAnalysis = new Set<string>();
  const claimKey = (id: string, merchantId: string) => `${merchantId}:${id}`;

  function clone(record: MerchantStyleRecord | undefined): MerchantStyleRecord | null {
    return record ? structuredClone(record) : null;
  }

  return {
    async listByMerchant(merchantId) {
      return structuredClone(state.filter((style) => style.merchantId === merchantId));
    },

    async listPublished() {
      return structuredClone(state.filter((style) => style.status === 'published'));
    },

    async getPublishedById(id) {
      return clone(state.find((style) => style.id === id && style.status === 'published'));
    },

    async getByIdForMerchant(id, merchantId) {
      return clone(state.find((style) => style.id === id && style.merchantId === merchantId));
    },

    async create(record) {
      state.push(structuredClone(record));
      return structuredClone(record);
    },

    async claimAnalysis(id, merchantId) {
      const record = state.find(
        (style) => style.id === id && style.merchantId === merchantId && style.status === 'processing',
      );
      const key = claimKey(id, merchantId);
      if (!record || claimedAnalysis.has(key)) return false;
      claimedAnalysis.add(key);
      return true;
    },

    async completeAnalysis(input) {
      const record = state.find(
        (style) => style.id === input.id && style.merchantId === input.merchantId,
      );
      if (!record || record.status !== 'processing') return null;
      record.title = input.title.trim();
      record.description = input.description;
      record.discoveryFacets = structuredClone(input.discoveryFacets);
      record.catalogBreakdown = structuredClone(input.items);
      record.previewPriceCents = input.previewPriceCents;
      record.previewDurationMin = input.previewDurationMin;
      record.status = 'needs_review';
      record.updatedAt = new Date().toISOString();
      claimedAnalysis.delete(claimKey(input.id, input.merchantId));
      return structuredClone(record);
    },

    async failAnalysis(id, merchantId) {
      const record = state.find(
        (style) => style.id === id && style.merchantId === merchantId && style.status === 'processing',
      );
      if (!record) return null;
      record.status = 'needs_review';
      record.updatedAt = new Date().toISOString();
      claimedAnalysis.delete(claimKey(id, merchantId));
      return structuredClone(record);
    },

    async setConfig(input: SetMerchantStyleConfigInput) {
      const record = state.find(
        (style) => style.id === input.id && style.merchantId === input.merchantId,
      );
      if (!record) return null;
      if (input.title && input.title.trim()) record.title = input.title.trim();
      record.description = input.description;
      record.discoveryFacets = structuredClone(input.discoveryFacets);
      record.catalogBreakdown = structuredClone(input.items);
      record.previewPriceCents = input.previewPriceCents;
      record.previewDurationMin = input.previewDurationMin;
      record.updatedAt = new Date().toISOString();
      return structuredClone(record);
    },

    async publish(input: PublishMerchantStyleInput) {
      const record = state.find(
        (style) => style.id === input.id && style.merchantId === input.merchantId,
      );
      if (!record || !canTransitionMerchantStyle(record.status, 'published')) return null;

      record.title = input.title;
      record.description = input.description;
      record.previewPriceCents = input.previewPriceCents;
      record.previewDurationMin = input.previewDurationMin;
      record.status = 'published';
      record.publishedAt = input.publishedAt;
      record.updatedAt = input.publishedAt;
      record.media.publishedBucket = input.publishedBucket;
      record.media.publishedPath = input.publishedPath;
      record.media.state = 'published';
      record.media.updatedAt = input.publishedAt;
      return structuredClone(record);
    },

    async archive(id, merchantId, archivedAt) {
      const record = state.find((style) => style.id === id && style.merchantId === merchantId);
      if (!record || !canTransitionMerchantStyle(record.status, 'archived')) return null;
      record.status = 'archived';
      record.archivedAt = archivedAt;
      record.updatedAt = archivedAt;
      return structuredClone(record);
    },
  };
}
