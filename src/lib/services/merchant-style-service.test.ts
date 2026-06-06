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
  return {
    objects,
    async uploadOriginal(input) {
      objects.add(`${input.bucket}/${input.path}`);
    },
    async publishCopy(input) {
      objects.add(`${input.publishedBucket}/${input.publishedPath}`);
    },
    async remove(bucket, path) {
      objects.delete(`${bucket}/${path}`);
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
        mimeType: 'image/gif',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow('unsupported_image_type');

    await expect(
      service.upload({
        merchantId: 'merchant-1',
        title: 'Design',
        mimeType: 'image/jpeg',
        bytes: new Uint8Array(10 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow('image_too_large');
  });

  it('uploads a private original and creates a needs-review record', async () => {
    const storage = createFakeStorage();
    const service = makeService(createMemoryMerchantStyleRepository([]), storage);

    const record = await service.upload({
      merchantId: 'merchant-1',
      title: 'New design',
      mimeType: 'image/webp',
        bytes: new TextEncoder().encode('RIFF0000WEBP'),
    });

    expect(record.status).toBe('needs_review');
    expect(record.imageUrl).toContain('https://private.example/merchant-style-originals/');
    expect([...storage.objects]).toHaveLength(1);
  });

  it('publishes reviewed metadata and exposes it to customer reads', async () => {
    const storage = createFakeStorage();
    const repo = createMemoryMerchantStyleRepository([]);
    const service = makeService(repo, storage);
    const draft = await service.upload({
      merchantId: 'merchant-1',
      title: 'New design',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });

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
  });
});
