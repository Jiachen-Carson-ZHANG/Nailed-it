import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { aiDetectableComponents, glossaryById } from '@/data/glossary';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';
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

function buildPrompt(): string {
  const componentList = JSON.stringify(
    aiDetectableComponents.map((e) => ({ id: e.id, name_zh: e.name_zh })),
    null,
    2
  );
  return [
    'You are a nail analysis AI. Examine this image and identify which of the following nail service components are visible.',
    'Return ONLY valid JSON (no markdown) with a "detected" array.',
    'Each entry must have: id (exactly as listed), quantity (integer ≥ 1), unit (one of: "set", "finger", "piece").',
    'Only include items clearly visible in the image. Do not invent items not in the list.',
    'For decorations like rhinestones or charms, estimate a realistic quantity.',
    '',
    'Available components:',
    componentList
  ].join('\n');
}

export async function runGlossaryBreakdown(
  imageBase64: string,
  mimeType: string,
  merchantSettings: GlossaryEntrySettings[],
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'OPENROUTER_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;
  const raw = asRecord(
    await callOpenRouterWithImage({ apiKey, model, imageBase64, mimeType, prompt: buildPrompt() })
  );

  const rawDetected = Array.isArray(raw.detected) ? raw.detected : [];
  const settingsById = new Map<string, GlossaryEntrySettings>(
    merchantSettings.map((s) => [s.id, s])
  );

  const items: GlossaryBreakdownItem[] = rawDetected
    .map((d: unknown) => {
      const det = asRecord(d);
      const id = typeof det.id === 'string' ? det.id.trim() : '';
      const entry = glossaryById.get(id);
      if (!entry) return null;

      const settings = settingsById.get(id);
      const price = settings?.enabled !== false ? (settings?.price ?? 0) : 0;
      const duration = settings?.enabled !== false ? (settings?.duration ?? entry.default_duration_min) : 0;

      const quantity = typeof det.quantity === 'number' && det.quantity >= 1 ? Math.round(det.quantity) : 1;
      const unit = typeof det.unit === 'string' ? det.unit.trim() : entry.default_pricing_unit;

      const parentEntry = glossaryById.get(entry.parent_id);
      const parentNameZh = parentEntry?.name_zh ?? entry.parent_id;

      return {
        mode: 'glossary' as const,
        glossaryId: id,
        nameZh: entry.name_zh,
        typeZh: entry.type_zh,
        parentId: entry.parent_id,
        parentNameZh,
        quantity,
        unit,
        price,
        duration
      };
    })
    .filter((item): item is GlossaryBreakdownItem => item !== null);

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  return { items, totalPrice, totalDuration, mode: 'glossary' };
}
