import type { TryOnResult } from '@/domain/nail';
import { postOpenRouterChat, postImageGeneration, extractTextContent, stripJsonFence, asRecord } from './openrouter';

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export const defaultTryOnModel = 'doubao-seedream-5.0-litenew';
export const defaultTryOnValidationModel = 'doubao-seed-2-0-lite-260215';

export class TryOnError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output' | 'invalid_input' | 'invalid_comment',
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
  'If the user provided a customisation comment (passed separately as text), also validate it:\n' +
  '- Add "commentValid": true if the comment is about nail appearance (shape, length, color, finish, art style, etc.).\n' +
  '- Add "commentValid": false and "commentError": "<brief reason in the same language as the comment>" if the comment is unrelated to nails.\n' +
  '- Omit commentValid and commentError entirely if no comment was provided.\n' +
  'Output only the JSON object, nothing else.';

const tryOnPrompt =
  'Apply the nail style shown in the second image (nail style) to the nails in the first image (your hand). ' +
  'Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. ' +
  'Only change the nail appearance. ' +
  'FINGER MAPPING (critical): Identify which nail in the style reference belongs to which finger, then map each design onto the ANATOMICALLY CORRESPONDING finger of the hand in image 1 — thumb→thumb, index→index, middle→middle, ring→ring, pinky→pinky. Do NOT copy nails by their top-to-bottom screen order. If the style reference is photographed upside-down or rotated relative to the hand, mentally orient it upright first, then match finger by finger. If the style reference shows two hands but image 1 shows only one, use the per-finger design from only ONE hand in the reference (the one whose orientation best matches image 1); never merge nails from two different reference hands onto a single hand. ' +
  'ADDITIONAL RULES: ' +
  '(1) If any nails are missing or obscured in the hand photo, fill those nail positions with the closest natural nude color matching the person\'s skin tone — do not leave any finger without a nail. ' +
  '(2) If the hand photo contains hands from multiple different people, focus on the hand where the fingers and nails are most clearly visible. If it is one person\'s two hands shown together, treat them normally.' +
  '(3) If the the nail photo involves more hands than the hand photo, do not add additional hands to the hand photo to for try-on effect';


export async function runTryOn(
  handImageBase64: string,
  handMimeType: string,
  styleImageBase64: string,
  styleMimeType: string,
  userComment = '',
  env = process.env
): Promise<TryOnResult> {
  const arkApiKey = env.ARK_API_KEY;
  const openrouterKey = env.OPENROUTER_API_KEY;
  if (!openrouterKey && !arkApiKey) {
    throw new TryOnError('missing_config', 'Either OPENROUTER_API_KEY or ARK_API_KEY is required for try-on.');
  }

  // These are Ark fallback model names only.
  // When OPENROUTER_API_KEY + GEMINI_IMAGE_MODEL_NAME are both set in env,
  // postOpenRouterChat and postImageGeneration will IGNORE these and use Gemini via OpenRouter instead.
  const arkValidationModel = env.ARK_VISION_MODEL ?? defaultTryOnValidationModel;
  const arkGenerationModel = env.ARK_IMAGE_MODEL ?? defaultTryOnModel;
  const baseUrl = env.ARK_BASE_URL ?? DEFAULT_ARK_BASE_URL;

  // ── Step 1: validate both images ──────────────────────────────────────────────
  // Routes to Gemini (OpenRouter) if OPENROUTER_API_KEY+GEMINI_IMAGE_MODEL_NAME set, else Ark.
  await validateImages({ apiKey: arkApiKey ?? '', model: arkValidationModel, handImageBase64, handMimeType, styleImageBase64, styleMimeType, userComment });

  // ── Step 2: generate the try-on image ─────────────────────────────────────────
  // Routes to Gemini (OpenRouter) if OPENROUTER_API_KEY+GEMINI_IMAGE_MODEL_NAME set, else Ark.
  const prompt = userComment
    ? 'Apply nail art to the hand in image 1. ' +
      `The user has made the following specific requests — these take PRIORITY over the reference image for the aspects they mention: "${userComment}". ` +
      'Then, strictly apply image 2 (nail style reference) for aspects NOT covered by the user\'s request. ' +
      'FINGER MAPPING (critical): When applying image 2 for aspects not covered by the user\'s request, identify which nail in the style reference belongs to which finger, then map each design onto the ANATOMICALLY CORRESPONDING finger of the hand in image 1 — thumb→thumb, index→index, middle→middle, ring→ring, pinky→pinky. Do NOT copy nails by their top-to-bottom screen order. If the style reference is photographed upside-down or rotated relative to the hand, mentally orient it upright first, then match finger by finger. If the style reference shows two hands but image 1 shows only one, use the per-finger design from only ONE hand in the reference (the one whose orientation best matches image 1); never merge nails from two different reference hands onto a single hand. ' +
      'Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. Only change the nail appearance. ' +
      'ADDITIONAL RULES: ' +
      '(1) If any nails are missing or obscured in the hand photo, fill those nail positions with the closest natural nude color matching the person\'s skin tone — do not leave any finger without a nail. ' +
      '(2) If the hand photo contains hands from multiple different people, focus on the hand where the fingers and nails are most clearly visible. If it is one person\'s two hands shown together, treat them normally. ' +
      '(3) If the nail photo involves more hands than the hand photo, do not add additional hands to the hand photo for the try-on effect.'
    : tryOnPrompt;

  let imageBase64: string;
  try {
    imageBase64 = await postImageGeneration({
      arkApiKey: arkApiKey ?? '',
      arkBaseUrl: baseUrl,
      arkModel: arkGenerationModel,
      prompt,
      images: [
        { base64: handImageBase64, mimeType: handMimeType },
        { base64: styleImageBase64, mimeType: styleMimeType },
      ],
    });
  } catch (error) {
    throw new TryOnError('provider_error', 'Try-on image generation request failed.', { cause: error });
  }

  return { imageBase64, mimeType: 'image/png' };
}

async function validateImages(opts: {
  apiKey: string;
  model: string;
  handImageBase64: string;
  handMimeType: string;
  styleImageBase64: string;
  styleMimeType: string;
  userComment?: string;
}): Promise<void> {
  const commentText = opts.userComment ? `\n\nUser customisation comment: "${opts.userComment}"` : '';
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
              { type: 'text', text: validationPrompt + commentText }
            ]
          }
        ]
      },
      opts.apiKey
    );
  } catch (error) {
    throw new TryOnError('provider_error', 'Ark validation request failed.', { cause: error });
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

  if (result.commentValid === false) {
    const msg = typeof result.commentError === 'string' ? result.commentError : '请输入与美甲相关的内容。';
    throw new TryOnError('invalid_comment', msg);
  }
}

export { }
