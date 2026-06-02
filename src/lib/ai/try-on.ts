import type { TryOnResult } from '@/domain/nail';
import { asRecord, parseGeminiUsageMetadata } from './usage-cost';
import { defaultGeminiImageModel } from './trending-styles';

const geminiGenerateContentBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

export class TryOnError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TryOnError';
  }
}

const tryOnPrompt =
  'Apply the nail style shown in the second image to the nails in the first image. ' +
  'Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. ' +
  'Only change the nail appearance.';

export async function runTryOn(
  handImageBase64: string,
  handMimeType: string,
  styleImageBase64: string,
  styleMimeType: string,
  env = process.env
): Promise<TryOnResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new TryOnError('missing_config', 'GEMINI_API_KEY is required for try-on.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultGeminiImageModel;

  const response = await fetch(`${geminiGenerateContentBaseUrl}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: handMimeType, data: handImageBase64 } },
            { inline_data: { mime_type: styleMimeType, data: styleImageBase64 } },
            { text: tryOnPrompt }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT']
      }
    })
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new TryOnError(
      'provider_error',
      `Gemini try-on request failed with status ${response.status}.`,
      { cause: responseJson }
    );
  }

  parseGeminiUsageMetadata(responseJson);
  return extractImageFromResponse(responseJson);
}

function extractImageFromResponse(responseJson: unknown): TryOnResult {
  const record = asRecord(responseJson);
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate).content);
    const parts = Array.isArray(content.parts) ? content.parts : [];

    for (const part of parts) {
      const partRecord = asRecord(part);
      // Gemini response uses camelCase inlineData; request uses snake_case inline_data
      const inlineData = asRecord(partRecord.inlineData ?? partRecord.inline_data);
      const mimeType = inlineData.mimeType;
      const data = inlineData.data;

      if (typeof data === 'string' && data.length > 0) {
        const resolvedMime =
          mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        return {
          imageBase64: data,
          mimeType: resolvedMime
        };
      }
    }
  }

  throw new TryOnError('invalid_model_output', 'Gemini try-on response did not include an image.');
}
