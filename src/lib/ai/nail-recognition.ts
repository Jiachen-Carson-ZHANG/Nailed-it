import type {
  AIRecognitionResult,
  BaseServiceName,
  NailAddonName,
  NailShape,
  NailStyleName
} from '@/domain/nail';
import {
  estimateVisionUsageCost,
  getVisionTokenPricingFromEnv,
  parseGeminiUsageMetadata,
  type VisionCostEstimate,
  type VisionTokenPricing,
  type VisionTokenUsage
} from './usage-cost';

export const defaultGeminiVisionModel = 'gemini-2.5-flash-lite';

const geminiGenerateContentBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

const baseServiceValues = ['removal', 'extension', 'builderGel'] as const;
const nailShapeValues = ['round', 'square', 'squoval', 'oval', 'almond', 'coffin', 'stiletto'] as const;
const nailStyleValues = ['solid', 'catEye', 'french', 'chrome', 'rhinestone'] as const;
const nailAddonValues = ['rhinestone', 'charms', 'glitter'] as const;

type FetchLike = (
  url: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type NailImageRecognitionInput = {
  imageBase64: string;
  mimeType: string;
};

export type GeminiNailRecognitionProviderOptions = {
  apiKey: string;
  fetchImpl?: FetchLike;
  model?: string;
  pricing?: VisionTokenPricing;
};

export type NailRecognitionTelemetry = {
  costEstimate: VisionCostEstimate | null;
  model: string;
  provider: 'gemini';
  usage: VisionTokenUsage | null;
};

export type NailRecognitionProviderResult = {
  recognition: AIRecognitionResult;
  telemetry: NailRecognitionTelemetry;
};

export class NailRecognitionError extends Error {
  constructor(
    public readonly code:
      | 'missing_vision_config'
      | 'unsupported_vision_provider'
      | 'vision_provider_error'
      | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NailRecognitionError';
  }
}

export function createGeminiNailRecognitionProvider({
  apiKey,
  fetchImpl = fetch,
  model = defaultGeminiVisionModel,
  pricing = getVisionTokenPricingFromEnv(process.env)
}: GeminiNailRecognitionProviderOptions) {
  return async (input: NailImageRecognitionInput): Promise<NailRecognitionProviderResult> => {
    const response = await fetchImpl(`${geminiGenerateContentBaseUrl}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.imageBase64
                }
              },
              {
                text: nailRecognitionPrompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: nailRecognitionSchema
        }
      })
    });

    const responseJson = await response.json();

    if (!response.ok) {
      throw new NailRecognitionError(
        'vision_provider_error',
        `Gemini recognition request failed with status ${response.status}.`,
        { cause: responseJson }
      );
    }

    const usage = parseGeminiUsageMetadata(responseJson);

    return {
      recognition: normalizeGeminiNailRecognition(parseGeminiResponseText(responseJson)),
      telemetry: {
        provider: 'gemini',
        model,
        usage,
        costEstimate: usage ? estimateVisionUsageCost(usage, pricing) : null
      }
    };
  };
}

export function createConfiguredNailRecognitionProvider(env = process.env) {
  const providerName = env.VISION_MODEL_PROVIDER || 'gemini';

  if (providerName !== 'gemini') {
    throw new NailRecognitionError(
      'unsupported_vision_provider',
      `Unsupported vision provider: ${providerName}.`
    );
  }

  if (!env.GEMINI_API_KEY) {
    throw new NailRecognitionError(
      'missing_vision_config',
      'GEMINI_API_KEY is required for live nail recognition.'
    );
  }

  return createGeminiNailRecognitionProvider({
    apiKey: env.GEMINI_API_KEY,
    model: env.VISION_MODEL_NAME || defaultGeminiVisionModel,
    pricing: getVisionTokenPricingFromEnv(env)
  });
}

export async function recognizeNailImage(input: NailImageRecognitionInput) {
  const result = await createConfiguredNailRecognitionProvider()(input);

  return result.recognition;
}

export async function recognizeNailImageWithTelemetry(input: NailImageRecognitionInput) {
  return createConfiguredNailRecognitionProvider()(input);
}

export function normalizeGeminiNailRecognition(raw: unknown): AIRecognitionResult {
  const record = asRecord(raw);
  const baseServices = keepKnownValues(record.baseServices, baseServiceValues);
  const styles = keepKnownValues(record.styles, nailStyleValues);
  const addons = keepKnownValues(record.addons, nailAddonValues);
  const nailShape = keepKnownValue(record.nailShape, nailShapeValues) ?? 'round';
  const confidence = clampConfidence(record.confidence);
  const otherNotes = typeof record.otherNotes === 'string' ? record.otherNotes.trim() : '';

  return {
    selection: {
      baseServices: baseServices as BaseServiceName[],
      nailShape: nailShape as NailShape,
      styles: styles as NailStyleName[],
      addons: addons as NailAddonName[],
      otherNotes
    },
    meta: {
      confidence,
      aiSuggestedQuote: {
        source: 'ai_suggestion',
        price: 0,
        duration: 0
      }
    }
  };
}

function parseGeminiResponseText(responseJson: unknown): unknown {
  const text = extractFirstTextPart(responseJson);

  if (!text) {
    throw new NailRecognitionError('invalid_model_output', 'Gemini response did not include text.');
  }

  try {
    return JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new NailRecognitionError('invalid_model_output', 'Gemini response was not valid JSON.', {
      cause: error
    });
  }
}

function extractFirstTextPart(value: unknown): string | null {
  const record = asRecord(value);
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate).content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const textPart = parts.find((part) => typeof asRecord(part).text === 'string');

    if (textPart) {
      return String(asRecord(textPart).text);
    }
  }

  return null;
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function keepKnownValues<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(allowedValues);
  const seen = new Set<T>();

  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item) || seen.has(item as T)) {
      continue;
    }

    seen.add(item as T);
  }

  return [...seen];
}

function keepKnownValue<T extends string>(value: unknown, allowedValues: readonly T[]): T | null {
  return typeof value === 'string' && allowedValues.includes(value as T) ? (value as T) : null;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

const nailRecognitionPrompt = [
  'Extract only visible nail-service attributes from this customer reference image.',
  'Do not estimate price, duration, discounts, appointment time, technician, or availability.',
  'Use the schema values exactly. If an attribute is not visible, omit it from arrays.',
  'For nailShape, choose the closest visible shape; use round if the shape is unclear.'
].join(' ');

const nailRecognitionSchema = {
  type: 'object',
  properties: {
    baseServices: {
      type: 'array',
      items: {
        type: 'string',
        enum: baseServiceValues
      }
    },
    nailShape: {
      type: 'string',
      enum: nailShapeValues
    },
    styles: {
      type: 'array',
      items: {
        type: 'string',
        enum: nailStyleValues
      }
    },
    addons: {
      type: 'array',
      items: {
        type: 'string',
        enum: nailAddonValues
      }
    },
    otherNotes: {
      type: 'string'
    },
    confidence: {
      type: 'number'
    }
  },
  required: ['baseServices', 'nailShape', 'styles', 'addons', 'otherNotes', 'confidence']
} as const;
