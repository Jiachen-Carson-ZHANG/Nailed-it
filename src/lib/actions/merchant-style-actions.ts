'use server';

import type { CatalogSelection, PricingUnit } from '@/domain/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import type { MerchantStyleView, PublishedMerchantStyle } from '@/domain/merchant-style';
import { getRepositories } from '@/lib/repositories';
import { createMerchantStyleService } from '@/lib/services/merchant-style-service';
import { createMerchantPricingService } from '@/lib/services/merchant-pricing-service';
import { createQuoteService } from '@/lib/services/quote-service';
import { recognizeStyleConfig } from '@/nail-ai/style-config-recognition';
import { buildStyleConfig } from '@/domain/style-config';
import { catalogItems } from '@/mock/catalog';
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

// The cloned customer editor runs the breakdown client-side, so it needs the original image bytes.
export async function getMerchantStyleImageAction(
  styleId: string,
): Promise<{ base64: string; mimeType: string }> {
  const repos = getRepositories();
  const record = await repos.merchantStyles.getByIdForMerchant(styleId, demoMerchantId);
  if (!record) throw new Error('merchant_style_not_found');
  const bytes = await getStyleMediaStorage().downloadOriginal(
    record.media.originalBucket,
    record.media.originalPath,
  );
  return { base64: Buffer.from(bytes).toString('base64'), mimeType: record.media.mimeType };
}

export type ConfigurableCatalogItem = {
  id: string;
  nameZh: string;
  category: string;
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
    // Drop container service modules (颜色与效果服务 / 美术设计服务 / 卸甲服务 …) — they are grouping
    // parents, not addable line items. The base manicure stays (the selected list renders it by id);
    // it is always pre-selected, so it never shows up in the "Add services" list anyway.
    .filter(
      (item) => item.billable !== 'no'
        && (item.type !== 'service_module' || item.id === 'basic_manicure_service'),
    )
    .map((item) => {
      const effective = effectiveById.get(item.id);
      const pricingUnit = effective?.pricingUnit ?? item.defaultPricingUnit;
      return {
        id: item.id,
        nameZh: item.nameZh,
        category: item.category,
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
  // `File` is not a global in Node 18 (it landed in Node 20), so `image instanceof File` throws
  // "File is not defined" in this runtime and breaks every upload. FormData file entries are
  // Blob-like; guard by excluding the string/empty case instead of referencing the File global.
  const image = formData.get('image');
  if (!image || typeof image === 'string') throw new Error('style_image_required');
  const bytes = new Uint8Array(await image.arrayBuffer());
  return getService().upload({
    merchantId: demoMerchantId,
    title: '',
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

/**
 * Open the draft for manual editing (processing -> needs_review). Idempotent: failAnalysis only
 * transitions a 'processing' upload, so on a re-open or React StrictMode double-invoke the style is
 * already needs_review and failAnalysis throws merchant_style_not_processing — that's fine, it's
 * already open, so fall back to the current view.
 */
export async function configureMerchantStyleManuallyAction(styleId: string): Promise<MerchantStyleView> {
  const service = getService();
  try {
    const opened = await service.failAnalysis(demoMerchantId, styleId);
    if (opened) return opened;
  } catch {
    // Already past 'processing' — fall through to returning the current view.
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

// Descriptive facets (colour / shape / length / finish …) are re-derived from the merchant's selections
// so edits to them persist — buildStyleConfig splits selections into priced breakdown + facets exactly
// like the analyze path, keeping one source of truth.
function deriveDiscoveryFacets(selections: CatalogSelection[]) {
  return buildStyleConfig(
    selections.map((s) => ({ catalogItemId: s.catalogItemId, confidence: 1, quantity: s.quantity })),
    catalogItems,
  ).discoveryFacets;
}

export async function saveMerchantStyleDraftAction(
  input: SaveMerchantStyleDraftActionInput,
): Promise<MerchantStyleView> {
  return getService().saveDraft({
    ...input,
    merchantId: demoMerchantId,
    discoveryFacets: deriveDiscoveryFacets(input.selections),
  });
}

export async function publishMerchantStyleAction(
  input: PublishMerchantStyleActionInput,
): Promise<MerchantStyleView> {
  return getService().publish({
    ...input,
    merchantId: demoMerchantId,
    discoveryFacets: deriveDiscoveryFacets(input.selections),
  });
}

export async function archiveMerchantStyleAction(styleId: string): Promise<MerchantStyleView | null> {
  return getService().archive(demoMerchantId, styleId);
}

/** Hard-delete an unpublished draft (processing / needs_review / failed). */
export async function deleteMerchantStyleAction(styleId: string): Promise<boolean> {
  return getService().deleteDraft(demoMerchantId, styleId);
}
