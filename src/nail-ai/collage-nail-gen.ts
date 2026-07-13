import 'server-only';

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
  const apiKey = env.ARK_API_KEY;
  if (!apiKey) throw new CollageGenError('missing_config', 'ARK_API_KEY is required.');

  const model = env.ARK_IMAGE_MODEL ?? defaultCollageGenModel;
  const baseUrl = env.ARK_BASE_URL ?? DEFAULT_ARK_BASE_URL;
  const prompt = buildNailPrompt(ingredients, customText);

  let data: unknown;
  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        response_format: 'b64_json',
        watermark: false,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(`Ark image generation error ${response.status}: ${JSON.stringify(json)}`);
    }
    data = json;
  } catch (error) {
    throw new CollageGenError('provider_error', 'Ark collage generation request failed.', { cause: error });
  }

  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const items = Array.isArray(record.data) ? record.data : [];
  const first = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {};
  const base64 = typeof first.b64_json === 'string' ? first.b64_json : '';

  if (!base64) {
    throw new CollageGenError('invalid_model_output', 'Ark collage generation did not return an image.');
  }

  return { imageBase64: base64, mimeType: 'image/png' };
}
