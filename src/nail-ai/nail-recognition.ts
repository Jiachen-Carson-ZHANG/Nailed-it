import type {
  AIRecognitionResult,
  BaseServiceName,
  NailAddonName,
  NailShape,
  NailStyleName
} from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';

export const baseServiceValues = ['removal', 'extension', 'builderGel'] as const;
export const nailShapeValues = ['round', 'square', 'squoval', 'oval', 'almond', 'coffin', 'stiletto'] as const;
export const nailStyleValues = ['solid', 'catEye', 'french', 'chrome', 'rhinestone'] as const;
export const nailAddonValues = ['rhinestone', 'charms', 'glitter'] as const;

export const defaultVisionModel = 'doubao-seed-2-0-lite-260215';

export type NailImageRecognitionInput = {
  imageBase64: string;
  language?: AppLanguage;
  mimeType: string;
};

export type NailRecognitionProviderResult = {
  recognition: AIRecognitionResult;
  telemetry: { provider: 'volcengine'; model: string };
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

type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export async function recognizeNailImageWithTelemetry(
  input: NailImageRecognitionInput,
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: FetchLike
): Promise<NailRecognitionProviderResult> {
  // Gemini via OpenRouter is used when OPENROUTER_API_KEY + GEMINI_IMAGE_MODEL_NAME are set in env.
  // ARK_API_KEY is only used as fallback when OpenRouter is not available.
  const arkApiKey = env.ARK_API_KEY ?? '';
  if (!env.OPENROUTER_API_KEY && !arkApiKey) {
    throw new NailRecognitionError('missing_vision_config', 'Either OPENROUTER_API_KEY or ARK_API_KEY is required for nail recognition.');
  }

  const model = env.ARK_VISION_MODEL ?? defaultVisionModel;

  const language = input.language ?? 'zh-CN';

  let data: unknown;
  try {
    data = await postOpenRouterChat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` } },
              { type: 'text', text: getNailRecognitionPrompt(language) }
            ]
          }
        ]
      },
      arkApiKey,
      fetchImpl
    );
  } catch (error) {
    throw new NailRecognitionError('vision_provider_error', 'Ark recognition request failed.', {
      cause: error
    });
  }

  let parsed: unknown;
  try {
    const text = extractTextContent(data);
    parsed = JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new NailRecognitionError('invalid_model_output', 'Ark response was not valid JSON.', {
      cause: error
    });
  }

  return {
    recognition: normalizeNailRecognition(parsed),
    telemetry: { provider: 'volcengine', model }
  };
}

export function normalizeNailRecognition(raw: unknown): AIRecognitionResult {
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

export function keepKnownValues<T extends string>(value: unknown, allowedValues: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(allowedValues);
  const seen = new Set<T>();
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item) || seen.has(item as T)) continue;
    seen.add(item as T);
  }
  return [...seen];
}

export function keepKnownValue<T extends string>(value: unknown, allowedValues: readonly T[]): T | null {
  return typeof value === 'string' && allowedValues.includes(value as T) ? (value as T) : null;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function getNailRecognitionPrompt(_language: AppLanguage): string {
  return [
    'Extract only visible nail-service attributes from this customer reference image.',
    'Do not estimate price, duration, discounts, appointment time, technician, or availability.',
    'Do not write any prose description of the style.',
    'Return a JSON object with keys: baseServices (array of: removal|extension|builderGel),',
    'nailShape (one of: round|square|squoval|oval|almond|coffin|stiletto),',
    'styles (array of: solid|catEye|french|chrome|rhinestone),',
    'add-ons (array of: rhinestone|charms|glitter),',
    'Use only exact values listed. If an attribute is not visible, use an empty array.',
    'For nailShape, choose the closest visible shape; use round if unclear.',
    'Return ONLY valid JSON, no markdown.'
  ].join(' ');
}
