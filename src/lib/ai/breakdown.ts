import type {
  BreakdownItem,
  BreakdownResult,
  FreeBreakdownItem,
  NailBreakdownCategory,
  PricingItem,
  StandardBreakdownItem
} from '@/domain/nail';
import { calculateEstimate } from '@/domain/pricing';
import { asRecord, parseGeminiUsageMetadata } from './usage-cost';
import { defaultGeminiImageModel } from './trending-styles';

const geminiGenerateContentBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

const baseServiceValues = ['removal', 'extension', 'builderGel'] as const;
const nailShapeValues = ['round', 'square', 'squoval', 'oval', 'almond', 'coffin', 'stiletto'] as const;
const nailStyleValues = ['solid', 'catEye', 'french', 'chrome', 'rhinestone'] as const;
const nailAddonValues = ['rhinestone', 'charms', 'glitter'] as const;

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

type GeminiCallOptions = {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  prompt: string;
  schema: object;
};

async function callGeminiWithImage(opts: GeminiCallOptions): Promise<unknown> {
  const response = await fetch(`${geminiGenerateContentBaseUrl}/${opts.model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: opts.mimeType, data: opts.imageBase64 } },
            { text: opts.prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: opts.schema
      }
    })
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new BreakdownError(
      'provider_error',
      `Gemini breakdown request failed with status ${response.status}.`,
      { cause: responseJson }
    );
  }

  parseGeminiUsageMetadata(responseJson);
  return parseGeminiResponseText(responseJson);
}

function parseGeminiResponseText(responseJson: unknown): unknown {
  const record = asRecord(responseJson);
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate).content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const textPart = parts.find((p) => typeof asRecord(p).text === 'string');

    if (textPart) {
      const text = String(asRecord(textPart).text).trim();
      try {
        return JSON.parse(stripJsonFence(text));
      } catch {
        // fall through
      }
    }
  }

  throw new BreakdownError('invalid_model_output', 'Gemini breakdown response did not include valid JSON.');
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

// ─── Standard mode ────────────────────────────────────────────────────────────

const standardBreakdownSchema = {
  type: 'object',
  properties: {
    baseServices: { type: 'array', items: { type: 'string', enum: baseServiceValues } },
    nailShape: { type: 'string', enum: nailShapeValues },
    styles: { type: 'array', items: { type: 'string', enum: nailStyleValues } },
    addons: { type: 'array', items: { type: 'string', enum: nailAddonValues } },
    otherNotes: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['baseServices', 'nailShape', 'styles', 'addons', 'otherNotes', 'confidence']
} as const;

const standardPrompt = [
  'Identify the nail service components visible in this image.',
  'Use only the exact enum values provided in the schema.',
  'For nailShape choose the closest visible shape; default to round if unclear.',
  'Do NOT estimate price or duration.'
].join(' ');

export async function runStandardBreakdown(
  imageBase64: string,
  mimeType: string,
  pricingRules: PricingItem[],
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'GEMINI_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultGeminiImageModel;
  const raw = asRecord(
    await callGeminiWithImage({ apiKey, model, imageBase64, mimeType, prompt: standardPrompt, schema: standardBreakdownSchema })
  );

  const keepKnown = <T extends string>(value: unknown, allowed: readonly T[]): T[] => {
    if (!Array.isArray(value)) return [];
    const set = new Set<string>(allowed);
    return value.filter((v): v is T => typeof v === 'string' && set.has(v));
  };

  const keepOne = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

  const baseServices = keepKnown(raw.baseServices, baseServiceValues);
  const nailShape = keepOne(raw.nailShape, nailShapeValues) ?? 'round';
  const styles = keepKnown(raw.styles, nailStyleValues);
  const addons = keepKnown(raw.addons, nailAddonValues);
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
    .map((key) => {
      const rule = rulesByTarget.get(key);
      if (!rule) return null;
      const category: NailBreakdownCategory =
        rule.category === 'base' ? 'base'
        : rule.category === 'shape' ? 'shape'
        : rule.category === 'style' ? 'color_style'
        : rule.category === 'addon' ? 'addon'
        : 'other';
      return {
        mode: 'standard' as const,
        category,
        label: key,
        price: rule.price,
        duration: rule.duration
      };
    })
    .filter((item): item is StandardBreakdownItem => item !== null);

  return {
    items,
    totalPrice: quote.price,
    totalDuration: quote.duration,
    mode: 'standard'
  };
}

// ─── Free mode ────────────────────────────────────────────────────────────────

const freeBreakdownSchema = {
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['base', 'shape', 'color_style', 'addon', 'other'] },
          label: { type: 'string' },
          labelCn: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          price: { type: 'number' },
          duration: { type: 'number' }
        },
        required: ['category', 'label', 'labelCn', 'quantity', 'unit', 'price', 'duration']
      }
    }
  },
  required: ['components']
} as const;

const freePrompt = [
  'You are a professional nail artist. Analyze this nail image and break down ALL visible components.',
  'For each component provide: category (base/shape/color_style/addon/other), label in English,',
  'labelCn in Chinese, quantity (usually 1), unit (e.g. "set", "finger", "piece"),',
  'price in USD (realistic salon pricing), and duration in minutes.',
  'Be thorough — identify techniques like ombre, gel extensions, chrome powder, nail art, etc.'
].join(' ');

export async function runFreeBreakdown(
  imageBase64: string,
  mimeType: string,
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'GEMINI_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultGeminiImageModel;
  const raw = asRecord(
    await callGeminiWithImage({ apiKey, model, imageBase64, mimeType, prompt: freePrompt, schema: freeBreakdownSchema })
  );

  const rawComponents = Array.isArray(raw.components) ? raw.components : [];
  const validCategories = new Set<string>(['base', 'shape', 'color_style', 'addon', 'other']);

  const items: FreeBreakdownItem[] = rawComponents
    .map((c: unknown) => {
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
