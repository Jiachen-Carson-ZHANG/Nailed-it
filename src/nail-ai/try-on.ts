import type { TryOnResult } from '@/domain/nail';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';

export const defaultTryOnModel = 'google/gemini-3.1-flash-image-preview';

export class TryOnError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output' | 'invalid_input',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TryOnError';
  }
}

const validationPrompt =
  'You are validating two images for a nail salon virtual try-on app.\n' +
  'Image 1 should be a photo of one or more human hands with visible fingers and nails.\n' +
  'Image 2 should be a nail art / nail style reference photo.\n\n' +
  'Return ONLY valid JSON (no markdown fences) in exactly this shape:\n' +
  '{"handValid":true,"styleValid":true}\n' +
  'or, if either image is invalid, include the corresponding error field in Chinese:\n' +
  '{"handValid":false,"handError":"原因","styleValid":true}\n\n' +
  'Rules:\n' +
  '- handValid=true: Image 1 contains at least one human hand with visible fingers/nails.\n' +
  '- handValid=false: Image 1 is NOT a hand photo (e.g. food, scenery, object, face without hands).\n' +
  '- styleValid=true: Image 2 is a nail art or nail design reference photo.\n' +
  '- styleValid=false: Image 2 does NOT include nail art.\n' +
  'Output only the JSON object, nothing else.';

const tryOnPrompt =
  'Apply the nail style shown in the second image (nail style) to the nails in the first image (your hand). ' +
  'Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. ' +
  'Only change the nail appearance. ' +
  'Pay attention to which nail matches which finger and keep the same finger-to-nail matching as the second image. ' +
  'ADDITIONAL RULES: ' +
  '(1) If any nails are missing or obscured in the hand photo, fill those nail positions with the closest natural nude color matching the person\'s skin tone — do not leave any finger without a nail. ' +
  '(2) If the hand photo contains hands from multiple different people, focus on the hand where the fingers and nails are most clearly visible. If it is one person\'s two hands shown together, treat them normally.' +
  '(3) If the the nail photo involves more hands than the hand photo, do not add additional hands to the hand photo to for try-on effect';


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

  // ── Step 1: validate both images before running the expensive generation ──────
  await validateImages({ apiKey, model, handImageBase64, handMimeType, styleImageBase64, styleMimeType });

  // ── Step 2: run the actual try-on ─────────────────────────────────────────────
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

async function validateImages(opts: {
  apiKey: string;
  model: string;
  handImageBase64: string;
  handMimeType: string;
  styleImageBase64: string;
  styleMimeType: string;
}): Promise<void> {
  let raw: unknown;
  try {
    raw = await postOpenRouterChat(
      {
        model: opts.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${opts.handMimeType};base64,${opts.handImageBase64}` } },
              { type: 'image_url', image_url: { url: `data:${opts.styleMimeType};base64,${opts.styleImageBase64}` } },
              { type: 'text', text: validationPrompt }
            ]
          }
        ]
      },
      opts.apiKey
    );
  } catch (error) {
    throw new TryOnError('provider_error', 'OpenRouter validation request failed.', { cause: error });
  }

  let result: Record<string, unknown>;
  try {
    const text = extractTextContent(raw);
    result = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
  } catch {
    // If validation response is unparseable, skip — don't block the try-on
    return;
  }

  const handError = result.handValid === false
    ? (typeof result.handError === 'string' ? result.handError : '请上传一张清晰的手部照片，确保手指和指甲可见。')
    : null;
  const styleError = result.styleValid === false
    ? (typeof result.styleError === 'string' ? result.styleError : '请上传一张美甲参考照片。')
    : null;
  const combined = [handError, styleError].filter(Boolean).join(' | ');
  if (combined) throw new TryOnError('invalid_input', combined);
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
