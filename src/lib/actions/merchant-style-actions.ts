'use server';

import type { CatalogSelection, PricingUnit } from '@/domain/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
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

export type SaveMerchantStyleDraftActionInput = PublishMerchantStyleActionInput;

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

export async function getMerchantStyleReviewAction(
  styleId: string,
): Promise<MerchantStyleView | null> {
  return getService().getMerchant(demoMerchantId, styleId);
}

export type ConfigurableCatalogItem = {
  id: string;
  nameZh: string;
  defaultPricingUnit: PricingUnit;
  pricingUnit: PricingUnit;
  priceCents: number;
  durationMin: number;
  enabled: boolean;
  affectsDuration: boolean;
  quantityLocked: boolean;
};

/** Every billable item relevant to merchant review; unavailable items stay visible but disabled. */
export async function listConfigurableCatalogAction(): Promise<ConfigurableCatalogItem[]> {
  const repos = getRepositories();
  const [catalog, merchantPricing] = await Promise.all([
    repos.catalog.list(),
    repos.merchantPricing.listByMerchant(demoMerchantId),
  ]);
  const effectiveById = new Map(
    resolveEffectivePricing(catalog, merchantPricing).map((row) => [row.catalogItemId, row]),
  );
  return catalog
    .filter((item) => item.billable !== 'no')
    .map((item) => {
      const effective = effectiveById.get(item.id);
      const pricingUnit = effective?.pricingUnit ?? item.defaultPricingUnit;
      return {
        id: item.id,
        nameZh: item.nameZh,
        defaultPricingUnit: item.defaultPricingUnit,
        pricingUnit,
        priceCents: effective?.priceCents ?? 0,
        durationMin: effective?.durationMin ?? 0,
        enabled: effective?.enabled ?? false,
        affectsDuration: item.affectsBookingDuration !== 'no',
        quantityLocked: pricingUnit === 'per_set',
      };
    });
}

export async function uploadMerchantStyleAction(formData: FormData): Promise<MerchantStyleView> {
  const image = formData.get('image');
  if (!(image instanceof File)) throw new Error('style_image_required');
  const bytes = new Uint8Array(await image.arrayBuffer());
  return getService().upload({
    merchantId: demoMerchantId,
    title: 'Untitled design',
    mimeType: image.type,
    bytes,
  });
}

export async function analyzeMerchantStyleAction(styleId: string): Promise<MerchantStyleView> {
  const repos = getRepositories();
  const service = getService();
  const record = await repos.merchantStyles.getByIdForMerchant(styleId, demoMerchantId);
  if (!record) throw new Error('merchant_style_not_found');
  if (record.status !== 'processing') {
    const current = await service.getMerchant(demoMerchantId, styleId);
    if (!current) throw new Error('merchant_style_not_found');
    return current;
  }
  const claimed = await repos.merchantStyles.claimAnalysis(styleId, demoMerchantId);
  if (!claimed) {
    const current = await service.getMerchant(demoMerchantId, styleId);
    if (!current) throw new Error('merchant_style_not_found');
    return current;
  }

  try {
    const bytes = await getStyleMediaStorage().downloadOriginal(
      record.media.originalBucket,
      record.media.originalPath,
    );
    const settings = await createMerchantPricingService(repos).listSettings(demoMerchantId);
    const ai = await recognizeStyleConfig(
      Buffer.from(bytes).toString('base64'),
      record.media.mimeType,
      settings,
    );
    const configured = await service.completeAnalysis({
      merchantId: demoMerchantId,
      styleId,
      name: ai.name,
      description: ai.description,
      discoveryFacets: ai.discoveryFacets,
      selections: ai.catalogSelections,
    });
    if (configured) return configured;
  } catch (error) {
    console.error('[merchant-style] stored-image analysis failed; opened manual review', error);
    try {
      const fallback = await service.failAnalysis(demoMerchantId, styleId);
      if (fallback) return fallback;
    } catch (transitionError) {
      console.error('[merchant-style] analysis fallback transition failed', transitionError);
    }
  }

  const current = await service.getMerchant(demoMerchantId, styleId);
  if (!current) throw new Error('merchant_style_not_found');
  return current;
}

export async function previewMerchantStyleQuoteAction(selections: CatalogSelection[]) {
  return createQuoteService(getRepositories()).buildQuote({
    merchantId: demoMerchantId,
    selections,
  });
}

export async function saveMerchantStyleDraftAction(
  input: SaveMerchantStyleDraftActionInput,
): Promise<MerchantStyleView> {
  return getService().saveDraft({ ...input, merchantId: demoMerchantId });
}

export async function publishMerchantStyleAction(
  input: PublishMerchantStyleActionInput,
): Promise<MerchantStyleView> {
  return getService().publish({ ...input, merchantId: demoMerchantId });
}

export async function archiveMerchantStyleAction(styleId: string): Promise<MerchantStyleView | null> {
  return getService().archive(demoMerchantId, styleId);
}
