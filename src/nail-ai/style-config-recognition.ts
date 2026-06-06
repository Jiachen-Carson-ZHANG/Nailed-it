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
import { catalogItems } from '@/mock/catalog';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { MerchantPricingSetting } from '@/domain/merchant';
import { buildStyleConfig } from '@/domain/style-config';
import { runGlossaryBreakdown } from './breakdown';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';
import { defaultTryOnModel } from './try-on';

export type StyleAiConfig = {
  catalogSelections: CatalogSelection[];
  discoveryFacets: StyleDiscoveryFacet[];
  name: string;
  description: string;
};

const NAME_PROMPT = [
  'You are naming a nail-salon design for a Chinese beauty app.',
  'Look at the nail image and respond with ONLY a JSON object, no prose, no markdown fence:',
  '{ "name": string, "description": string }',
  '- name: a short, catchy Chinese style name, at most 8 Chinese characters (e.g. 奶油法式, 猫眼星河).',
  '- description: one natural Chinese sentence describing the look (shape, colour, finish, vibe).',
].join('\n');

/** One small vision call for a catchy name + a one-line description. */
// The vision model is non-deterministic and occasionally returns text that is not clean JSON (a
// stray quote, prose around the object, truncation). Retry a few times before giving up.
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

// Parse a JSON object even when the model wraps it in prose: strip code fences, then fall back to
// the first balanced { ... } slice.
function looseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripJsonFence(text).trim();
  try {
    return asRecord(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return asRecord(JSON.parse(cleaned.slice(start, end + 1)));
    throw new Error('model output had no JSON object');
  }
}

export async function recognizeStyleName(
  imageBase64: string,
  mimeType: string,
  env = process.env,
): Promise<{ name: string; description: string }> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for style naming.');
  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;

  return withRetry(async () => {
    const data = await postOpenRouterChat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: NAME_PROMPT },
            ],
          },
        ],
      },
      apiKey,
    );

    const parsed = looseJsonObject(extractTextContent(data));
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
    if (!name) throw new Error('model returned no name');
    return { name, description };
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
  env = process.env,
): Promise<StyleAiConfig> {
  const breakdown = await withRetry(() =>
    runGlossaryBreakdown(imageBase64, mimeType, merchantSettings, env),
  );

  // Every item the model named is a high-confidence detection; buildStyleConfig validates the ids,
  // drops anything off-catalog, and splits priced→selections vs descriptive→facets.
  const recognized = breakdown.items.map((item) => ({
    catalogItemId: item.glossaryId,
    confidence: 1,
    quantity: item.quantity,
  }));
  const config = buildStyleConfig(recognized, catalogItems);

  const { name, description } = await recognizeStyleName(imageBase64, mimeType, env);

  return {
    catalogSelections: withBaseManicure(config.catalogBreakdown),
    discoveryFacets: config.discoveryFacets,
    name,
    description: description || config.description,
  };
}

// The base manicure (cleaning / prep / shaping) is the time-and-price floor every design includes,
// but it is ai_detectable='no' so the model never names it. Ensure it's always present so a style's
// derived duration/price is never zero (and the preview_* > 0 DB checks hold).
const BASE_MANICURE_ID = 'basic_manicure_service';

function withBaseManicure(selections: CatalogSelection[]): CatalogSelection[] {
  if (selections.some((s) => s.catalogItemId === BASE_MANICURE_ID)) return selections;
  return [{ catalogItemId: BASE_MANICURE_ID, quantity: 1 }, ...selections];
}
