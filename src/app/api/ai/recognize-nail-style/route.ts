import { NextResponse } from 'next/server';
import {
  NailRecognitionError,
  recognizeNailImageWithTelemetry,
  type NailImageRecognitionInput
} from '@/nail-ai/nail-recognition';
import { getDefaultLanguage, isAppLanguage } from '@/i18n/storage';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const input = parseRequestBody(await request.json());
    const result = await recognizeNailImageWithTelemetry(input);
    return NextResponse.json({ recognition: result.recognition });
  } catch (error) {
    if (error instanceof NailRecognitionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'missing_vision_config' ? 500 : 502 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid recognition request.',
        code: 'invalid_recognition_request'
      },
      { status: 400 }
    );
  }
}

function parseRequestBody(value: unknown): NailImageRecognitionInput {
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
