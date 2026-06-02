import { NextResponse } from 'next/server';
import { TryOnError, runTryOn } from '@/lib/ai/try-on';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const result = await runTryOn(
      body.handImageBase64,
      body.handMimeType,
      body.styleImageBase64,
      body.styleMimeType
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TryOnError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'missing_config' ? 500 : 502 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid try-on request.', code: 'invalid_request' },
      { status: 400 }
    );
  }
}

type TryOnRequest = {
  handImageBase64: string;
  handMimeType: string;
  styleImageBase64: string;
  styleMimeType: string;
};

function parseRequestBody(value: unknown): TryOnRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const handImageBase64 = typeof body.handImageBase64 === 'string' ? body.handImageBase64.trim() : '';
  const handMimeType = typeof body.handMimeType === 'string' ? body.handMimeType.trim() : '';
  const styleImageBase64 = typeof body.styleImageBase64 === 'string' ? body.styleImageBase64.trim() : '';
  const styleMimeType = typeof body.styleMimeType === 'string' ? body.styleMimeType.trim() : '';

  if (!handImageBase64) throw new Error('handImageBase64 is required.');
  if (!supportedMimeTypes.has(handMimeType)) throw new Error('handMimeType must be PNG, JPEG, WEBP, HEIC, or HEIF.');
  if (!styleImageBase64) throw new Error('styleImageBase64 is required.');
  if (!supportedMimeTypes.has(styleMimeType)) throw new Error('styleMimeType must be PNG, JPEG, WEBP, HEIC, or HEIF.');

  return { handImageBase64, handMimeType, styleImageBase64, styleMimeType };
}
