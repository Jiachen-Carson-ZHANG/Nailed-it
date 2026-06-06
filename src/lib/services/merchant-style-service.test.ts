import { describe, expect, it } from 'vitest';
import { createMemoryMerchantStyleRepository } from '@/lib/repositories/memory/merchant-style-repository';
import type { StyleMediaStorage } from '@/lib/storage/types';
import { createMerchantStyleService } from './merchant-style-service';

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
    const service = createMerchantStyleService(createMemoryMerchantStyleRepository([]), createFakeStorage());

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
    const service = createMerchantStyleService(createMemoryMerchantStyleRepository([]), storage);

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
    const service = createMerchantStyleService(repo, storage);
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
      previewPriceCents: 6800,
      previewDurationMin: 90,
    });

    expect(await service.listPublished()).toMatchObject([
      {
        id: draft.id,
        title: 'Reviewed design',
        previewQuote: { price: 68, duration: 90 },
      },
    ]);

    const archived = await service.archive('merchant-1', draft.id);
    expect(archived?.imageUrl).toContain('https://private.example/merchant-style-originals/');
    expect([...storage.objects].some((key) => key.startsWith('merchant-style-published/'))).toBe(false);
  });
});
