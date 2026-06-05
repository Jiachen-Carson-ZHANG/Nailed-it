import { NextResponse } from 'next/server';
import { BreakdownError, runGlossaryBreakdown } from '@/nail-ai/breakdown';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const result = await runGlossaryBreakdown(body.imageBase64, body.mimeType, body.merchantSettings);

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
  merchantSettings: GlossaryEntrySettings[];
};

function parseRequestBody(value: unknown): BreakdownRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
  const merchantSettings = Array.isArray(body.merchantSettings)
    ? (body.merchantSettings as GlossaryEntrySettings[])
    : [];

  if (!imageBase64) throw new Error('imageBase64 is required.');
  if (!supportedMimeTypes.has(mimeType)) throw new Error('Supported image types are PNG, JPEG, WEBP, HEIC, and HEIF.');

  return { imageBase64, mimeType, merchantSettings };
}
