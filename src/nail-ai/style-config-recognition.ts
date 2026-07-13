// Merchant style auto-config: turn an uploaded/seeded image into a persisted style configuration,
// reusing the SAME vision pipeline as the customer breakdown (no parallel recognizer).
//
//   image → runGlossaryBreakdown (catalog-id detection) → buildStyleConfig (priced→breakdown,
//   descriptive→facets, validated through bucketRecognition) + one naming call → { selections,
//   facets, name, description }.
//
// The caller prices `catalogSelections` through quoteService and writes them via
// set_merchant_style_config. Same catalog ids as pricing — no glossary drift.

import type { CatalogSelection } from '@/domain/catalog';
import { withBaseManicure } from '@/domain/style-selections';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { MerchantPricingSetting } from '@/domain/merchant';
import type { AppLanguage } from '@/i18n/types';
import { buildStyleConfig } from '@/domain/style-config';
import { catalogItems } from '@/mock/catalog';
import { runGlossaryBreakdown } from './breakdown';
import {
  postOpenRouterChat,
  extractTextContent,
  stripJsonFence,
  type OpenRouterJsonSchemaResponseFormat,
} from './openrouter';

export type StyleAiConfig = {
  catalogSelections: CatalogSelection[];
  discoveryFacets: StyleDiscoveryFacet[];
  name: string;
  description: string;
};

export function buildStyleNamePrompt(language: AppLanguage): string {
  const instruction =
    language === 'zh-CN'
      ? '- name: a short, catchy Chinese style name, at most 8 Chinese characters (e.g. 奶油法式, 猫眼星河).\n- description: one natural Chinese sentence describing the look (shape, colour, finish, vibe).'
      : '- name: a short, catchy English style name, ideally 2 to 4 words.\n- description: one natural English sentence describing the look (shape, color, finish, vibe).';

  return [
    'You are naming a nail-salon design for a beauty app.',
    `Return the result in ${language === 'zh-CN' ? 'Simplified Chinese' : 'English'}.`,
    'Look at the nail image and respond with ONLY a JSON object, no prose, no markdown fence:',
    '{ "name": string, "description": string }',
    instruction,
  ].join('\n');
}

export const styleNameResponseFormat: OpenRouterJsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'merchant_style_name',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description'],
      properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
      },
    },
  },
};

/** One small vision call for a catchy name + a one-line description. */
// Provider-side schema enforcement and runtime validation reject malformed output. Retry transient
// provider/schema failures a few times before leaving the upload for manual review.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function parseStyleNameOutput(value: unknown): { name: string; description: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_style_name_output');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 2
    || !keys.includes('name')
    || !keys.includes('description')
    || typeof record.name !== 'string'
    || !record.name.trim()
    || typeof record.description !== 'string'
  ) {
    throw new Error('invalid_style_name_output');
  }
  return { name: record.name.trim(), description: record.description.trim() };
}

export async function recognizeStyleName(
  imageBase64: string,
  mimeType: string,
  language: AppLanguage = 'zh-CN',
  env = process.env,
): Promise<{ name: string; description: string }> {
  // Gemini via OpenRouter is used when OPENROUTER_API_KEY + GEMINI_IMAGE_MODEL_NAME are set in env.
  // ARK_API_KEY is only used as fallback when OpenRouter is not available.
  const apiKey = env.ARK_API_KEY ?? '';
  if (!env.OPENROUTER_API_KEY && !apiKey) throw new Error('Either OPENROUTER_API_KEY or ARK_API_KEY is required for style naming.');
  const model = env.ARK_VISION_MODEL ?? 'doubao-seed-2-0-lite-260215';

  return withRetry(async () => {
    const data = await postOpenRouterChat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: buildStyleNamePrompt(language) },
            ],
          },
        ],
        response_format: styleNameResponseFormat,
        provider: { require_parameters: true },
        plugins: [{ id: 'response-healing' }],
      },
      apiKey,
    );

    return parseStyleNameOutput(JSON.parse(stripJsonFence(extractTextContent(data))));
  });
}

/**
 * Full image → style configuration. `merchantSettings` is the merchant's effective pricing
 * (from merchant-pricing-service or resolveEffectivePricing) — it gates which detected items are
 * priceable. The split + facets + fallback description come from buildStyleConfig so they match the
 * rest of the system; the name (and a richer description) come from the naming call.
 */
export async function recognizeStyleConfig(
  imageBase64: string,
  mimeType: string,
  merchantSettings: MerchantPricingSetting[],
  language: AppLanguage = 'zh-CN',
  env = process.env,
): Promise<StyleAiConfig> {
  const breakdown = await withRetry(() =>
    runGlossaryBreakdown(imageBase64, mimeType, merchantSettings, language, env),
  );

  // Every item the model named is a high-confidence detection; buildStyleConfig validates the ids
  // and derives descriptive facets. The breakdown parser already selected enabled billable items
  // using this merchant's effective settings, including merchant-priced items with no catalog price.
  const recognized = breakdown.items.map((item) => ({
    catalogItemId: item.glossaryId,
    confidence: 1,
    quantity: item.quantity,
  }));
  const config = buildStyleConfig(recognized, catalogItems);

  const { name, description } = await recognizeStyleName(imageBase64, mimeType, language, env);

  return {
    catalogSelections: withBaseManicure(breakdown.catalogSelections),
    discoveryFacets: config.discoveryFacets,
    name,
    description: description || config.description,
  };
}
