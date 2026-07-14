import 'server-only';
import { postImageGeneration } from './openrouter';

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const defaultCollageGenModel = 'doubao-seedream-5.0-litenew';

export type CollageIngredient = {
  category: string;
  label: string;
};

// Initial = strict text-to-image; regen = image-to-image refinement of a reference,
// changing only the listed categories (English labels, e.g. 'nail art', 'decoration').
export type CollageGenMode =
  | { kind: 'initial' }
  | { kind: 'regen'; changedCategories: string[] };

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
  mode: CollageGenMode = { kind: 'initial' },
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

  if (mode.kind === 'regen') {
    // Image-to-image refinement: the reference image is passed alongside this prompt.
    // Keep everything identical except the explicitly-changed categories.
    const changed = mode.changedCategories.length > 0
      ? mode.changedCategories.join(', ')
      : 'the requested elements';
    return (
      `A close-up product-style photo of beautiful nail art on a woman's hand. ` +
      `This is a refinement of the provided reference image. ` +
      `Keep the overall composition, hand pose, lighting, and nail style IDENTICAL to the reference image. ` +
      `While keeping the hand pose from the reference, ensure the hand still clearly shows exactly five fingers (thumb, index, middle, ring, and pinky) with all five nails visible. ` +
      `Keep every fingernail's full design and fine details clearly visible and in sharp focus, as front-facing as the reference pose allows. ` +
      `ONLY change the following aspect(s): ${changed}. ` +
      `The updated design should be — ${description}. ` +
      `Leave every other element exactly as it appears in the reference image. ` +
      `Soft studio lighting, blurred pastel background, ultra-realistic, 8K, highly detailed nails. ` +
      `No text, no watermark.`
    );
  }

  // Initial generation: render strictly and only what the user selected.
  return (
    `A close-up product-style photo of beautiful nail art on a woman's hand. ` +
    `The hand MUST show exactly five fingers (thumb, index, middle, ring, and pinky), with all five nails fully visible. Never render more or fewer than five fingers. ` +
    `Pose the hand so that all five nails face the camera as front-on as possible — each fingernail should be clearly and fully visible with its complete design and fine details, not foreshortened, tilted away, or hidden behind other fingers. ` +
    `Nail design: ${description}. ` +
    `Render EXACTLY and ONLY the nail design elements listed above. ` +
    `Do NOT invent, add, or embellish with any extra decorations, charms, patterns, glitter, or nail art that is not explicitly listed. ` +
    `If the nail shape is unspecified, use a natural round shape; if the base color is unspecified, use a nude tone; do not add any other unrequested elements. ` +
    `Soft studio lighting, blurred pastel background, ultra-realistic, 8K, highly detailed nails. ` +
    `No text, no watermark.`
  );
}

export async function runCollageGen(
  ingredients: CollageIngredient[],
  customText: string,
  opts: { referenceImage?: { base64: string; mimeType: string }; mode?: CollageGenMode } = {},
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
  const prompt = buildNailPrompt(ingredients, customText, opts.mode ?? { kind: 'initial' });

  try {
    const imageBase64 = await postImageGeneration({
      arkApiKey,
      arkBaseUrl: baseUrl,
      arkModel,
      prompt,
      images: opts.referenceImage ? [opts.referenceImage] : [],
    });
    return { imageBase64, mimeType: 'image/png' };
  } catch (error) {
    throw new CollageGenError('provider_error', 'Collage generation request failed.', { cause: error });
  }
}
