import type {
  BreakdownItem,
  BreakdownResult,
  FreeBreakdownItem,
  NailBreakdownCategory,
  PricingItem,
  StandardBreakdownItem
} from '@/domain/nail';
import { calculateEstimate } from '@/domain/pricing';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';
import {
  baseServiceValues,
  nailShapeValues,
  nailStyleValues,
  nailAddonValues,
  keepKnownValues,
  keepKnownValue
} from './nail-recognition';
import { defaultTryOnModel } from './try-on';

export class BreakdownError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'BreakdownError';
  }
}

async function callOpenRouterWithImage(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  prompt: string;
}): Promise<unknown> {
  let data: unknown;
  try {
    data = await postOpenRouterChat(
      {
        model: opts.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${opts.mimeType};base64,${opts.imageBase64}` } },
              { type: 'text', text: opts.prompt }
            ]
          }
        ]
      },
      opts.apiKey
    );
  } catch (error) {
    throw new BreakdownError('provider_error', 'OpenRouter breakdown request failed.', { cause: error });
  }

  try {
    const text = extractTextContent(data);
    return JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new BreakdownError('invalid_model_output', 'OpenRouter breakdown response did not include valid JSON.', {
      cause: error
    });
  }
}

// ─── Standard mode ────────────────────────────────────────────────────────────

const standardPrompt = [
  'Identify the nail service components visible in this image.',
  'Return ONLY valid JSON (no markdown) with these keys:',
  'baseServices (array of: removal|extension|builderGel),',
  'nailShape (one of: round|square|squoval|oval|almond|coffin|stiletto),',
  'styles (array of: solid|catEye|french|chrome|rhinestone),',
  'addons (array of: rhinestone|charms|glitter),',
  'otherNotes (string), confidence (0-1 number).',
  'Use only the exact values listed. For nailShape default to round if unclear.',
  'Do NOT estimate price or duration.'
].join(' ');

export async function runStandardBreakdown(
  imageBase64: string,
  mimeType: string,
  pricingRules: PricingItem[],
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'OPENROUTER_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;
  const raw = asRecord(await callOpenRouterWithImage({ apiKey, model, imageBase64, mimeType, prompt: standardPrompt }));

  const baseServices = keepKnownValues(raw.baseServices, baseServiceValues);
  const nailShape = keepKnownValue(raw.nailShape, nailShapeValues) ?? 'round';
  const styles = keepKnownValues(raw.styles, nailStyleValues);
  const addons = keepKnownValues(raw.addons, nailAddonValues);
  const otherNotes = typeof raw.otherNotes === 'string' ? raw.otherNotes.trim() : '';
  const confidence = typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5;

  const fakeRecognition = {
    selection: { baseServices, nailShape, styles, addons, otherNotes },
    meta: { confidence, aiSuggestedQuote: { source: 'ai_suggestion' as const, price: 0, duration: 0 } }
  };

  const quote = calculateEstimate(fakeRecognition, pricingRules);
  const rulesByTarget = new Map<string, PricingItem>(pricingRules.map((r) => [r.target, r]));
  const candidates = [...baseServices, nailShape, ...styles, ...addons];

  const items: StandardBreakdownItem[] = candidates
    .map((key): StandardBreakdownItem | null => {
      const rule = rulesByTarget.get(key);
      if (!rule) return null;
      const category: NailBreakdownCategory =
        rule.category === 'base' ? 'base'
        : rule.category === 'shape' ? 'shape'
        : rule.category === 'style' ? 'color_style'
        : rule.category === 'addon' ? 'addon'
        : 'other';
      return { mode: 'standard' as const, category, label: key, price: rule.price, duration: rule.duration };
    })
    .filter((item): item is StandardBreakdownItem => item !== null);

  return { items, totalPrice: quote.price, totalDuration: quote.duration, mode: 'standard' };
}

// ─── Free mode ────────────────────────────────────────────────────────────────

const freePrompt = [
  'You are a professional nail artist. Analyze this nail image and break down ALL visible components.',
  'Return ONLY valid JSON (no markdown) with a "components" array.',
  'Each component: category (base|shape|color_style|addon|other), label (English),',
  'labelCn (Chinese), quantity (usually 1), unit (e.g. "set", "finger", "piece"),',
  'price in USD (realistic salon pricing), duration in minutes.',
  'Be thorough — identify techniques like ombre, gel extensions, chrome powder, nail art, etc.'
].join(' ');

export async function runFreeBreakdown(
  imageBase64: string,
  mimeType: string,
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'OPENROUTER_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;
  const raw = asRecord(await callOpenRouterWithImage({ apiKey, model, imageBase64, mimeType, prompt: freePrompt }));

  const rawComponents = Array.isArray(raw.components) ? raw.components : [];
  const validCategories = new Set<string>(['base', 'shape', 'color_style', 'addon', 'other']);

  const items: FreeBreakdownItem[] = rawComponents
    .map((c: unknown): FreeBreakdownItem => {
      const comp = asRecord(c);
      return {
        mode: 'free' as const,
        category: (typeof comp.category === 'string' && validCategories.has(comp.category)
          ? comp.category
          : 'other') as NailBreakdownCategory,
        label: typeof comp.label === 'string' ? comp.label.trim() : 'Component',
        labelCn: typeof comp.labelCn === 'string' ? comp.labelCn.trim() : undefined,
        quantity: typeof comp.quantity === 'number' && comp.quantity > 0 ? comp.quantity : 1,
        unit: typeof comp.unit === 'string' ? comp.unit.trim() : 'set',
        price: typeof comp.price === 'number' && comp.price >= 0 ? comp.price : 0,
        duration: typeof comp.duration === 'number' && comp.duration >= 0 ? comp.duration : 0
      };
    })
    .filter((item): item is FreeBreakdownItem => Boolean(item.label));

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  return { items, totalPrice, totalDuration, mode: 'free' };
}
