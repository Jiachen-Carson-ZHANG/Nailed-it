import { NextResponse } from 'next/server';
import { BreakdownError, runGlossaryBreakdown } from '@/nail-ai/breakdown';
import { getDefaultLanguage, isAppLanguage } from '@/i18n/storage';
import { getRepositories } from '@/lib/repositories';
import { createMerchantPricingService } from '@/lib/services/merchant-pricing-service';
import { createQuoteService } from '@/lib/services/quote-service';
import { demoMerchantId } from '@/mock/merchants';
import { recognizeStyleName } from '@/nail-ai/style-config-recognition';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const repos = getRepositories();
    const merchantSettings = await createMerchantPricingService(repos).listSettings(demoMerchantId);
    const suggestedStyleNamePromise = recognizeStyleName(body.imageBase64, body.mimeType, body.language)
      .catch((nameError) => {
        console.warn('[ai-breakdown] style naming failed; returning breakdown without name', nameError);
        return undefined;
      });
    const result = await runGlossaryBreakdown(body.imageBase64, body.mimeType, merchantSettings, body.language);
    const suggestedStyleName = await suggestedStyleNamePromise;
    const quote = await createQuoteService(repos).buildQuote({
      merchantId: demoMerchantId,
      selections: result.catalogSelections,
    });

    return NextResponse.json({
      ...result,
      suggestedStyleName,
      totalPrice: quote.totalPriceCents / 100,
      totalDuration: quote.totalDurationMin,
    });
  } catch (error) {
    if (error instanceof BreakdownError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'missing_config' ? 500 : 502 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid breakdown request.', code: 'invalid_request' },
      { status: 400 }
    );
  }
}

type BreakdownRequest = {
  imageBase64: string;
  language: 'zh-CN' | 'en';
  mimeType: string;
};

function parseRequestBody(value: unknown): BreakdownRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const language = typeof body.language === 'string' && isAppLanguage(body.language)
    ? body.language
    : getDefaultLanguage();
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
  if (!imageBase64) throw new Error('imageBase64 is required.');
  if (!supportedMimeTypes.has(mimeType)) throw new Error('Supported image types are PNG, JPEG, WEBP, HEIC, and HEIF.');

  return { imageBase64, language, mimeType };
}
