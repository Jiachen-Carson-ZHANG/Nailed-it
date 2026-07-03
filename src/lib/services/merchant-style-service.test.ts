import { describe, expect, it } from 'vitest';
import { createMemoryMerchantStyleRepository } from '@/lib/repositories/memory/merchant-style-repository';
import { createMemoryRepositoryBundle } from '@/lib/repositories';
import type { MerchantStyleRepository } from '@/lib/repositories';
import type { StyleMediaStorage } from '@/lib/storage/types';
import { createMerchantStyleService } from './merchant-style-service';
import { createQuoteService } from './quote-service';

// quoteService reads catalog/merchant-pricing from a memory bundle; the style repo stays isolated.
function makeService(repo: MerchantStyleRepository, storage: StyleMediaStorage) {
  return createMerchantStyleService(repo, storage, createQuoteService(createMemoryRepositoryBundle()));
}

function createFakeStorage(): StyleMediaStorage & { objects: Set<string> } {
  const objects = new Set<string>();
  const bytesByKey = new Map<string, Uint8Array>();
  return {
    objects,
    async uploadOriginal(input) {
      const key = `${input.bucket}/${input.path}`;
      objects.add(key);
      bytesByKey.set(key, new Uint8Array(input.bytes));
    },
    async downloadOriginal(bucket, path) {
      const bytes = bytesByKey.get(`${bucket}/${path}`);
      if (!bytes) throw new Error('style_media_not_found');
      return new Uint8Array(bytes);
    },
    async publishCopy(input) {
      objects.add(`${input.publishedBucket}/${input.publishedPath}`);
    },
    async remove(bucket, path) {
      const key = `${bucket}/${path}`;
      objects.delete(key);
      bytesByKey.delete(key);
    },
    publicUrl(bucket, path) {
      return path.startsWith('http') ? path : `https://cdn.example/${bucket}/${path}`;
    },
    async privatePreviewUrl(bucket, path) {
      return `https://private.example/${bucket}/${path}`;
    },
  };
}

describe('merchant style service', () => {
  it('rejects unsupported and oversized uploads', async () => {
    const service = makeService(createMemoryMerchantStyleRepository([]), createFakeStorage());

    await expect(
      service.upload({
        merchantId: 'merchant-1',
        title: 'Design',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow('invalid_image_content');

    await expect(
      service.upload({
        merchantId: 'merchant-1',
        title: 'Design',
        bytes: new Uint8Array(10 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow('image_too_large');
  });

  it('uploads a private original and creates a processing record before AI analysis', async () => {
    const storage = createFakeStorage();
    const service = makeService(createMemoryMerchantStyleRepository([]), storage);

    const record = await service.upload({
      merchantId: 'merchant-1',
      title: 'New design',
      bytes: new TextEncoder().encode('RIFF0000WEBP'),
    });

    expect(record.status).toBe('processing');
    expect(record.imageUrl).toContain('https://private.example/merchant-style-originals/');
    expect([...storage.objects]).toHaveLength(1);
  });

  it('completes AI analysis atomically into a normalized needs-review draft', async () => {
    const storage = createFakeStorage();
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, storage);
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'Untitled design',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });

    const completed = await service.completeAnalysis({
      merchantId: 'merchant-1',
      styleId: draft.id,
      name: 'AI cat eye',
      description: 'Blue cat eye.',
      discoveryFacets: [{ kind: 'style', label: 'Cat eye' }],
      selections: [
        { catalogItemId: 'basic_manicure_service', quantity: 1 },
        { catalogItemId: 'color_effect_service', quantity: 1 },
        { catalogItemId: 'art_service', quantity: 1 },
        { catalogItemId: 'decoration_service', quantity: 1 },
        { catalogItemId: 'cat_eye', quantity: 7 },
      ],
    });

    expect(completed).toMatchObject({
      status: 'needs_review',
      title: 'AI cat eye',
      description: 'Blue cat eye.',
      catalogBreakdown: [
        { catalogItemId: 'basic_manicure_service', quantity: 1 },
        { catalogItemId: 'cat_eye', quantity: 1 },
      ],
      previewPriceCents: 3800,
    });
  });

  it('moves failed processing into editable needs-review state', async () => {
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, createFakeStorage());
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'Untitled design',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });

    expect(await service.failAnalysis('merchant-1', draft.id)).toMatchObject({
      status: 'needs_review',
      catalogBreakdown: [],
      previewPriceCents: null,
      previewDurationMin: null,
    });
  });

  it('publishes reviewed metadata and exposes it to customer reads', async () => {
    const storage = createFakeStorage();
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, storage);
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'New design',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });
    await service.failAnalysis('merchant-1', draft.id);

    await service.publish({
      merchantId: 'merchant-1',
      styleId: draft.id,
      title: 'Reviewed design',
      description: '圆形，裸色美甲',
      // Price + duration are DERIVED from these selections, not supplied:
      // basic_manicure_service = $28, 51 min (aggregated child steps).
      selections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    });

    expect(await service.listPublished()).toMatchObject([
      {
        id: draft.id,
        title: 'Reviewed design',
        description: '圆形，裸色美甲',
        catalogBreakdown: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
        previewQuote: { price: 28, duration: 51 },
      },
    ]);

    const archived = await service.archive('merchant-1', draft.id);
    expect(archived?.imageUrl).toContain('https://private.example/merchant-style-originals/');
    expect([...storage.objects].some((key) => key.startsWith('merchant-style-published/'))).toBe(false);

    const republished = await service.publish({
      merchantId: 'merchant-1',
      styleId: draft.id,
      title: 'Republished design',
      description: '重新上架的裸色美甲',
      selections: [
        { catalogItemId: 'basic_manicure_service', quantity: 1 },
        { catalogItemId: 'solid_color', quantity: 1 },
      ],
    });
    expect(republished).toMatchObject({
      status: 'published',
      title: 'Republished design',
      description: '重新上架的裸色美甲',
      previewPriceCents: 2800,
    });
    expect(republished.imageUrl).toContain('https://cdn.example/merchant-style-published/');
    expect([...storage.objects].some((key) => key.startsWith('merchant-style-published/'))).toBe(true);
  });

  it('persists the normalized per-set selection used to derive the preview', async () => {
    const storage = createFakeStorage();
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, storage);
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'New design',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });
    await service.failAnalysis('merchant-1', draft.id);

    const published = await service.publish({
      merchantId: 'merchant-1',
      styleId: draft.id,
      title: 'Reviewed design',
      description: '猫眼美甲',
      selections: [
        { catalogItemId: 'basic_manicure_service', quantity: 1 },
        { catalogItemId: 'cat_eye', quantity: 7 },
      ],
      // Descriptive facets are derived from the selections by the caller and persisted, so edits stick.
      discoveryFacets: [{ kind: 'shape', label: '圆形' }],
    });

    expect(published.catalogBreakdown).toEqual([
      { catalogItemId: 'basic_manicure_service', quantity: 1 },
      { catalogItemId: 'cat_eye', quantity: 1 },
    ]);
    expect(published.previewPriceCents).toBe(3800);
    expect(published.discoveryFacets).toEqual([{ kind: 'shape', label: '圆形' }]);
  });

  it('saves an editable review draft without allowing processing styles to be edited', async () => {
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, createFakeStorage());
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'Untitled design',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });

    await expect(service.saveDraft({
      merchantId: 'merchant-1',
      styleId: draft.id,
      title: 'Manual review',
      description: 'Edited before analysis completed.',
      selections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    })).rejects.toThrow('style_not_editable');

    await service.failAnalysis('merchant-1', draft.id);
    await expect(service.saveDraft({
      merchantId: 'merchant-1',
      styleId: draft.id,
      title: 'Manual review',
      description: 'Edited review.',
      selections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    })).resolves.toMatchObject({
      status: 'needs_review',
      title: 'Manual review',
      description: 'Edited review.',
      previewPriceCents: 2800,
    });
  });
});
