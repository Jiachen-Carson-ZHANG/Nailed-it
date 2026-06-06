'use server';

import type { CatalogSelection } from '@/domain/catalog';
import type { MerchantStyleView, PublishedMerchantStyle } from '@/domain/merchant-style';
import { getRepositories } from '@/lib/repositories';
import { createMerchantStyleService } from '@/lib/services/merchant-style-service';
import { createMerchantPricingService } from '@/lib/services/merchant-pricing-service';
import { createQuoteService } from '@/lib/services/quote-service';
import { recognizeStyleConfig } from '@/nail-ai/style-config-recognition';
import { getStyleMediaStorage } from '@/lib/storage';
import { demoMerchantId } from '@/mock/merchants';

function getService() {
  const repos = getRepositories();
  return createMerchantStyleService(repos.merchantStyles, getStyleMediaStorage(), createQuoteService(repos));
}

export type PublishMerchantStyleActionInput = {
  styleId: string;
  title: string;
  description: string;
  selections: CatalogSelection[];
};

export async function listCustomerPublishedStylesAction(): Promise<PublishedMerchantStyle[]> {
  return getService().listPublished();
}

export async function getCustomerPublishedStyleAction(
  styleId: string,
): Promise<PublishedMerchantStyle | null> {
  return getService().getPublished(styleId);
}

export async function listMerchantStylesAction(): Promise<MerchantStyleView[]> {
  return getService().listMerchant(demoMerchantId);
}

export type ConfigurableCatalogItem = {
  id: string;
  nameZh: string;
  defaultPricingUnit: string;
};

/** Priced billable catalog items the merchant can put in a style breakdown (price is derived). */
export async function listConfigurableCatalogAction(): Promise<ConfigurableCatalogItem[]> {
  const catalog = await getRepositories().catalog.list();
  return catalog
    .filter((item) => item.billable !== 'no' && item.defaultPriceCents !== null)
    .map((item) => ({ id: item.id, nameZh: item.nameZh, defaultPricingUnit: item.defaultPricingUnit }));
}

export async function uploadMerchantStyleAction(formData: FormData): Promise<MerchantStyleView> {
  const title = String(formData.get('title') ?? '');
  const image = formData.get('image');
  if (!(image instanceof File)) throw new Error('style_image_required');
  const bytes = new Uint8Array(await image.arrayBuffer());
  const view = await getService().upload({
    merchantId: demoMerchantId,
    title,
    mimeType: image.type,
    bytes,
  });

  // AI suggests the breakdown + name by default; the merchant edits anything wrong before publishing.
  // Best-effort: if recognition fails (no key, model error, nothing priceable), the draft stays in
  // needs_review for manual configuration rather than failing the upload.
  try {
    const repos = getRepositories();
    const settings = await createMerchantPricingService(repos).listSettings(demoMerchantId);
    const ai = await recognizeStyleConfig(
      Buffer.from(bytes).toString('base64'),
      image.type,
      settings,
    );
    const configured = await getService().applyConfig({
      merchantId: demoMerchantId,
      styleId: view.id,
      name: ai.name,
      description: ai.description,
      discoveryFacets: ai.discoveryFacets,
      selections: ai.catalogSelections,
    });
    if (configured) return configured;
  } catch (error) {
    console.error('[merchant-style] AI auto-config failed; left for manual review', error);
  }
  return view;
}

export async function publishMerchantStyleAction(
  input: PublishMerchantStyleActionInput,
): Promise<MerchantStyleView> {
  return getService().publish({ ...input, merchantId: demoMerchantId });
}

export async function archiveMerchantStyleAction(styleId: string): Promise<MerchantStyleView | null> {
  return getService().archive(demoMerchantId, styleId);
}
