import 'server-only';
import { postImageGeneration } from './openrouter';

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const defaultCollageGenModel = 'doubao-seedream-5.0-litenew';

export type CollageIngredient = {
  category: string;
  label: string;
};

export type CollageGenResult = {
  imageBase64: string;
  mimeType: 'image/png';
};

export class CollageGenError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CollageGenError';
  }
}

const CATEGORY_EN: Record<string, string> = {
  structure:    'nail structure',
  color_effect: 'color effect',
  art:          'nail art',
  decoration:   'decoration',
  nail_shape:   'nail shape',
  nail_length:  'nail length',
  color:        'base color',
  texture:      'texture',
  style:        'style',
  custom:       'custom element',
};

export function buildNailPrompt(
  ingredients: CollageIngredient[],
  customText: string,
): string {
  const lines: string[] = [];

  // Group by category for a structured description
  const byCategory = new Map<string, string[]>();
  for (const ing of ingredients) {
    const cat = CATEGORY_EN[ing.category] ?? ing.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(ing.label);
  }

  for (const [cat, labels] of byCategory) {
    lines.push(`${cat}: ${labels.join(', ')}`);
  }

  if (customText.trim()) {
    lines.push(`additional user request: ${customText.trim()}`);
  }

  const description = lines.join('; ');

  // TODO: Add guardrails in user request
  return (
    `A close-up product-style photo of beautiful nail art on a woman's hand. ` +
    `Nail design: ${description}. ` +
    `Soft studio lighting, blurred pastel background, ultra-realistic, 8K, highly detailed nails. ` +
    `No text, no watermark.`
  );
}

export async function runCollageGen(
  ingredients: CollageIngredient[],
  customText: string,
  env = process.env,
): Promise<CollageGenResult> {
  // Gemini via OpenRouter is used when OPENROUTER_API_KEY + GEMINI_IMAGE_MODEL_NAME are set in env.
  // ARK_API_KEY + ARK_IMAGE_MODEL are only used as fallback when OpenRouter is not available.
  const arkApiKey = env.ARK_API_KEY ?? '';
  if (!env.OPENROUTER_API_KEY && !arkApiKey) {
    throw new CollageGenError('missing_config', 'Either OPENROUTER_API_KEY or ARK_API_KEY is required.');
  }

  const arkModel = env.ARK_IMAGE_MODEL ?? defaultCollageGenModel;
  const baseUrl = env.ARK_BASE_URL ?? DEFAULT_ARK_BASE_URL;
  const prompt = buildNailPrompt(ingredients, customText);

  try {
    const imageBase64 = await postImageGeneration({
      arkApiKey,
      arkBaseUrl: baseUrl,
      arkModel,
      prompt,
      images: [],
    });
    return { imageBase64, mimeType: 'image/png' };
  } catch (error) {
    throw new CollageGenError('provider_error', 'Collage generation request failed.', { cause: error });
  }
}
