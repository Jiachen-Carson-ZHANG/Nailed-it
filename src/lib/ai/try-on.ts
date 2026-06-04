import type { TryOnResult } from '@/domain/nail';
import { postOpenRouterChat, asRecord } from './openrouter';

export const defaultTryOnModel = 'google/gemini-3.1-flash-image-preview';

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
  'Apply the nail style shown in the second image (nail style) to the nails in the first image (your hand). ' +
  'Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. ' +
  'Only change the nail appearance.' +
  'Pay attention to which nail matches which finger, and make sure the matchings are the same as in the second image.';


export async function runTryOn(
  handImageBase64: string,
  handMimeType: string,
  styleImageBase64: string,
  styleMimeType: string,
  env = process.env
): Promise<TryOnResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new TryOnError('missing_config', 'OPENROUTER_API_KEY is required for try-on.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;

  let data: unknown;
  try {
    data = await postOpenRouterChat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${handMimeType};base64,${handImageBase64}` } },
              { type: 'image_url', image_url: { url: `data:${styleMimeType};base64,${styleImageBase64}` } },
              { type: 'text', text: tryOnPrompt }
            ]
          }
        ],
        modalities: ['image', 'text']
      },
      apiKey
    );
  } catch (error) {
    throw new TryOnError('provider_error', 'OpenRouter try-on request failed.', { cause: error });
  }

  return extractImageFromResponse(data);
}

function extractImageFromResponse(data: unknown): TryOnResult {
  const record = asRecord(data);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message = asRecord(asRecord(choices[0]).message);
  const images = Array.isArray(message.images) ? message.images : [];

  if (images.length > 0) {
    const dataUrl = String(asRecord(asRecord(images[0]).image_url).url ?? '');
    if (dataUrl.includes(',')) {
      const [header, base64] = dataUrl.split(',', 2);
      const mimeType = header.includes('jpeg') ? 'image/jpeg' : 'image/png';
      return { imageBase64: base64, mimeType };
    }
  }

  throw new TryOnError('invalid_model_output', 'OpenRouter try-on response did not include an image.');
}
