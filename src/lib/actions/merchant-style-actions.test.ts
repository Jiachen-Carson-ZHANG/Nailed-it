import { beforeEach, describe, expect, it } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import {
  archiveMerchantStyleAction,
  analyzeMerchantStyleAction,
  getMerchantStyleReviewAction,
  listConfigurableCatalogAction,
  listCustomerPublishedStylesAction,
  listMerchantStylesAction,
  previewMerchantStyleQuoteAction,
  publishMerchantStyleAction,
  saveMerchantStyleDraftAction,
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

  it('uploads only the image, analyzes the stored original, publishes, and archives within the demo merchant scope', async () => {
    const upload = new FormData();
    const bytes = new TextEncoder().encode('RIFF0000WEBP');
    const file = new File([bytes], 'style.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    upload.set('image', file);

    const draft = await uploadMerchantStyleAction(upload);
    expect(draft).toMatchObject({ status: 'processing', title: '未命名设计' });
    expect(await getMerchantStyleReviewAction(draft.id)).toMatchObject({ id: draft.id });

    // Tests have no OpenRouter key, so analysis fails closed into an editable manual-review draft.
    expect(await analyzeMerchantStyleAction(draft.id)).toMatchObject({
      id: draft.id,
      status: 'needs_review',
    });

    const quote = await previewMerchantStyleQuoteAction([
      { catalogItemId: 'basic_manicure_service', quantity: 1 },
    ]);
    expect(quote).toMatchObject({ totalPriceCents: 2800, totalDurationMin: 51 });

    const saved = await saveMerchantStyleDraftAction({
      styleId: draft.id,
      title: 'Reviewed upload',
      description: '法式渐变美甲',
      selections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    });
    expect(saved).toMatchObject({ status: 'needs_review', previewPriceCents: 2800 });

    const published = await publishMerchantStyleAction({
      styleId: draft.id,
      title: 'Reviewed upload',
      description: '法式渐变美甲',
      selections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    });
    expect(published.status).toBe('published');
    expect(published.previewPriceCents).toBe(2800); // derived, not supplied

    expect(await archiveMerchantStyleAction(draft.id)).toMatchObject({ status: 'archived' });
  });

  it('lists every billable item needed for price/time review, including items without a default price', async () => {
    const catalog = await listConfigurableCatalogAction();
    expect(catalog.find((item) => item.id === 'jelly_translucent')).toMatchObject({
      id: 'jelly_translucent',
      defaultPricingUnit: 'included',
      durationMin: 15,
      affectsDuration: true,
    });
    expect(catalog.find((item) => item.id === 'cat_eye')).toMatchObject({
      id: 'cat_eye',
      defaultPricingUnit: 'per_set',
      quantityLocked: true,
    });
  });
});
