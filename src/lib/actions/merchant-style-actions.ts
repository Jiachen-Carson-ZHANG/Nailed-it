'use server';

import type { MerchantStyleView, PublishedMerchantStyle } from '@/domain/merchant-style';
import { getRepositories } from '@/lib/repositories';
import { createMerchantStyleService } from '@/lib/services/merchant-style-service';
import { getStyleMediaStorage } from '@/lib/storage';
import { demoMerchantId } from '@/mock/merchants';

function getService() {
  return createMerchantStyleService(getRepositories().merchantStyles, getStyleMediaStorage());
}

export type PublishMerchantStyleActionInput = {
  styleId: string;
  title: string;
  previewPriceCents: number;
  previewDurationMin: number;
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

export async function uploadMerchantStyleAction(formData: FormData): Promise<MerchantStyleView> {
  const title = String(formData.get('title') ?? '');
  const image = formData.get('image');
  if (!(image instanceof File)) throw new Error('style_image_required');
  return getService().upload({
    merchantId: demoMerchantId,
    title,
    mimeType: image.type,
    bytes: new Uint8Array(await image.arrayBuffer()),
  });
}

export async function publishMerchantStyleAction(
  input: PublishMerchantStyleActionInput,
): Promise<MerchantStyleView> {
  return getService().publish({ ...input, merchantId: demoMerchantId });
}

export async function archiveMerchantStyleAction(styleId: string): Promise<MerchantStyleView | null> {
  return getService().archive(demoMerchantId, styleId);
}
