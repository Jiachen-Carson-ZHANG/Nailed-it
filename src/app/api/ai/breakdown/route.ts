import { NextResponse } from 'next/server';
import { BreakdownError, runFreeBreakdown, runStandardBreakdown } from '@/lib/ai/breakdown';
import { defaultPricingRules } from '@/mock/pricing';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const result = body.freeMode
      ? await runFreeBreakdown(body.imageBase64, body.mimeType)
      : await runStandardBreakdown(body.imageBase64, body.mimeType, defaultPricingRules);

    return NextResponse.json(result);
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
  mimeType: string;
  freeMode: boolean;
};

function parseRequestBody(value: unknown): BreakdownRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
  const freeMode = body.freeMode === true;

  if (!imageBase64) throw new Error('imageBase64 is required.');
  if (!supportedMimeTypes.has(mimeType)) throw new Error('Supported image types are PNG, JPEG, WEBP, HEIC, and HEIF.');

  return { imageBase64, mimeType, freeMode };
}
