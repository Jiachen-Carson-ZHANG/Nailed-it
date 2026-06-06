import { beforeEach, describe, expect, it } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import {
  archiveMerchantStyleAction,
  listCustomerPublishedStylesAction,
  listMerchantStylesAction,
  publishMerchantStyleAction,
  uploadMerchantStyleAction,
} from './merchant-style-actions';

describe('merchant style actions', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
    resetStyleMediaStorageForTests();
  });

  it('exposes only published styles to customer reads', async () => {
    const customerStyles = await listCustomerPublishedStylesAction();
    const merchantStyles = await listMerchantStylesAction();

    expect(customerStyles.length).toBeGreaterThan(0);
    expect(customerStyles).toHaveLength(merchantStyles.filter((style) => style.status === 'published').length);
    expect(customerStyles.every((style) => style.imageUrl.startsWith('http'))).toBe(true);
    expect(merchantStyles.some((style) => 'media' in style)).toBe(false);
  });

  it('uploads, publishes, and archives within the demo merchant scope', async () => {
    const upload = new FormData();
    upload.set('title', 'Merchant upload');
    const bytes = new TextEncoder().encode('RIFF0000WEBP');
    const file = new File([bytes], 'style.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    upload.set('image', file);

    const draft = await uploadMerchantStyleAction(upload);
    expect(draft.status).toBe('needs_review');

    const published = await publishMerchantStyleAction({
      styleId: draft.id,
      title: 'Reviewed upload',
      previewPriceCents: 4500,
      previewDurationMin: 60,
    });
    expect(published.status).toBe('published');

    expect(await archiveMerchantStyleAction(draft.id)).toMatchObject({ status: 'archived' });
  });
});
